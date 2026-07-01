import { useEffect, useState } from 'react'
import { chatbotApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconChat, IconPaperclip } from '../../components/icons'
import type { ChatTurn, Citation, Manual } from '../../types'

interface Msg extends ChatTurn {
  citations?: Citation[]
}

export function ChatbotPage() {
  const [manuals, setManuals] = useState<Manual[]>([])
  const [manualId, setManualId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')

  async function reloadManuals() {
    const list = await chatbotApi.listManuals()
    setManuals(list)
    if (list.length && manualId === null) setManualId(list[0].id)
  }

  useEffect(() => {
    reloadManuals().catch((e) => setError(e.message))
  }, [])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    try {
      const m = await chatbotApi.uploadManual(file, title)
      setFile(null); setTitle('')
      await reloadManuals()
      setManualId(m.id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || manualId === null) return
    const next: Msg[] = [...messages, { role: 'user', content: input }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const turns: ChatTurn[] = next.map((m) => ({ role: m.role, content: m.content }))
      const res = await chatbotApi.chat(manualId, turns)
      setMessages([...next, { role: 'assistant', content: res.reply, citations: res.citations }])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader icon={<IconChat />} title="민원대응 챗봇" sub="등록한 민원 매뉴얼을 근거로 대응 방식·응대 스크립트를 생성합니다." />

      <div className="card">
        <h3 className="section-title">매뉴얼 관리</h3>
        <form onSubmit={upload} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <input style={{ width: 'auto', flex: 1, minWidth: 160 }} placeholder="제목 (선택)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn" disabled={!file}>업로드</button>
        </form>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0 }}>사용 매뉴얼</label>
          <select
            style={{ width: 'auto', minWidth: 200 }}
            value={manualId ?? ''}
            onChange={(e) => { setManualId(Number(e.target.value)); setMessages([]) }}
          >
            <option value="" disabled>선택</option>
            {manuals.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ minHeight: 240, display: 'grid', gap: 12, alignContent: 'start' }}>
          {messages.length === 0 && <div className="empty">민원 상황을 입력하면 매뉴얼 근거 응대 스크립트를 생성합니다.</div>}
          {messages.map((m, i) => (
            <div key={i} style={{ justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '86%' }}>
              <div style={{
                background: m.role === 'user' ? 'var(--brand)' : 'var(--surface-2)',
                color: m.role === 'user' ? '#fff' : 'var(--ink)',
                border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                borderRadius: 12, padding: '10px 14px', whiteSpace: 'pre-wrap', fontSize: 14,
              }}>
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <details style={{ marginTop: 5, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <summary style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPaperclip size={13} /> 근거 {m.citations.length}건</summary>
                  <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                    {m.citations.map((c, j) => <li key={j}>“{c.cited_text}”</li>)}
                  </ul>
                </details>
              )}
            </div>
          ))}
          {busy && <div className="empty">응답 생성 중…</div>}
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            placeholder="예: 주민등록등본 대리 발급 문의 응대"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={manualId === null}
          />
          <button type="submit" className="btn btn--primary" disabled={busy || manualId === null}>전송</button>
        </form>
        {manualId === null && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>먼저 매뉴얼을 업로드/선택하세요.</p>}
      </div>
    </div>
  )
}
