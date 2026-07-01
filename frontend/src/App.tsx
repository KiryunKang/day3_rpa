import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { systemApi } from './api'
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

function ConnectionBadge() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    systemApi.status().then(setStatus).catch(() => setFailed(true))
  }, [])

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

function App() {
  const [tab, setTab] = useState<TabKey>('schedule')

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
          <ConnectionBadge />
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
