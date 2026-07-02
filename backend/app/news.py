"""뉴스 기사 수집 API — 대한민국 정책브리핑(korea.kr) 정책뉴스 날짜별 크롤링."""

import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_connection

router = APIRouter(prefix="/api/news", tags=["news"])

LIST_URL = "https://www.korea.kr/news/policyNewsList.do"
BASE = "https://www.korea.kr"
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
_KST = ZoneInfo("Asia/Seoul")
_MAX_PAGES = 30  # 안전 상한 (무한 루프 방지)


def _yesterday() -> date:
    """한국 시각 기준 전날 날짜."""
    return datetime.now(_KST).date() - timedelta(days=1)


def _view_url(news_id: str) -> str:
    return f"{BASE}/news/policyNewsView.do?newsId={news_id}"


def _parse_cards(html: str, target: str) -> list[dict]:
    """리스트 HTML에서 발행일이 target(YYYY-MM-DD)인 정책뉴스 카드만 추출.

    결과 카드는 `span.source`(='YYYY-MM-DD 부처명')를 가진 <li>. 인기/관련 뉴스
    링크는 span.source가 없어 자연히 제외되고, 발행일 재확인으로 추천기사도 걸러진다.
    """
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    for li in soup.find_all("li"):
        a = li.select_one('a[href*="policyNewsView.do"]')
        src_el = li.select_one("span.source")
        if not a or not src_el:
            continue
        m = re.search(r"newsId=(\d+)", a.get("href", ""))
        if not m:
            continue
        src_text = " ".join(src_el.get_text(" ", strip=True).split())
        dm = re.search(r"\d{4}-\d{2}-\d{2}", src_text)
        published = dm.group(0) if dm else ""
        if published != target:  # 다른 날짜/추천 기사 방어
            continue
        source = src_text.replace(published, "", 1).strip()  # 부처명
        title_el = li.select_one("span.text strong") or li.select_one("strong")
        title = " ".join(title_el.get_text(" ", strip=True).split()) if title_el else ""
        if not title:
            continue
        items.append(
            {"url": _view_url(m.group(1)), "title": title, "source": source, "published": published}
        )
    return items


def collect_news(target_date: date | None = None) -> dict:
    """정책브리핑에서 지정 날짜(기본: 전날) 정책뉴스를 수집해 DB 저장(중복 URL 무시)."""
    target = target_date or _yesterday()
    d = target.isoformat()
    scanned = 0
    inserted = 0
    errors: list[str] = []
    with get_connection() as conn:
        for page in range(1, _MAX_PAGES + 1):
            try:
                resp = httpx.get(
                    LIST_URL,
                    params={"startDate": d, "endDate": d, "pageIndex": page},
                    headers={"User-Agent": _UA},
                    timeout=15,
                    follow_redirects=True,
                )
                resp.encoding = "utf-8"
                resp.raise_for_status()
            except Exception as e:  # noqa: BLE001
                errors.append(f"page {page}: {e}")
                break
            cards = _parse_cards(resp.text, d)
            if not cards:  # 해당 날짜 기사 소진 → 종료
                break
            scanned += len(cards)
            for c in cards:
                cur = conn.execute(
                    "INSERT OR IGNORE INTO news_articles (title, url, source, keyword, published_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (c["title"], c["url"], c["source"], None, c["published"]),
                )
                inserted += cur.rowcount
        conn.commit()
    return {"date": d, "scanned": scanned, "inserted": inserted, "errors": errors}


# ---------- 스키마 ----------
class Article(BaseModel):
    id: int
    title: str
    url: str
    source: str
    keyword: str | None
    published_at: str | None
    collected_at: str


class CollectIn(BaseModel):
    date: str | None = None  # YYYY-MM-DD, 미지정 시 전날


# ---------- 기사 ----------
@router.get("", response_model=list[Article])
def list_news(date: str | None = None, limit: int = 100) -> list[dict]:
    """수집된 기사 목록(최신순). date(YYYY-MM-DD)로 발행일 필터 가능."""
    with get_connection() as conn:
        if date:
            rows = conn.execute(
                "SELECT id, title, url, source, keyword, published_at, collected_at "
                "FROM news_articles WHERE published_at = ? ORDER BY id DESC LIMIT ?",
                (date, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, url, source, keyword, published_at, collected_at "
                "FROM news_articles ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


@router.post("/collect")
def collect_now(payload: CollectIn = CollectIn()) -> dict:
    """지정 날짜(미지정 시 전날) 정책뉴스를 즉시 수집(수동 크롤링)."""
    target: date | None = None
    if payload.date:
        try:
            target = date.fromisoformat(payload.date)
        except ValueError:
            raise HTTPException(status_code=422, detail="날짜 형식은 YYYY-MM-DD 여야 합니다.")
    return collect_news(target)
