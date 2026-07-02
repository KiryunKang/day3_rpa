import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { systemApi } from './api'
import { getApiBase, setApiBase, testConnection } from './config'
import type { SystemStatus } from './types'
import {
  IconCalendar, IconGrid, IconChat, IconNews, IconDoc, IconLandmark,
} from './components/icons'
import { SchedulePage } from './features/schedule/SchedulePage'
import { ExcelPage } from './features/excel/ExcelPage'
import { ChatbotPage } from './features/chatbot/ChatbotPage'
import { NewsPage } from './features/news/NewsPage'
import { ApprovalPage } from './features/approval/ApprovalPage'

type TabKey = 'schedule' | 'excel' | 'chatbot' | 'news' | 'approval'

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: 'schedule', label: '팀 스케줄', icon: <IconCalendar size={20} /> },
  { key: 'excel', label: '엑셀 자동화', icon: <IconGrid size={20} /> },
  { key: 'chatbot', label: '민원 챗봇', icon: <IconChat size={20} /> },
  { key: 'news', label: '뉴스 수집', icon: <IconNews size={20} /> },
  { key: 'approval', label: '전자결재', icon: <IconDoc size={20} /> },
]

function ConnectionBadge({ refreshKey }: { refreshKey: number }) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false); setStatus(null)
    systemApi.status().then(setStatus).catch(() => setFailed(true))
  }, [refreshKey])

  const ok = status?.db.connected
  const color = failed ? '#f87171' : ok ? '#4ade80' : '#facc15'
  const tableCount = status ? Object.keys(status.db.tables ?? {}).length : 0
  const label = failed ? '백엔드 연결 실패' : ok ? '정상 연결됨' : '확인 중…'

  return (
    <div className="status-badge" title={status ? `${status.db.engine} · ${status.db.path}` : ''}>
      <span className="dot" style={{ background: color }} />
      <div>
        <strong>{label}</strong>
        {ok && <span>SQLite · {tableCount}개 테이블</span>}
      </div>
    </div>
  )
}

// 백엔드 연결 URL 설정 + 연결 테스트
function ConnectionSettings({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState(getApiBase())
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function test() {
    setTesting(true); setResult(null)
    const r = await testConnection(url)
    setResult({ ok: r.ok, text: r.ok ? `연결 성공 · ${r.ms}ms` : `실패: ${r.message}` })
    setTesting(false)
  }

  function save() {
    setApiBase(url)
    onSaved()
    location.reload() // 모든 화면이 새 주소로 재요청하도록 새로고침
  }

  return (
    <div className="conn-settings">
      <label className="conn-settings__label">백엔드 서버 URL</label>
      <input
        className="conn-settings__input"
        placeholder="https://xxx.trycloudflare.com (비우면 상대경로)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="conn-settings__row">
        <button className="btn" onClick={test} disabled={testing}>
          {testing ? '테스트 중…' : '연결 테스트'}
        </button>
        <button className="btn btn--primary" onClick={save}>저장 후 적용</button>
      </div>
      {result && (
        <div style={{ fontSize: 12, marginTop: 6, color: result.ok ? '#16a34a' : '#dc2626' }}>
          {result.ok ? '✓ ' : '✗ '}{result.text}
        </div>
      )}
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<TabKey>('schedule')
  const [showSettings, setShowSettings] = useState(false)
  const [badgeKey, setBadgeKey] = useState(0)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="logo"><IconLandmark size={22} /></span>
          <span>공공 행정업무<br />슈퍼앱</span>
        </div>
        <nav className="sidebar__nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={'nav-item' + (tab === t.key ? ' active' : '')}
              onClick={() => setTab(t.key)}
            >
              <span className="ico">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <ConnectionBadge refreshKey={badgeKey} />
          <button
            className={'btn' + (showSettings ? ' btn--primary' : '')}
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => setShowSettings((v) => !v)}
          >
            ⚙ 백엔드 설정 {showSettings ? '▲' : '▾'}
          </button>
          {showSettings && <ConnectionSettings onSaved={() => setBadgeKey((k) => k + 1)} />}
        </div>
      </aside>

      <main className="main">
        <div className="content">
          {tab === 'schedule' && <SchedulePage />}
          {tab === 'excel' && <ExcelPage />}
          {tab === 'chatbot' && <ChatbotPage />}
          {tab === 'news' && <NewsPage />}
          {tab === 'approval' && <ApprovalPage />}
        </div>
      </main>
    </div>
  )
}

export default App
