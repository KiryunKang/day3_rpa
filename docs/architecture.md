# Architecture — 공공 직군 행정업무 슈퍼앱

> 기술적 요구사항 · 프로젝트 구조 · 모듈별 역할
> 최종 수정: 2026-07-01

## 1. 기술 스택

| 영역 | 스택 | 비고 |
|------|------|------|
| Frontend | **TypeScript + Vite + React** | SPA, `/api` → 백엔드 프록시 |
| Backend | **Python + FastAPI** | 패키지 관리는 **uv** 필수 |
| Database | **SQLite** | 파일 기반, Python 내장 `sqlite3` |
| AI | **Anthropic Claude API** (`claude-opus-4-8`) | 민원 챗봇 · 뉴스 요약(선택) |
| 스케줄러 | **APScheduler** | 뉴스 매일 아침 수집 |
| 엑셀 | **pandas + openpyxl** | 분할/병합 |
| 뉴스 수집 | **feedparser / httpx (+ BeautifulSoup)** | RSS·웹 |

### 개발환경 (확인 완료)
- Node.js v24.18.0 / npm 11.16.0
- uv 0.11.25 (Python 3.14.6 관리)
- SQLite 3.53.1 (Python 내장 모듈)

> Python은 시스템 설치본이 아닌 **uv 관리 인터프리터**를 사용한다. 모든 실행은 `uv run ...`.

---

## 2. 프로젝트 구조 (목표)

```
day3_rpa/
├── docs/                     # 문서 (본 폴더)
│   ├── PRD.md
│   ├── architecture.md
│   ├── operation.md
│   └── index.html            # 종합 대시보드
├── frontend/                 # Vite + React + TS
│   ├── src/
│   │   ├── api.ts            # 백엔드 API 클라이언트
│   │   ├── types.ts
│   │   ├── App.tsx           # 라우팅/탭 네비게이션
│   │   └── features/
│   │       ├── schedule/     # 팀 캘린더 화면
│   │       ├── excel/        # 엑셀 분할·병합 화면
│   │       ├── chatbot/      # 민원 챗봇 화면
│   │       ├── news/         # 뉴스 수집 화면
│   │       └── approval/     # (기존) 전자결재
│   └── vite.config.ts        # /api 프록시 설정
└── backend/                  # FastAPI (uv)
    ├── pyproject.toml
    ├── main.py               # 실행 진입점 (uv run dev)
    └── app/
        ├── main.py           # FastAPI 앱, CORS, 라우터 등록, lifespan
        ├── db.py             # SQLite 연결/스키마 초기화
        ├── documents.py      # (기존) 전자결재 라우터
        ├── schedule.py       # 팀 스케줄 라우터
        ├── excel.py          # 엑셀 분할/병합 라우터
        ├── chatbot.py        # 민원 챗봇 라우터 (Claude API)
        ├── news.py           # 뉴스 수집 라우터 + 스케줄 작업
        └── scheduler.py      # APScheduler 설정(앱 시작 시 기동)
```

> 프론트엔드는 기능별 `features/` 폴더로 분리해 모듈 응집도를 높인다.

---

## 3. 아키텍처 개요

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Browser (React SPA)     │  /api  │  FastAPI (uv, Python 3.14)   │
│  - 캘린더 / 엑셀 / 챗봇   │ ─────▶ │  라우터: schedule/excel/     │
│    / 뉴스 / 결재 화면      │  프록시 │  chatbot/news/documents      │
└──────────────────────────┘        │                              │
                                     │  ├─ SQLite (app.db)          │
                                     │  ├─ APScheduler (매일 07:00) │
                                     │  └─ Claude API (opus-4-8)    │
                                     └──────────────────────────────┘
                                                │            │
                                     외부 뉴스 소스(RSS)   Anthropic API
```

- FE는 정적 자산으로 빌드, DEV에서는 Vite 프록시로 `/api` 요청을 8000 포트 FastAPI에 전달
- BE는 단일 FastAPI 앱에 기능별 **APIRouter**를 등록하는 모듈러 모놀리식 구조
- 백그라운드 스케줄러는 앱 `lifespan`에서 기동/종료

---

## 4. 모듈별 역할

### 4.1 `app/main.py`
- FastAPI 인스턴스 생성, CORS(Vite 오리진 허용)
- 각 기능 라우터 `include_router`
- `lifespan`에서 `init_db()` + 스케줄러 start/shutdown

### 4.2 `app/db.py`
- `get_connection()`: `row_factory=Row`, `PRAGMA foreign_keys=ON`
- `init_db()`: 앱 시작 시 모든 테이블 생성(멱등). 아래 스키마 참조

### 4.3 `app/schedule.py` — 팀 스케줄
- 엔드포인트: 일정 CRUD, 기간/유형/담당자 필터 조회
- 검증: `end_date >= start_date`, `type ∈ {vacation, work, trip, etc}`

### 4.4 `app/excel.py` — 엑셀 분할/병합
- `POST /api/excel/preview`: 업로드 파일의 시트·컬럼 목록 반환
- `POST /api/excel/split`: 기준 컬럼값별 분리 → 다중시트 xlsx 또는 ZIP 스트리밍
- `POST /api/excel/merge`: 다중 업로드 → 헤더 검사 후 행 결합 → xlsx 스트리밍
- 임시파일은 처리 후 즉시 삭제, 결과는 `StreamingResponse`
- pandas로 로드, openpyxl 엔진으로 기록

### 4.5 `app/chatbot.py` — 민원 챗봇 (Claude API)
- `POST /api/chatbot/manuals`: 매뉴얼 업로드/등록(메타·본문 저장)
- `POST /api/chatbot/chat`: 민원 입력 + 선택 매뉴얼 → Claude 호출
- 구현 원칙:
  - Anthropic **Python SDK** 사용, 모델 `claude-opus-4-8`
  - 매뉴얼 본문을 `document` 블록으로 전달, **`citations: {enabled: true}`** 로 근거 인용
  - 큰 매뉴얼은 **프롬프트 캐싱**(`cache_control: ephemeral`)으로 반복 호출 비용 절감
  - **스트리밍**(`messages.stream`)으로 응답 반환(FastAPI `StreamingResponse`/SSE)
  - 시스템 프롬프트: "제공된 매뉴얼에 근거해서만 답하고, 근거가 없으면 '매뉴얼에 근거 없음'이라고 답하라"
  - 멀티턴: 대화 이력을 요청마다 함께 전송(무상태 API)
- 인증: `ANTHROPIC_API_KEY` 환경변수(코드/DB에 저장 금지)

### 4.6 `app/news.py` + `app/scheduler.py` — 뉴스 수집
- `scheduler.py`: APScheduler(`AsyncIOScheduler`) 로 매일 07:00 `collect_news()` 실행
- `collect_news()`: 설정된 소스(RSS)에서 기사 파싱 → 키워드 필터 → URL 중복 제거 → SQLite 저장
- 엔드포인트: 기사 목록 조회, 키워드/기간 필터, `POST /api/news/collect`(수동 실행)
- (선택) `POST /api/news/brief`: 수집 기사들을 Claude로 요약 브리핑

---

## 5. 데이터 모델 (SQLite)

기존 테이블: `notices`, `documents`, `approval_steps` (전자결재).
신규 테이블:

```sql
-- 팀 스케줄
CREATE TABLE schedule_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  type       TEXT    NOT NULL,          -- vacation/work/trip/etc
  start_date TEXT    NOT NULL,          -- YYYY-MM-DD
  end_date   TEXT    NOT NULL,
  owner      TEXT    NOT NULL,
  memo       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 엑셀 처리 이력
CREATE TABLE excel_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type     TEXT    NOT NULL,        -- split/merge
  source_files TEXT    NOT NULL,        -- 쉼표구분 파일명
  key_column   TEXT,                    -- 분할 기준 컬럼(병합은 NULL)
  row_count    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 민원 매뉴얼
CREATE TABLE manuals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  filename   TEXT    NOT NULL,
  content    TEXT    NOT NULL,          -- 추출된 본문(텍스트)
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- (선택) 챗봇 대화 로그
CREATE TABLE chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL,
  role       TEXT    NOT NULL,          -- user/assistant
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 뉴스 기사
CREATE TABLE news_articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  url          TEXT    NOT NULL UNIQUE,   -- 중복 제거 키
  source       TEXT    NOT NULL,
  keyword      TEXT,
  published_at TEXT,
  collected_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
```

---

## 6. API 설계 (요약)

| 기능 | 메서드 · 경로 | 설명 |
|------|---------------|------|
| 스케줄 | `GET /api/schedule` | 일정 목록(필터: type/owner/from/to) |
| | `POST /api/schedule` | 일정 등록 |
| | `PUT /api/schedule/{id}` | 수정 |
| | `DELETE /api/schedule/{id}` | 삭제 |
| 엑셀 | `POST /api/excel/preview` | 시트·컬럼 미리보기 |
| | `POST /api/excel/split` | 컬럼 기준 분할 → 다운로드 |
| | `POST /api/excel/merge` | 다중 파일 병합 → 다운로드 |
| 챗봇 | `POST /api/chatbot/manuals` | 매뉴얼 업로드 |
| | `GET /api/chatbot/manuals` | 매뉴얼 목록 |
| | `POST /api/chatbot/chat` | 민원 응대 생성(스트리밍) |
| 뉴스 | `GET /api/news` | 기사 목록(필터: keyword/기간) |
| | `POST /api/news/collect` | 수동 수집 실행 |
| | `POST /api/news/brief` | (선택) AI 요약 브리핑 |
| 결재 | `GET/POST /api/documents ...` | (기존) 전자결재 |

---

## 7. 의존성 (backend)

`uv add` 로 추가할 패키지:

```
fastapi, uvicorn[standard]      # 웹 (설치됨)
anthropic                       # Claude API
pandas, openpyxl                # 엑셀 처리
apscheduler                     # 스케줄링
httpx, feedparser, beautifulsoup4   # 뉴스 수집
python-multipart                # 파일 업로드(FastAPI)
pypdf                           # 매뉴얼 PDF 텍스트 추출
```

프론트엔드 추가 후보: `react-router-dom`(화면 라우팅). 초기엔 상태 기반 탭으로 대체 가능.

---

## 8. 비기능 · 보안 설계

- **API 키**: `ANTHROPIC_API_KEY`는 환경변수/`.env`로만. Git 커밋 금지(`.gitignore` 반영)
- **개인정보**: 엑셀·매뉴얼·민원은 민감정보 가능 → 임시파일 즉시 삭제, 로그 마스킹
- **외부 호출**: 뉴스 소스·Claude 도메인만 허용(화이트리스트). 수집 요청 간격 준수
- **환각 억제**: 챗봇은 매뉴얼 근거 강제 + Citations로 검증 가능
- **CORS**: 개발 시 Vite 오리진(`localhost:5173`)만 허용
- **에러 처리**: Claude 호출은 `RateLimitError`/`APIStatusError` 등 예외 분기 및 재시도(SDK 기본 백오프)

## 9. 확장 로드맵

1. 계정/권한(SSO), 부서·조직 모델
2. 뉴스 AI 요약 브리핑 정례화(매일 요약 메일/알림)
3. 챗봇 매뉴얼 다중 문서 검색(RAG) 및 Files API 캐싱
4. 전자결재-스케줄 연동(휴가 결재 → 캘린더 자동 반영)
