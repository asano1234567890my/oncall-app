# backend/models/__init__.py
# Alembic autogenerate 用：ここでモデルをimportしておく

from models.doctor import Doctor  # noqa: F401
from models.unavailable_day import UnavailableDay  # noqa: F401
from models.shift import ShiftAssignment  # noqa: F401

# ★追加
from models.holiday import Holiday  # noqa: F401