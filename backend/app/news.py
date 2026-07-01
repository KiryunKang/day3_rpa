"""뉴스 기사 수집 API 라우터 — 공공 행정 관련 뉴스 RSS 수집 (키워드 편집 가능)."""

from urllib.parse import quote

import feedparser
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import get_connection

router = APIRouter(prefix="/api/news", tags=["news"])


def _feed_url(keyword: str) -> str:
    q = quote(keyword)
    return f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko"


def get_keywords() -> list[str]:
    """DB에 저장된 수집 키워드 목록."""
    with get_connection() as conn:
        rows = conn.execute("SELECT keyword FROM news_keywords ORDER BY id").fetchall()
    return [r[0] for r in rows]


def collect_news() -> dict:
    """설정된 키워드별 RSS를 수집해 SQLite에 저장(중복 URL 무시)."""
    keywords = get_keywords()
    inserted = 0
    scanned = 0
    errors: list[str] = []
    with get_connection() as conn:
        for kw in keywords:
            try:
                feed = feedparser.parse(_feed_url(kw))
            except Exception as e:  # noqa: BLE001
                errors.append(f"{kw}: {e}")
                continue
            for entry in feed.entries:
                scanned += 1
                url = getattr(entry, "link", "")
                title = getattr(entry, "title", "")
                if not url or not title:
                    continue
                source = ""
                if getattr(entry, "source", None):
                    source = getattr(entry.source, "title", "")
                published = getattr(entry, "published", None)
                cur = conn.execute(
                    "INSERT OR IGNORE INTO news_articles (title, url, source, keyword, published_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (title, url, source, kw, published),
                )
                inserted += cur.rowcount
        conn.commit()
    return {"scanned": scanned, "inserted": inserted, "keywords": keywords, "errors": errors}


# ---------- 스키마 ----------
class Article(BaseModel):
    id: int
    title: str
    url: str
    source: str
    keyword: str | None
    published_at: str | None
    collected_at: str


class KeywordIn(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=40)


# ---------- 기사 ----------
@router.get("", response_model=list[Article])
def list_news(keyword: str | None = None, limit: int = 100) -> list[dict]:
    """수집된 기사 목록(최신순). keyword로 필터 가능."""
    with get_connection() as conn:
        if keyword:
            rows = conn.execute(
                "SELECT id, title, url, source, keyword, published_at, collected_at "
                "FROM news_articles WHERE keyword = ? ORDER BY id DESC LIMIT ?",
                (keyword, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, url, source, keyword, published_at, collected_at "
                "FROM news_articles ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


@router.post("/collect")
def collect_now() -> dict:
    """지금 즉시 수집 실행(수동 크롤링)."""
    return collect_news()


# ---------- 키워드 관리 ----------
@router.get("/keywords")
def keywords() -> dict:
    """수집 대상 키워드 목록."""
    return {"keywords": get_keywords()}


@router.post("/keywords", status_code=201)
def add_keyword(payload: KeywordIn) -> dict:
    """수집 키워드 추가."""
    kw = payload.keyword.strip()
    if not kw:
        raise HTTPException(status_code=422, detail="키워드를 입력하세요.")
    with get_connection() as conn:
        exists = conn.execute("SELECT 1 FROM news_keywords WHERE keyword = ?", (kw,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail=f"이미 등록된 키워드입니다: {kw}")
        conn.execute("INSERT INTO news_keywords (keyword) VALUES (?)", (kw,))
        conn.commit()
    return {"keywords": get_keywords()}


@router.delete("/keywords/{keyword}")
def delete_keyword(keyword: str) -> dict:
    """수집 키워드 삭제(기존 수집 기사는 유지)."""
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM news_keywords WHERE keyword = ?", (keyword,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다.")
    return {"keywords": get_keywords()}
