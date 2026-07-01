import { useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'
import { IconArrowLeft, IconBan, IconCheck, IconClock } from './icons'
import { STATUS_COLOR, STATUS_LABEL } from '../types'
import type { DocumentDetail, StepStatus } from '../types'

interface Props {
  doc: DocumentDetail
  onChange: (doc: DocumentDetail) => void
  onBack: () => void
}

const STEP_MARK: Record<StepStatus, { label: string; color: string; icon: ReactNode }> = {
  pending: { label: '대기', color: 'var(--muted)', icon: <IconClock size={15} /> },
  approved: { label: '승인', color: 'var(--green)', icon: <IconCheck size={15} /> },
  rejected: { label: '반려', color: 'var(--red)', icon: <IconBan size={15} /> },
}

export function DocumentDetailView({ doc, onChange, onBack }: Props) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const currentStep = doc.steps.find((s) => s.status === 'pending')

  async function act(kind: 'approve' | 'reject') {
    if (!currentStep) return
    setBusy(true)
    setError('')
    try {
      const fn = kind === 'approve' ? api.approve : api.reject
      const updated = await fn(doc.id, currentStep.approver, comment)
      setComment('')
      onChange(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ justifySelf: 'start' }}><IconArrowLeft size={16} /> 목록으로</button>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{doc.title}</h2>
          <span className="badge" style={{ background: STATUS_COLOR[doc.status], color: '#fff' }}>{STATUS_LABEL[doc.status]}</span>
        </div>
        <div className="meta" style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6 }}>기안자 {doc.drafter} · {doc.created_at}</div>
        <p style={{ whiteSpace: 'pre-wrap', marginTop: 14 }}>{doc.content || '(내용 없음)'}</p>
      </div>

      <div className="card">
        <h3 className="section-title">결재선</h3>
        <ol style={{ display: 'grid', gap: 8, paddingLeft: 20, margin: 0 }}>
          {doc.steps.map((s) => {
            const isCurrent = currentStep?.id === s.id
            const mark = STEP_MARK[s.status]
            return (
              <li key={s.id} style={{
                border: isCurrent ? '2px solid var(--brand)' : '1px solid var(--glass-border)',
                borderRadius: 12, padding: 12, listStylePosition: 'inside',
                background: isCurrent ? 'var(--brand-soft)' : 'rgba(255,255,255,0.4)',
              }}>
                <strong>{s.approver}</strong> — <span className="step-status" style={{ color: mark.color }}>{mark.icon}{mark.label}</span>
                {isCurrent && <span style={{ color: 'var(--brand)' }}> (현재 차례)</span>}
                {s.comment && <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 4 }}>의견: {s.comment}</div>}
                {s.acted_at && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.acted_at}</div>}
              </li>
            )
          })}
        </ol>
      </div>

      {doc.status === 'in_progress' && currentStep && (
        <div className="card">
          <h3 className="section-title">결재 처리 · 현재 차례 {currentStep.approver}</h3>
          <div className="field">
            <label>결재 의견 (선택)</label>
            <textarea rows={2} placeholder="의견을 입력하세요" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <div className="alert alert--error">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn--primary" onClick={() => act('approve')} disabled={busy}>승인</button>
            <button className="btn btn--danger" onClick={() => act('reject')} disabled={busy}>반려</button>
          </div>
        </div>
      )}
    </div>
  )
}
