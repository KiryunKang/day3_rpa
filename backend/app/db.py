"""SQLite 연결 및 초기화 유틸리티."""

import sqlite3
from pathlib import Path

# 프로젝트(backend) 루트 기준으로 DB 파일 위치 지정
DB_PATH = Path(__file__).resolve().parent.parent / "app.db"


def get_connection() -> sqlite3.Connection:
    """행을 dict 처럼 다룰 수 있는 SQLite 연결을 반환한다."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def db_status() -> dict:
    """DB 연결 상태와 테이블별 행 수를 반환한다 (BE↔DB 연동 확인용)."""
    try:
        with get_connection() as conn:
            names = [
                r[0]
                for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' "
                    "AND name NOT LIKE 'sqlite_%' ORDER BY name"
                ).fetchall()
            ]
            tables = {
                name: conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
                for name in names
            }
        return {
            "connected": True,
            "engine": f"sqlite {sqlite3.sqlite_version}",
            "path": str(DB_PATH),
            "tables": tables,
        }
    except Exception as e:  # noqa: BLE001
        return {"connected": False, "error": str(e), "path": str(DB_PATH)}


def init_db() -> None:
    """앱 시작 시 필요한 테이블을 생성하고 샘플 데이터를 넣는다."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notices (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )
        # 최초 실행 시에만 샘플 공지 삽입
        count = conn.execute("SELECT COUNT(*) FROM notices").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO notices (title, content) VALUES (?, ?)",
                [
                    ("행정업무 슈퍼앱에 오신 것을 환영합니다", "이곳에서 공지사항을 관리할 수 있습니다."),
                    ("샘플 공지", "FE ↔ BE ↔ SQLite 연동 확인용 데이터입니다."),
                ],
            )

        # 전자결재: 문서
        # status: draft(임시) / in_progress(진행중) / approved(승인완료) / rejected(반려)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL DEFAULT '',
                drafter    TEXT    NOT NULL,
                status     TEXT    NOT NULL DEFAULT 'in_progress',
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 전자결재: 결재선(단계). step_order 순서대로 순차 결재
        # status: pending(대기) / approved(승인) / rejected(반려)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS approval_steps (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                step_order  INTEGER NOT NULL,
                approver    TEXT    NOT NULL,
                status      TEXT    NOT NULL DEFAULT 'pending',
                comment     TEXT    NOT NULL DEFAULT '',
                acted_at    TEXT,
                UNIQUE (document_id, step_order)
            )
            """
        )

        # 팀 스케줄: 휴가/근무/출장 등 일정
        # type: vacation(휴가) / work(근무) / trip(출장) / etc(기타)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                type       TEXT    NOT NULL DEFAULT 'etc',
                start_date TEXT    NOT NULL,
                end_date   TEXT    NOT NULL,
                owner      TEXT    NOT NULL,
                memo       TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 엑셀 처리 이력
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS excel_jobs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                job_type     TEXT    NOT NULL,
                source_files TEXT    NOT NULL,
                key_column   TEXT,
                row_count    INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 민원 매뉴얼 (추출된 본문 텍스트 저장)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS manuals (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                filename   TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 챗봇 대화 로그 (선택)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT    NOT NULL,
                role       TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 뉴스 기사 (url UNIQUE 로 중복 제거)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS news_articles (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT    NOT NULL,
                url          TEXT    NOT NULL UNIQUE,
                source       TEXT    NOT NULL DEFAULT '',
                keyword      TEXT,
                published_at TEXT,
                collected_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )

        # 뉴스 수집 키워드 (편집 가능)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS news_keywords (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword    TEXT    NOT NULL UNIQUE,
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )
        # 최초 실행 시 기본 키워드 시드
        kw_count = conn.execute("SELECT COUNT(*) FROM news_keywords").fetchone()[0]
        if kw_count == 0:
            conn.executemany(
                "INSERT INTO news_keywords (keyword) VALUES (?)",
                [("공공행정",), ("행정안전부",), ("지방자치",), ("전자정부",), ("민원행정",)],
            )

        # 팀원 (일정 담당자 마스터)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS members (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL UNIQUE,
                team       TEXT    NOT NULL DEFAULT '',
                role       TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
            """
        )
        m_count = conn.execute("SELECT COUNT(*) FROM members").fetchone()[0]
        if m_count == 0:
            conn.executemany(
                "INSERT INTO members (name, team, role) VALUES (?, ?, ?)",
                [
                    ("홍길동", "총무팀", "주무관"),
                    ("김철수", "재무팀", "주무관"),
                    ("이영희", "민원팀", "팀장"),
                    ("박민수", "기획팀", "주무관"),
                    ("최지은", "총무팀", "주무관"),
                ],
            )
        conn.commit()
