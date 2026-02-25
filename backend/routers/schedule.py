# backend/routers/schedule.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid

from core.db import get_db
from models.doctor import Doctor
from models.shift import ShiftAssignment

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])

class ShiftData(BaseModel):
    day: int
    day_shift: Optional[int] = None
    night_shift: Optional[int] = None

class SaveScheduleRequest(BaseModel):
    year: int
    month: int
    num_doctors: int
    schedule: List[ShiftData]

@router.post("/save")
async def save_schedule(req: SaveScheduleRequest, db: AsyncSession = Depends(get_db)):
    try:
        # 1. 医師データの確認と生成
        # select() を使って医師一覧を取得
        result = await db.execute(select(Doctor).order_by(Doctor.name))
        doctors = result.scalars().all()
        
        if len(doctors) < req.num_doctors:
            for i in range(len(doctors), req.num_doctors):
                new_doc = Doctor(name=f"テスト医師 {i}")
                db.add(new_doc)
            await db.commit()
            # 再取得
            result = await db.execute(select(Doctor).order_by(Doctor.name))
            doctors = result.scalars().all()
        
        doc_map = {i: doctors[i].id for i in range(req.num_doctors)}

        # 2. 既存シフトの削除
        start_date = datetime.date(req.year, req.month, 1)
        if req.month == 12:
            end_date = datetime.date(req.year + 1, 1, 1)
        else:
            end_date = datetime.date(req.year, req.month + 1, 1)
            
        await db.execute(
            delete(ShiftAssignment).where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date
            )
        )

        # 3. 新しいシフトの保存
        new_assignments = []
        for item in req.schedule:
            current_date = datetime.date(req.year, req.month, item.day)
            
            if item.day_shift is not None:
                new_assignments.append(
                    ShiftAssignment(date=current_date, doctor_id=doc_map[item.day_shift], shift_type="日直")
                )
            if item.night_shift is not None:
                new_assignments.append(
                    ShiftAssignment(date=current_date, doctor_id=doc_map[item.night_shift], shift_type="当直")
                )
        
        db.add_all(new_assignments)
        await db.commit() # await を追加！
        
        return {"success": True, "message": "神シフトをデータベースに保存しました！", "saved_count": len(new_assignments)}
        
    except Exception as e:
        await db.rollback() # await を追加！
        print(f"DEBUG Error: {str(e)}") # ログにエラー内容を出力
        raise HTTPException(status_code=500, detail=str(e))

        # backend/routers/schedule.py の末尾に追記

from sqlalchemy.orm import selectinload

@router.get("/{year}/{month}")
async def get_schedule(year: int, month: int, db: AsyncSession = Depends(get_db)):
    try:
        start_date = datetime.date(year, month, 1)
        if month == 12:
            end_date = datetime.date(year + 1, 1, 1)
        else:
            end_date = datetime.date(year, month + 1, 1)

        # シフトデータを取得し、紐付いている医師情報(Doctor)も一緒に読み込む
        result = await db.execute(
            select(ShiftAssignment)
            .options(selectinload(ShiftAssignment.doctor))
            .where(
                ShiftAssignment.date >= start_date,
                ShiftAssignment.date < end_date
            )
            .order_by(ShiftAssignment.date)
        )
        assignments = result.scalars().all()

        # フロントエンドが扱いやすい形に整形
        formatted_data = {}
        for a in assignments:
            day = a.date.day
            if day not in formatted_data:
                formatted_data[day] = {"day": day, "day_shift": None, "night_shift": None}
            
            if a.shift_type == "日直":
                formatted_data[day]["day_shift"] = a.doctor.name
            else:
                formatted_data[day]["night_shift"] = a.doctor.name

        return sorted(formatted_data.values(), key=lambda x: x["day"])

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))