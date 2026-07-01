import { useEffect, useState } from 'react'
import { newsApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconNews, IconRefresh } from '../../components/icons'
import type { NewsArticle } from '../../types'

// RSS 발행일(RFC822/GMT 등)을 'YYYY-MM-DD HH:mm'로 포맷
function fmtDate(s?: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [newKw, setNewKw] = useState('')
  const [showKw, setShowKw] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    setArticles(await newsApi.list(filter || undefined))
  }

  async function loadKeywords() {
    setKeywords((await newsApi.keywords()).keywords)
  }

  useEffect(() => {
    loadKeywords().catch(() => {})
  }, [])

  useEffect(() => {
    reload().catch((e) => setError(e.message))
  }, [filter])

  async function refresh() {
    setRefreshing(true); setMsg(''); setError('')
    try {
      await reload()
      setMsg('목록을 새로고침했습니다.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  async function collect() {
    setCollecting(true); setMsg(''); setError('')
    try {
      const r = await newsApi.collect()
      setMsg(`수집 완료: ${r.inserted}건 신규 (스캔 ${r.scanned}건)`)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCollecting(false)
    }
  }

  async function addKeyword(e: React.FormEvent) {
    e.preventDefault()
    const kw = newKw.trim()
    if (!kw) return
    setError('')
    try {
      const r = await newsApi.addKeyword(kw)
      setKeywords(r.keywords)
      setNewKw('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function removeKeyword(kw: string) {
    setError('')
    try {
      const r = await newsApi.removeKeyword(kw)
      setKeywords(r.keywords)
      if (filter === kw) setFilter('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader icon={<IconNews />} title="뉴스 기사 수집" sub="공공 행정 관련 뉴스를 매일 07:00 자동 수집합니다. 수집은 서버가 구글 뉴스 RSS에서 가져옵니다." />

      <div className="toolbar">
        <button className="btn btn--primary" onClick={collect} disabled={collecting}>
          <IconRefresh size={16} />{collecting ? '수집 중…' : '지금 수집'}
        </button>
        <button className="btn" onClick={refresh} disabled={refreshing}>
          {refreshing ? '불러오는 중…' : '새로고침'}
        </button>
        <span className="spacer" />
        <button className={'btn' + (showKw ? ' btn--primary' : '')} onClick={() => setShowKw((v) => !v)}>
          키워드 관리 {showKw ? '▲' : '▾'}
        </button>
      </div>

      {showKw && (
      <div className="card">
        <h3 className="section-title">키워드 관리</h3>
        <form onSubmit={addKeyword} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ flex: 1 }} placeholder="추가할 키워드 (예: 지방재정)" value={newKw} onChange={(e) => setNewKw(e.target.value)} />
          <button type="submit" className="btn btn--primary" disabled={!newKw.trim()}>추가</button>
        </form>
        <div className="kw-list">
          {keywords.map((k) => (
            <span key={k} className="kw-chip">
              #{k}
              <button className="kw-chip__del" title="삭제" onClick={() => removeKeyword(k)}>×</button>
            </span>
          ))}
          {keywords.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>등록된 키워드가 없습니다.</span>}
        </div>
      </div>
      )}

      <div className="toolbar" style={{ marginTop: 18 }}>
        <span className="label">필터</span>
        <button className={'chip' + (filter === '' ? ' active' : '')} onClick={() => setFilter('')}>전체</button>
        {keywords.map((k) => (
          <button key={k} className={'chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>

      {msg && <div className="alert alert--success">{msg}</div>}
      {error && <div className="alert alert--error">{error}</div>}

      <ul className="list">
        {articles.map((a) => (
          <li key={a.id} className="news-card">
            <a href={a.url} target="_blank" rel="noreferrer" className="news-card__link">
              <div className="news-card__title">{a.title}</div>
              <div className="meta">
                {a.keyword && <span className="badge badge--kw" style={{ marginRight: 8 }}>#{a.keyword}</span>}
                {a.source && <span style={{ marginRight: 8 }}>{a.source}</span>}
                <strong style={{ color: 'var(--ink-2)' }}>{fmtDate(a.published_at) ?? '발행일 미상'}</strong>
                <span style={{ color: 'var(--muted)' }}> (수집 {a.collected_at})</span>
              </div>
            </a>
          </li>
        ))}
        {articles.length === 0 && <li className="empty">수집된 기사가 없습니다. "지금 수집"을 눌러보세요.</li>}
      </ul>
    </div>
  )
}
