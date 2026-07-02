import { useEffect, useState } from 'react'
import { newsApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconNews, IconRefresh } from '../../components/icons'
import type { NewsArticle } from '../../types'

// 발행일 문자열(YYYY-MM-DD 등)을 'YYYY-MM-DD'로 표기, 파싱 실패 시 원문
function fmtDate(s?: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 로컬 기준 어제 날짜(YYYY-MM-DD) — 날짜 선택 기본값
function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [date, setDate] = useState(yesterdayStr()) // 수집/조회 대상 날짜
  const [collecting, setCollecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    setArticles(await newsApi.list())
  }

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message))
  }, [])

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

  // target 지정 시 그 날짜, 미지정 시 전날 수집
  async function collect(target?: string) {
    setCollecting(true); setMsg(''); setError('')
    try {
      const r = await newsApi.collect(target)
      setMsg(`수집 완료: ${r.date} · ${r.inserted}건 신규 (스캔 ${r.scanned}건)`)
      if (r.errors.length) setError(`일부 오류: ${r.errors.join(' / ')}`)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={<IconNews />}
        title="뉴스 기사 수집"
        sub="매일 09:00 전날 정책뉴스를 대한민국 정책브리핑(korea.kr)에서 자동 수집합니다. 아래에서 원하는 날짜를 직접 수집할 수도 있습니다."
      />

      <div className="toolbar">
        <button className="btn btn--primary" onClick={() => collect()} disabled={collecting}>
          <IconRefresh size={16} />{collecting ? '수집 중…' : '전날 수집'}
        </button>
        <span className="spacer" />
        <span className="label">날짜 지정</span>
        <input
          type="date"
          value={date}
          max={yesterdayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
        <button className="btn" onClick={() => collect(date)} disabled={collecting || !date}>
          이 날짜 수집
        </button>
        <button className="btn" onClick={refresh} disabled={refreshing}>
          {refreshing ? '불러오는 중…' : '새로고침'}
        </button>
      </div>

      {msg && <div className="alert alert--success">{msg}</div>}
      {error && <div className="alert alert--error">{error}</div>}

      <ul className="list">
        {articles.map((a) => (
          <li key={a.id} className="news-card">
            <a href={a.url} target="_blank" rel="noreferrer" className="news-card__link">
              <div className="news-card__title">{a.title}</div>
              <div className="meta">
                {a.source && <span style={{ marginRight: 8 }}>{a.source}</span>}
                <strong style={{ color: 'var(--ink-2)' }}>{fmtDate(a.published_at) ?? '발행일 미상'}</strong>
                <span style={{ color: 'var(--muted)' }}> (수집 {a.collected_at})</span>
              </div>
            </a>
          </li>
        ))}
        {articles.length === 0 && <li className="empty">수집된 기사가 없습니다. "전날 수집"을 눌러보세요.</li>}
      </ul>
    </div>
  )
}
