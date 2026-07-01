"""APScheduler 설정 — 매일 아침 뉴스 자동 수집."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.news import collect_news

logger = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler | None = None


def _job() -> None:
    logger.info("뉴스 자동 수집 시작")
    result = collect_news()
    logger.info("뉴스 자동 수집 완료: %s", result)


def start_scheduler() -> None:
    """앱 시작 시 스케줄러 기동 — 매일 07:00 뉴스 수집."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    _scheduler.add_job(
        _job,
        trigger=CronTrigger(hour=7, minute=0),
        id="daily_news_collect",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("스케줄러 기동: 매일 07:00 뉴스 수집")


def shutdown_scheduler() -> None:
    """앱 종료 시 스케줄러 정지."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
