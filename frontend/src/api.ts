import type {
  ChatResponse,
  ChatTurn,
  DocumentDetail,
  DocumentSummary,
  ExcelPreview,
  Manual,
  Member,
  NewsArticle,
  ScheduleEvent,
  SystemStatus,
} from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* 본문 없음 */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  listDocuments: (status?: string) =>
    request<DocumentSummary[]>(
      '/api/documents' + (status ? `?status=${status}` : ''),
    ),

  getDocument: (id: number) => request<DocumentDetail>(`/api/documents/${id}`),

  createDocument: (body: {
    title: string
    content: string
    drafter: string
    approvers: string[]
  }) =>
    request<DocumentDetail>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  approve: (id: number, approver: string, comment: string) =>
    request<DocumentDetail>(`/api/documents/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approver, comment }),
    }),

  reject: (id: number, approver: string, comment: string) =>
    request<DocumentDetail>(`/api/documents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ approver, comment }),
    }),
}

// 에러 메시지 추출 (multipart/blob 응답 공용)
async function errorMessage(res: Response): Promise<string> {
  try {
    return (await res.json()).detail ?? res.statusText
  } catch {
    return res.statusText
  }
}

// Blob 응답을 브라우저 다운로드로 저장
async function downloadResponse(res: Response, fallbackName: string) {
  if (!res.ok) throw new Error(await errorMessage(res))
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? decodeURIComponent(match[1]) : fallbackName
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// ---------- 시스템 상태 (연동 확인) ----------
export const systemApi = {
  status: () => request<SystemStatus>('/api/status'),
}

// ---------- 팀 스케줄 ----------
export const scheduleApi = {
  list: (params: { type?: string; owner?: string; start?: string; end?: string } = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString()
    return request<ScheduleEvent[]>('/api/schedule' + (q ? `?${q}` : ''))
  },
  create: (body: Omit<ScheduleEvent, 'id' | 'created_at'>) =>
    request<ScheduleEvent>('/api/schedule', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: Omit<ScheduleEvent, 'id' | 'created_at'>) =>
    request<ScheduleEvent>(`/api/schedule/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: number) =>
    fetch(`/api/schedule/${id}`, { method: 'DELETE' }).then(async (r) => {
      if (!r.ok) throw new Error(await errorMessage(r))
    }),
}

// ---------- 팀원 ----------
export const memberApi = {
  list: () => request<Member[]>('/api/members'),
  create: (body: { name: string; team: string; role: string }) =>
    request<Member>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: number, body: { name: string; team: string; role: string }) =>
    request<Member>(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: number) =>
    fetch(`/api/members/${id}`, { method: 'DELETE' }).then(async (r) => {
      if (!r.ok) throw new Error(await errorMessage(r))
    }),
}

// ---------- 엑셀 ----------
export const excelApi = {
  preview: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/excel/preview', { method: 'POST', body: fd }).then(async (r) => {
      if (!r.ok) throw new Error(await errorMessage(r))
      return r.json() as Promise<ExcelPreview>
    })
  },
  split: async (file: File, keyColumn: string, output: 'sheets' | 'zip') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('key_column', keyColumn)
    fd.append('output', output)
    const res = await fetch('/api/excel/split', { method: 'POST', body: fd })
    await downloadResponse(res, output === 'zip' ? 'split.zip' : 'split.xlsx')
  },
  merge: async (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    const res = await fetch('/api/excel/merge', { method: 'POST', body: fd })
    await downloadResponse(res, 'merged.xlsx')
  },
}

// ---------- 챗봇 ----------
export const chatbotApi = {
  listManuals: () => request<Manual[]>('/api/chatbot/manuals'),
  uploadManual: (file: File, title: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    return fetch('/api/chatbot/manuals', { method: 'POST', body: fd }).then(async (r) => {
      if (!r.ok) throw new Error(await errorMessage(r))
      return r.json() as Promise<Manual>
    })
  },
  chat: (manualId: number, messages: ChatTurn[]) =>
    request<ChatResponse>('/api/chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({ manual_id: manualId, messages }),
    }),
}

// ---------- 뉴스 (대한민국 정책브리핑 날짜별 수집) ----------
export const newsApi = {
  list: (date?: string) =>
    request<NewsArticle[]>('/api/news' + (date ? `?date=${encodeURIComponent(date)}` : '')),
  // date 미지정(null) 시 서버가 전날을 수집
  collect: (date?: string) =>
    request<{ date: string; scanned: number; inserted: number; errors: string[] }>(
      '/api/news/collect',
      { method: 'POST', body: JSON.stringify({ date: date ?? null }) },
    ),
}
