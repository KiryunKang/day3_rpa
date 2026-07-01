"""민원대응 챗봇 API 라우터 — 매뉴얼 근거 응대 스크립트 생성 (Claude API)."""

import io
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

MODEL = "claude-opus-4-8"
SYSTEM_PROMPT = (
    "당신은 공공기관 민원 대응 보조 챗봇입니다. "
    "제공된 민원 매뉴얼에 근거해서만 대응 방식과 응대 스크립트를 작성하세요. "
    "매뉴얼에 근거가 없는 내용은 지어내지 말고 '매뉴얼에 근거 없음'이라고 명확히 밝히세요. "
    "답변은 (1) 핵심 대응 방식, (2) 바로 사용할 수 있는 응대 스크립트 순서로 한국어로 작성하세요."
)


# ---------- 스키마 ----------
class ManualOut(BaseModel):
    id: int
    title: str
    filename: str
    created_at: str


class ChatTurn(BaseModel):
    role: str  # user | assistant
    content: str


class ChatIn(BaseModel):
    manual_id: int
    messages: list[ChatTurn] = Field(..., min_length=1)


class Citation(BaseModel):
    cited_text: str
    start: int | None = None
    end: int | None = None


class ChatOut(BaseModel):
    reply: str
    citations: list[Citation]


# ---------- 매뉴얼 ----------
def _extract_text(upload: UploadFile) -> str:
    name = (upload.filename or "").lower()
    data = upload.file.read()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=422, detail=f"PDF에서 텍스트를 추출할 수 없습니다: {e}") from e
    if name.endswith((".txt", ".md")):
        return data.decode("utf-8", errors="replace")
    raise HTTPException(status_code=422, detail="PDF/TXT/MD 파일만 지원합니다.")


@router.post("/manuals", response_model=ManualOut, status_code=201)
def upload_manual(file: UploadFile = File(...), title: str = Form("")) -> dict:
    """민원 매뉴얼 업로드 (본문 텍스트 추출·저장)."""
    content = _extract_text(file).strip()
    if not content:
        raise HTTPException(status_code=422, detail="문서에서 텍스트를 찾을 수 없습니다.")
    manual_title = title.strip() or (file.filename or "매뉴얼")
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO manuals (title, filename, content) VALUES (?, ?, ?)",
            (manual_title, file.filename or "", content),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, filename, created_at FROM manuals WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return dict(row)


@router.get("/manuals", response_model=list[ManualOut])
def list_manuals() -> list[dict]:
    """등록된 매뉴얼 목록."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, title, filename, created_at FROM manuals ORDER BY id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# ---------- 챗봇 대화 ----------
@router.post("/chat", response_model=ChatOut)
def chat(payload: ChatIn) -> dict:
    """민원 상황을 받아 매뉴얼 근거 응대 스크립트를 생성한다."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY가 설정되지 않았습니다. 서버 환경변수를 설정한 뒤 다시 시도하세요.",
        )

    with get_connection() as conn:
        manual = conn.execute(
            "SELECT title, content FROM manuals WHERE id = ?", (payload.manual_id,)
        ).fetchone()
    if manual is None:
        raise HTTPException(status_code=404, detail="매뉴얼을 찾을 수 없습니다.")

    # 첫 사용자 턴에 매뉴얼을 document 블록으로 제공(인용 + 프롬프트 캐싱)
    doc_block = {
        "type": "document",
        "source": {"type": "text", "media_type": "text/plain", "data": manual["content"]},
        "title": manual["title"],
        "citations": {"enabled": True},
        "cache_control": {"type": "ephemeral"},
    }

    api_messages: list[dict] = []
    for i, turn in enumerate(payload.messages):
        if i == 0 and turn.role == "user":
            api_messages.append(
                {"role": "user", "content": [doc_block, {"type": "text", "text": turn.content}]}
            )
        else:
            api_messages.append({"role": turn.role, "content": turn.content})

    try:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.create(
            model=MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=api_messages,
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Anthropic 인증 실패: API 키를 확인하세요.")
    except anthropic.APIStatusError as e:  # noqa: PERF203
        raise HTTPException(status_code=502, detail=f"Claude API 오류: {e.status_code} {e.message}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Claude 호출 실패: {e}") from e

    reply_parts: list[str] = []
    citations: list[dict] = []
    for block in response.content:
        if block.type == "text":
            reply_parts.append(block.text)
            for c in getattr(block, "citations", None) or []:
                citations.append(
                    {
                        "cited_text": getattr(c, "cited_text", ""),
                        "start": getattr(c, "start_char_index", None),
                        "end": getattr(c, "end_char_index", None),
                    }
                )

    reply = "".join(reply_parts).strip()

    # 대화 로그 저장(마지막 사용자 발화 + 응답)
    session_id = f"m{payload.manual_id}"
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)",
            (session_id, payload.messages[-1].content),
        )
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)",
            (session_id, reply),
        )
        conn.commit()

    return {"reply": reply, "citations": citations}
