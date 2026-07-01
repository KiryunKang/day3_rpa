"""공공 직군 행정업무 슈퍼앱 - FastAPI 백엔드 엔트리포인트."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db import db_status, get_connection, init_db
from app.documents import router as documents_router
from app.schedule import router as schedule_router
from app.excel import router as excel_router
from app.chatbot import router as chatbot_router
from app.news import router as news_router
from app.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 앱 시작 시 DB 초기화 + 스케줄러 기동
    init_db()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="행정업무 슈퍼앱 API", version="0.1.0", lifespan=lifespan)

# 개발용 CORS 설정 (Vite dev 서버)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 기능 라우터 등록
app.include_router(documents_router)  # 전자결재
app.include_router(schedule_router)   # 팀 스케줄
app.include_router(excel_router)      # 엑셀 자동화
app.include_router(chatbot_router)    # 민원 챗봇
app.include_router(news_router)       # 뉴스 수집


# ---------- 스키마 ----------
class NoticeIn(BaseModel):
    title: str
    content: str = ""


class Notice(NoticeIn):
    id: int
    created_at: str


# ---------- 라우트 ----------
@app.get("/api/health")
def health() -> dict:
    """헬스 체크 (FE↔BE 연동 확인용)."""
    return {"status": "ok", "service": "행정업무 슈퍼앱 API"}


@app.get("/api/status")
def status() -> dict:
    """전체 연동 상태: 백엔드 가동 여부 + DB 연결/테이블 현황 (BE↔DB 연동 확인용)."""
    return {"status": "ok", "service": "행정업무 슈퍼앱 API", "db": db_status()}


@app.get("/api/notices", response_model=list[Notice])
def list_notices() -> list[dict]:
    """공지 목록 조회."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, content, created_at FROM notices ORDER BY id DESC"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/notices", response_model=Notice, status_code=201)
def create_notice(payload: NoticeIn) -> dict:
    """공지 등록."""
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO notices (title, content) VALUES (?, ?)",
            (payload.title, payload.content),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, content, created_at FROM notices WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return dict(row)


@app.delete("/api/notices/{notice_id}", status_code=204)
def delete_notice(notice_id: int) -> None:
    """공지 삭제."""
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다.")
