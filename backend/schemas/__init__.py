"""
Pydantic schemas (request / response models).

These decouple external API contracts from internal ORM models.
"""

from .doctor import (
    DoctorCreate,
    DoctorRead,
    UnavailableDayCreate,
    UnavailableDayRead,
)
from .hospital_calendar import HospitalCalendarCreate, HospitalCalendarRead
from .system_setting import SystemSettingCreate, SystemSettingRead
from .unavailable_day import UnavailableDayCreate as UnavailableDayCreateStandalone
from .unavailable_day import UnavailableDayRead as UnavailableDayReadStandalone

__all__ = [
    "DoctorCreate",
    "DoctorRead",
    "UnavailableDayCreate",
    "UnavailableDayRead",
    "UnavailableDayCreateStandalone",
    "UnavailableDayReadStandalone",
    "HospitalCalendarCreate",
    "HospitalCalendarRead",
    "SystemSettingCreate",
    "SystemSettingRead",
]

