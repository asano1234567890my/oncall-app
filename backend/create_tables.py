# backend/create_tables.py
import asyncio
from core.db import engine, Base
# 作成したいモデルをすべてインポートする（これによってBaseがテーブルを認識します）
import models.doctor
import models.hospital_calendar
import models.shift
import models.system_setting
import models.unavailable_day

async def create_tables():
    print("🚀 データベースにテーブルを作成しています...")
    async with engine.begin() as conn:
        # まだ存在しないテーブルだけを作成します
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 全てのテーブルの作成（または確認）が完了しました！")

if __name__ == "__main__":
    asyncio.run(create_tables())