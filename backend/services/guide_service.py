"""AIガイド チャットサービス — Claude APIを使用したアシスタント"""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.doctor import Doctor
from services.settings_service import get_optimizer_config

logger = logging.getLogger(__name__)

# ── Knowledge base cache (read once) ──

_system_spec_cache: str | None = None
_recipes_cache: str | None = None

DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"


def _load_knowledge_base() -> tuple[str, str]:
    """docs/ 配下の知識ベースファイルを読み込み、キャッシュする"""
    global _system_spec_cache, _recipes_cache

    if _system_spec_cache is None:
        spec_path = DOCS_DIR / "system_spec_for_ai_guide.md"
        try:
            _system_spec_cache = spec_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.warning("Knowledge base not found: %s", spec_path)
            _system_spec_cache = "(仕様書が見つかりませんでした)"

    if _recipes_cache is None:
        recipes_path = DOCS_DIR / "ai_guide_recipes.md"
        try:
            _recipes_cache = recipes_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.warning("Knowledge base not found: %s", recipes_path)
            _recipes_cache = "(レシピ集が見つかりませんでした)"

    return _system_spec_cache, _recipes_cache


async def _build_context(db: AsyncSession, hospital_id: uuid.UUID) -> str:
    """ユーザーの現在の設定をJSON文字列で返す"""
    # 常勤医師数
    internal_count_result = await db.execute(
        select(func.count())
        .select_from(Doctor)
        .where(
            Doctor.hospital_id == hospital_id,
            Doctor.is_active.is_(True),
            Doctor.is_external.is_(False),
        )
    )
    internal_count = internal_count_result.scalar() or 0

    # 外部医師数
    external_count_result = await db.execute(
        select(func.count())
        .select_from(Doctor)
        .where(
            Doctor.hospital_id == hospital_id,
            Doctor.is_active.is_(True),
            Doctor.is_external.is_(True),
        )
    )
    external_count = external_count_result.scalar() or 0

    # 最適化設定
    optimizer_config = await get_optimizer_config(db, hospital_id)

    context = {
        "常勤医師数": internal_count,
        "外部医師数": external_count,
        "最適化設定": optimizer_config,
    }
    return json.dumps(context, ensure_ascii=False, indent=2)


def _build_system_prompt(spec: str, recipes: str, context_json: str) -> str:
    return f"""あなたは「シフらく」の AIガイドです。病院の当直・日直スケジュール作成を支援するアシスタントです。

## 基本姿勢
- 共感ファースト: ユーザーの困りごとを「わかります」と受け止めてから解決策を提示
- まずはハード（必ず守るルール）で試すよう案内。ダメなら診断→ソフト（できれば守るルール）に切り替え
- ロック（固定）+再生成は万能パターンとして積極的に提案
- 「できません」で終わらない。代替案やワークアラウンドを必ず提示
- 専門用語を使わない: 「ハード制約」→「必ず守るルール」、「ソフト制約」→「できれば守るルール」
- 手順は番号付きリストで簡潔に
- 逆転の原則: 「特定の日だけ入れたい」は「それ以外を全部不可日にする」で実現する。不可日設定の提案時は常にこの逆転パターンを意識すること

## システム仕様書
{spec}

## 逆引き辞書・レシピ集
{recipes}

## このユーザーの現在の設定
{context_json}"""


async def chat(
    db: AsyncSession,
    hospital_id: uuid.UUID,
    message: str,
    history: list[dict],
) -> str:
    """Claude APIを呼び出してAIガイドの返答を生成する"""

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AIガイドは現在利用できません。管理者に連絡してください。",
        )

    import anthropic

    spec, recipes = _load_knowledge_base()
    context_json = await _build_context(db, hospital_id)
    system_prompt = _build_system_prompt(spec, recipes, context_json)

    # 会話履歴を構築
    messages: list[dict] = []
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

    try:
        client = anthropic.AsyncAnthropic()
        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text
    except Exception:
        logger.exception("Claude API call failed")
        return "申し訳ありません、一時的にエラーが発生しました。もう一度お試しください。"
