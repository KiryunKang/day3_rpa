"""전자결재(문서 결재) API 라우터."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ---------- 스키마 ----------
class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = ""
    drafter: str = Field(..., min_length=1)
    approvers: list[str] = Field(..., min_length=1)  # 결재선 (순서대로)


class ApprovalAction(BaseModel):
    approver: str = Field(..., min_length=1)
    comment: str = ""


class ApprovalStep(BaseModel):
    id: int
    step_order: int
    approver: str
    status: str
    comment: str
    acted_at: str | None


class DocumentSummary(BaseModel):
    id: int
    title: str
    drafter: str
    status: str
    created_at: str


class DocumentDetail(DocumentSummary):
    content: str
    steps: list[ApprovalStep]


# ---------- 헬퍼 ----------
def _load_detail(conn, doc_id: int) -> dict:
    doc = conn.execute(
        "SELECT id, title, content, drafter, status, created_at FROM documents WHERE id = ?",
        (doc_id,),
    ).fetchone()
    if doc is None:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    steps = conn.execute(
        """
        SELECT id, step_order, approver, status, comment, acted_at
        FROM approval_steps
        WHERE document_id = ?
        ORDER BY step_order
        """,
        (doc_id,),
    ).fetchall()
    return {**dict(doc), "steps": [dict(s) for s in steps]}


def _current_step(conn, doc_id: int):
    """아직 처리되지 않은(pending) 가장 앞 순서의 결재 단계."""
    return conn.execute(
        """
        SELECT id, step_order, approver, status
        FROM approval_steps
        WHERE document_id = ? AND status = 'pending'
        ORDER BY step_order
        LIMIT 1
        """,
        (doc_id,),
    ).fetchone()


# ---------- 라우트 ----------
@router.get("", response_model=list[DocumentSummary])
def list_documents(status: str | None = None) -> list[dict]:
    """문서 목록. status 쿼리로 상태 필터링 가능."""
    with get_connection() as conn:
        if status:
            rows = conn.execute(
                "SELECT id, title, drafter, status, created_at FROM documents "
                "WHERE status = ? ORDER BY id DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, drafter, status, created_at FROM documents ORDER BY id DESC"
            ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: int) -> dict:
    """문서 상세 (결재선 포함)."""
    with get_connection() as conn:
        return _load_detail(conn, doc_id)


@router.post("", response_model=DocumentDetail, status_code=201)
def create_document(payload: DocumentCreate) -> dict:
    """문서 기안(상신). 결재선을 순서대로 등록하고 진행중 상태로 만든다."""
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO documents (title, content, drafter, status) VALUES (?, ?, ?, 'in_progress')",
            (payload.title, payload.content, payload.drafter),
        )
        doc_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO approval_steps (document_id, step_order, approver) VALUES (?, ?, ?)",
            [(doc_id, i + 1, name) for i, name in enumerate(payload.approvers)],
        )
        conn.commit()
        return _load_detail(conn, doc_id)


@router.post("/{doc_id}/approve", response_model=DocumentDetail)
def approve(doc_id: int, action: ApprovalAction) -> dict:
    """현재 차례 결재자가 승인. 마지막 단계면 문서가 승인완료된다."""
    with get_connection() as conn:
        doc = conn.execute(
            "SELECT status FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if doc is None:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        if doc["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="이미 완료된 문서입니다.")

        step = _current_step(conn, doc_id)
        if step is None:
            raise HTTPException(status_code=409, detail="결재할 단계가 없습니다.")
        if step["approver"] != action.approver:
            raise HTTPException(
                status_code=403,
                detail=f"현재 결재 차례는 '{step['approver']}' 입니다.",
            )

        conn.execute(
            "UPDATE approval_steps SET status='approved', comment=?, "
            "acted_at=datetime('now','localtime') WHERE id=?",
            (action.comment, step["id"]),
        )
        # 남은 대기 단계가 없으면 문서 승인완료
        if _current_step(conn, doc_id) is None:
            conn.execute(
                "UPDATE documents SET status='approved' WHERE id=?", (doc_id,)
            )
        conn.commit()
        return _load_detail(conn, doc_id)


@router.post("/{doc_id}/reject", response_model=DocumentDetail)
def reject(doc_id: int, action: ApprovalAction) -> dict:
    """현재 차례 결재자가 반려. 문서 전체가 반려 처리된다."""
    with get_connection() as conn:
        doc = conn.execute(
            "SELECT status FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if doc is None:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        if doc["status"] != "in_progress":
            raise HTTPException(status_code=409, detail="이미 완료된 문서입니다.")

        step = _current_step(conn, doc_id)
        if step is None:
            raise HTTPException(status_code=409, detail="결재할 단계가 없습니다.")
        if step["approver"] != action.approver:
            raise HTTPException(
                status_code=403,
                detail=f"현재 결재 차례는 '{step['approver']}' 입니다.",
            )

        conn.execute(
            "UPDATE approval_steps SET status='rejected', comment=?, "
            "acted_at=datetime('now','localtime') WHERE id=?",
            (action.comment, step["id"]),
        )
        conn.execute("UPDATE documents SET status='rejected' WHERE id=?", (doc_id,))
        conn.commit()
        return _load_detail(conn, doc_id)
