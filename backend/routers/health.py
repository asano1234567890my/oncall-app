from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """
    シンプルなヘルスチェックエンドポイント。

    Next.js フロントエンドなどからの疎通確認に利用します。
    """

    return {"status": "ok"}

