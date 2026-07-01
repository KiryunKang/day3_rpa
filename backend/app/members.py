"""팀원(멤버) 관리 API 라우터 — 일정 담당자 마스터."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/members", tags=["members"])


class MemberIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    team: str = ""
    role: str = ""


class Member(MemberIn):
    id: int
    created_at: str


def _row(conn, member_id: int) -> dict:
    row = conn.execute(
        "SELECT id, name, team, role, created_at FROM members WHERE id = ?", (member_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
    return dict(row)


@router.get("", response_model=list[Member])
def list_members() -> list[dict]:
    """팀원 목록."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, team, role, created_at FROM members ORDER BY team, name"
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("", response_model=Member, status_code=201)
def create_member(payload: MemberIn) -> dict:
    """팀원 등록."""
    name = payload.name.strip()
    with get_connection() as conn:
        if conn.execute("SELECT 1 FROM members WHERE name = ?", (name,)).fetchone():
            raise HTTPException(status_code=409, detail=f"이미 등록된 팀원입니다: {name}")
        cur = conn.execute(
            "INSERT INTO members (name, team, role) VALUES (?, ?, ?)",
            (name, payload.team.strip(), payload.role.strip()),
        )
        conn.commit()
        return _row(conn, cur.lastrowid)


@router.put("/{member_id}", response_model=Member)
def update_member(member_id: int, payload: MemberIn) -> dict:
    """팀원 수정. 이름 변경 시 기존 일정의 담당자명도 함께 갱신."""
    name = payload.name.strip()
    with get_connection() as conn:
        old = conn.execute("SELECT name FROM members WHERE id = ?", (member_id,)).fetchone()
        if old is None:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
        dup = conn.execute(
            "SELECT 1 FROM members WHERE name = ? AND id != ?", (name, member_id)
        ).fetchone()
        if dup:
            raise HTTPException(status_code=409, detail=f"이미 등록된 팀원입니다: {name}")
        conn.execute(
            "UPDATE members SET name=?, team=?, role=? WHERE id=?",
            (name, payload.team.strip(), payload.role.strip(), member_id),
        )
        # 이름이 바뀌면 일정의 담당자명도 동기화
        if old["name"] != name:
            conn.execute(
                "UPDATE schedule_events SET owner=? WHERE owner=?", (name, old["name"])
            )
        conn.commit()
        return _row(conn, member_id)


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int) -> None:
    """팀원 삭제(기존 일정은 담당자명으로 유지)."""
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM members WHERE id = ?", (member_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="팀원을 찾을 수 없습니다.")
