# 프로젝트 인수인계 (Handoff)

> 공공 직군 행정업무 슈퍼앱 — 진행 상황 스냅샷
> 최종 갱신: 2026-07-01

## 1. 개요
공공기관 행정 실무자의 반복 업무를 한 곳에서 처리하는 웹 슈퍼앱.
5개 기능(팀 스케줄 / 엑셀 자동화 / 민원 챗봇 / 뉴스 수집 / 전자결재)을 제공한다.

- **저장소**: https://github.com/KiryunKang/day3_rpa (Private, 브랜치 `main`)
- **문서**: `docs/`(PRD·architecture·operation) + `docs/index.html`(종합 대시보드)

## 2. 기술 스택
| 영역 | 스택 |
|------|------|
| Frontend | TypeScript + Vite + React (글래스모피즘 UI, Noto Sans, 라인 SVG 아이콘, 사이드바 셸) |
| Backend | Python + FastAPI (패키지 관리 **uv**) |
| DB | SQLite (`backend/app.db`, 자동 생성) |
| AI | **OpenAI** (`gpt-4o-mini`, `chat.completions`) — 민원 챗봇 |
| 부가 | pandas·openpyxl(엑셀), APScheduler(뉴스), httpx·BeautifulSoup(정책브리핑 크롤링), python-dotenv(.env), pypdf(매뉴얼) |

- 개발환경: Node v24 / npm 11 / uv 0.11(Python 3.14) / Chrome(스크린샷용)

## 3. 실행 방법
```powershell
# 백엔드 (터미널 1)
cd backend
uv sync                 # 최초 1회
uv run python main.py   # http://127.0.0.1:8000  (문서 /docs, 자동 리로드)

# 프론트엔드 (터미널 2)
cd frontend
npm install             # 최초 1회
npm run dev             # http://localhost:5173
```
- 포트 충돌 시: `Get-NetTCPConnection -LocalPort 8000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`
- Vite 프록시로 `/api` → 8000 전달.

### 환경변수 (민원 챗봇용)
`backend/.env`(git 제외, 자동 로드)에 설정:
```
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o   (선택, 기본 gpt-4o-mini)
```
키가 없으면 챗봇만 503 안내, 나머지 4개 기능은 정상 동작.
템플릿: `backend/.env.example`.

## 4. 프로젝트 구조
```
day3_rpa/
├── docs/                 # PRD/architecture/operation + index.html + screenshots/
├── handoff.md            # (본 문서)
├── frontend/src/
│   ├── App.tsx           # 사이드바 탭 셸 + 연결 상태 배지
│   ├── api.ts, types.ts
│   ├── components/       # icons.tsx, PageHeader.tsx, DocumentForm/DetailView
│   └── features/         # schedule / excel / chatbot / news / approval
├── backend/
│   ├── main.py           # 실행 진입점 (uv run python main.py)
│   ├── .env(.example)
│   └── app/
│       ├── main.py       # FastAPI 앱, CORS, 라우터, lifespan, /api/status
│       ├── db.py         # SQLite 스키마/시드 + db_status()
│       ├── schedule.py, members.py, excel.py, chatbot.py, news.py, scheduler.py, documents.py
└── .claude/skills/git-commit/  # 공유 스킬(git 추적됨)
```

## 5. 기능별 상태
| 기능 | 상태 | 비고 |
|------|------|------|
| 팀 스케줄 | ✅ | **월간(캘린더)/주간(표) 뷰 분리**, 유형 필터, 이벤트 클릭 삭제 |
| └ 팀원 관리 | ✅ | `members` CRUD, 담당자 select, 이름변경 시 일정 담당자 동기화 |
| 엑셀 자동화 | ✅ | 컬럼 기준 분할(시트/ZIP)·병합(헤더검증), 처리 이력 |
| 민원 챗봇 | ✅ | OpenAI, 매뉴얼(PDF/TXT/MD) 근거 응대, "근거 없음" 고지 |
| 뉴스 수집 | ✅ | **대한민국 정책브리핑(korea.kr)** 크롤링, 매일 09:00 전날 자동 + **날짜 지정 수집**, 발행일·부처 표기 |
| 전자결재 | ✅ | 순차 결재선 기안/승인/반려 |
| 시스템 상태 | ✅ | `/api/status`(BE↔DB) + 헤더 연결 배지(FE↔BE) |

## 6. DB 테이블 (SQLite, 앱 시작 시 자동 생성/시드)
`notices`, `documents`, `approval_steps`, `schedule_events`, `members`(시드 5명),
`excel_jobs`, `manuals`, `chat_messages`, `news_articles`, `news_keywords`(시드 5개)

## 7. 주요 API
- 스케줄: `GET/POST /api/schedule`, `PUT/DELETE /api/schedule/{id}`
- 팀원: `GET/POST /api/members`, `PUT/DELETE /api/members/{id}`
- 엑셀: `POST /api/excel/preview·split·merge`, `GET /api/excel/jobs`
- 챗봇: `GET/POST /api/chatbot/manuals`, `POST /api/chatbot/chat`
- 뉴스: `GET /api/news`(`?date=YYYY-MM-DD`), `POST /api/news/collect`(바디 `{date?}`, 미지정 시 전날)
- 결재: `GET/POST /api/documents`, `POST /api/documents/{id}/approve·reject`
- 상태: `GET /api/health`, `GET /api/status`

## 8. 검증 현황
- 백엔드: 스케줄·팀원·엑셀(TestClient)·뉴스 수집·챗봇(실제 OpenAI 응답)·상태 API 런타임 E2E 통과
- 프론트: 타입체크·빌드 통과, 5개 탭 + 스케줄 월간/주간/팀원관리 스크린샷 시각 검증 완료
- 뉴스 실수집 확인(구글 RSS), 챗봇 매뉴얼 근거 응답 확인

## 9. 알려진 한계 / 다음 작업(TODO)
- [ ] **일정 수정**: 현재 "클릭 삭제 후 재등록" 방식 → 셀 클릭 인라인/모달 편집 필요(SCH-5)
- [ ] 챗봇 **근거 인용(citations)**: OpenAI 네이티브 미지원으로 현재 빈 배열 → 인용 방식 별도 구현 여지
- [ ] 챗봇 **스트리밍 응답**(현재 비스트리밍 JSON)
- [ ] 뉴스 **AI 요약 브리핑**(`/api/news/brief`) 미구현(선택 기능)
- [ ] 뉴스 소스(RSS) 자체도 편집 가능하게 확장 여지
- [ ] 인증/권한(SSO), 조직 모델 — 현재 이름 기반 식별
- [ ] 스크린샷 PNG 5장(약 4MB) 저장소 포함 — webp 등 경량화 여지
- [ ] 운영 시 뉴스 스케줄러는 서버 상시 구동 필요(서비스/데몬화)

## 10. 참고 메모
- `uv run dev`는 동작하지 않음(설치형 패키지 아님) → **`uv run python main.py`** 사용.
- `.env`는 `python-dotenv`로 `backend/.env` 자동 로드(app/main.py 최상단).
- `.claude/`는 로컬 설정이라 git 제외, 단 **`.claude/skills/`만 예외로 추적**(팀 공유 스킬).
- 한글 POST 테스트는 Git Bash `curl -d`에서 UTF-8이 깨지므로 **PowerShell UTF-8 바이트** 방식 사용.
- 커밋 규칙: 작업 단위로 커밋, 메시지 한국어 요약 + Co-Authored-By.
