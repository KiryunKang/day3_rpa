import { useState } from 'react'
import { api } from '../api'
import type { DocumentDetail } from '../types'

interface Props {
  onCreated: (doc: DocumentDetail) => void
  onCancel: () => void
}

export function DocumentForm({ onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [drafter, setDrafter] = useState('')
  const [approvers, setApprovers] = useState<string[]>([''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function setApprover(i: number, value: string) {
    setApprovers((prev) => prev.map((a, idx) => (idx === i ? value : a)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const line = approvers.map((a) => a.trim()).filter(Boolean)
    if (!title.trim() || !drafter.trim() || line.length === 0) {
      setError('제목, 기안자, 결재선(1명 이상)은 필수입니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const doc = await api.createDocument({ title, content, drafter, approvers: line })
      onCreated(doc)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">문서 기안</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <div className="field"><label>제목 *</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>기안자 *</label><input value={drafter} onChange={(e) => setDrafter(e.target.value)} /></div>
        <div className="field"><label>내용</label><textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} /></div>

        <div className="field">
          <label>결재선 * (위에서 아래 순서로 결재)</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {approvers.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 22, textAlign: 'right', color: 'var(--muted)', fontSize: 13 }}>{i + 1}.</span>
                <input style={{ flex: 1 }} placeholder="결재자 이름" value={a} onChange={(e) => setApprover(i, e.target.value)} />
                {approvers.length > 1 && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setApprovers((prev) => prev.filter((_, idx) => idx !== i))}>−</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--sm" style={{ justifySelf: 'start', marginTop: 4 }} onClick={() => setApprovers((prev) => [...prev, ''])}>+ 결재자 추가</button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? '상신 중…' : '상신'}</button>
          <button type="button" className="btn" onClick={onCancel}>취소</button>
        </div>
      </form>
    </div>
  )
}
