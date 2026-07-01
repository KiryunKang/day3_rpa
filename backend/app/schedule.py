"""팀 스케줄(캘린더) API 라우터 — 휴가/근무/출장 등 일정 공유."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

VALID_TYPES = {"vacation", "work", "trip", "etc"}


# ---------- 스키마 ----------
class EventIn(BaseModel):
    title: str = Field(..., min_length=1)
    type: str = Field("etc")
    start_date: str = Field(..., min_length=1)  # YYYY-MM-DD
    end_date: str = Field(..., min_length=1)
    owner: str = Field(..., min_length=1)
    memo: str = ""


class Event(EventIn):
    id: int
    created_at: str


def _validate(payload: EventIn) -> None:
    if payload.type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"유형은 {VALID_TYPES} 중 하나여야 합니다.")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="종료일은 시작일 이후여야 합니다.")


# ---------- 라우트 ----------
@router.get("", response_model=list[Event])
def list_events(
    type: str | None = None,
    owner: str | None = None,
    start: str | None = None,  # 조회 기간 시작
    end: str | None = None,    # 조회 기간 끝
) -> list[dict]:
    """일정 목록. 유형/담당자/기간(겹치는 일정)으로 필터링."""
    clauses, params = [], []
    if type:
        clauses.append("type = ?")
        params.append(type)
    if owner:
        clauses.append("owner = ?")
        params.append(owner)
    # 기간이 겹치는 일정: start_date <= end AND end_date >= start
    if end:
        clauses.append("start_date <= ?")
        params.append(end)
    if start:
        clauses.append("end_date >= ?")
        params.append(start)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT id, title, type, start_date, end_date, owner, memo, created_at "
            f"FROM schedule_events{where} ORDER BY start_date, id",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=Event, status_code=201)
def create_event(payload: EventIn) -> dict:
    """일정 등록."""
    _validate(payload)
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO schedule_events (title, type, start_date, end_date, owner, memo) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (payload.title, payload.type, payload.start_date, payload.end_date,
             payload.owner, payload.memo),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, type, start_date, end_date, owner, memo, created_at "
            "FROM schedule_events WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return dict(row)


@router.put("/{event_id}", response_model=Event)
def update_event(event_id: int, payload: EventIn) -> dict:
    """일정 수정."""
    _validate(payload)
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE schedule_events SET title=?, type=?, start_date=?, end_date=?, owner=?, memo=? "
            "WHERE id=?",
            (payload.title, payload.type, payload.start_date, payload.end_date,
             payload.owner, payload.memo, event_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
        row = conn.execute(
            "SELECT id, title, type, start_date, end_date, owner, memo, created_at "
            "FROM schedule_events WHERE id = ?",
            (event_id,),
        ).fetchone()
    return dict(row)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int) -> None:
    """일정 삭제."""
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM schedule_events WHERE id = ?", (event_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
