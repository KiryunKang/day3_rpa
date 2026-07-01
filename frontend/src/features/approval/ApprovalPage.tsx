import { useEffect, useState } from 'react'
import { api } from '../../api'
import { DocumentForm } from '../../components/DocumentForm'
import { DocumentDetailView } from '../../components/DocumentDetailView'
import { PageHeader } from '../../components/PageHeader'
import { IconDoc, IconPlus } from '../../components/icons'
import { STATUS_COLOR, STATUS_LABEL } from '../../types'
import type { DocumentDetail, DocumentSummary } from '../../types'

type View =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'detail'; doc: DocumentDetail }

export function ApprovalPage() {
  const [view, setView] = useState<View>({ name: 'list' })
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      setDocs(await api.listDocuments())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (view.name === 'list') reload()
  }, [view.name])

  async function openDoc(id: number) {
    const doc = await api.getDocument(id)
    setView({ name: 'detail', doc })
  }

  return (
    <div>
      <PageHeader icon={<IconDoc />} title="전자결재" sub="결재선을 지정해 문서를 상신하고, 순차적으로 승인/반려합니다." />

      {view.name === 'list' && (
        <>
          <div className="toolbar">
            <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{loading ? '불러오는 중…' : `총 ${docs.length}건`}</span>
            <span className="spacer" />
            <button className="btn btn--primary" onClick={() => setView({ name: 'new' })}><IconPlus size={16} />새 문서 기안</button>
          </div>

          <ul className="list">
            {docs.map((d) => (
              <li key={d.id} className="row-card clickable" onClick={() => openDoc(d.id)}>
                <div>
                  <strong>{d.title}</strong>
                  <div className="meta">기안자 {d.drafter} · {d.created_at}</div>
                </div>
                <span className="badge" style={{ background: STATUS_COLOR[d.status], color: '#fff' }}>{STATUS_LABEL[d.status]}</span>
              </li>
            ))}
            {!loading && docs.length === 0 && <li className="empty">기안된 문서가 없습니다.</li>}
          </ul>
        </>
      )}

      {view.name === 'new' && (
        <DocumentForm
          onCreated={(doc) => setView({ name: 'detail', doc })}
          onCancel={() => setView({ name: 'list' })}
        />
      )}

      {view.name === 'detail' && (
        <DocumentDetailView
          doc={view.doc}
          onChange={(doc) => setView({ name: 'detail', doc })}
          onBack={() => setView({ name: 'list' })}
        />
      )}
    </div>
  )
}
