export type DocStatus = 'draft' | 'in_progress' | 'approved' | 'rejected'
export type StepStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalStep {
  id: number
  step_order: number
  approver: string
  status: StepStatus
  comment: string
  acted_at: string | null
}

export interface DocumentSummary {
  id: number
  title: string
  drafter: string
  status: DocStatus
  created_at: string
}

export interface DocumentDetail extends DocumentSummary {
  content: string
  steps: ApprovalStep[]
}

export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: '임시저장',
  in_progress: '진행중',
  approved: '승인완료',
  rejected: '반려',
}

export const STATUS_COLOR: Record<DocStatus, string> = {
  draft: '#888',
  in_progress: '#2563eb',
  approved: '#16a34a',
  rejected: '#dc2626',
}

// ---------- 팀 스케줄 ----------
export type ScheduleType = 'vacation' | 'work' | 'trip' | 'etc'

export interface ScheduleEvent {
  id: number
  title: string
  type: ScheduleType
  start_date: string
  end_date: string
  owner: string
  memo: string
  created_at: string
}

export const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  vacation: '휴가',
  work: '근무',
  trip: '출장',
  etc: '기타',
}

export const SCHEDULE_COLOR: Record<ScheduleType, string> = {
  vacation: '#16a34a',
  work: '#2563eb',
  trip: '#d97706',
  etc: '#6b7280',
}

// ---------- 엑셀 ----------
export interface ExcelPreview {
  filename: string
  columns: string[]
  row_count: number
  preview: Record<string, string>[]
}

// ---------- 챗봇 ----------
export interface Manual {
  id: number
  title: string
  filename: string
  created_at: string
}

export interface Citation {
  cited_text: string
  start: number | null
  end: number | null
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  citations: Citation[]
}

// ---------- 시스템 상태 (연동 확인) ----------
export interface DbStatus {
  connected: boolean
  engine?: string
  path: string
  tables?: Record<string, number>
  error?: string
}

export interface SystemStatus {
  status: string
  service: string
  db: DbStatus
}

// ---------- 뉴스 ----------
export interface NewsArticle {
  id: number
  title: string
  url: string
  source: string
  keyword: string | null
  published_at: string | null
  collected_at: string
}
