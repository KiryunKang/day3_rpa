import { useEffect, useMemo, useState } from 'react'
import { scheduleApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconCalendar } from '../../components/icons'
import { SCHEDULE_COLOR, SCHEDULE_LABEL } from '../../types'
import type { ScheduleEvent, ScheduleType } from '../../types'

const TYPES: ScheduleType[] = ['vacation', 'work', 'trip', 'etc']
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [filter, setFilter] = useState<ScheduleType | ''>('')
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [error, setError] = useState('')

  // 등록 폼
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ScheduleType>('vacation')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [owner, setOwner] = useState('')
  const [memo, setMemo] = useState('')

  // 표시 그리드 범위(6주) 계산
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const startGrid = new Date(first)
    startGrid.setDate(1 - first.getDay()) // 그 주 일요일로
    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(startGrid)
      d.setDate(startGrid.getDate() + i)
      days.push(d)
    }
    return { first, days, startStr: fmt(days[0]), endStr: fmt(days[41]) }
  }, [cursor])

  async function reload() {
    // 캘린더는 표시 범위, 목록은 전체(필터만)
    const params = view === 'calendar'
      ? { start: grid.startStr, end: grid.endStr, ...(filter ? { type: filter } : {}) }
      : (filter ? { type: filter } : {})
    setEvents(await scheduleApi.list(params))
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, view, grid.startStr])

  const visible = filter ? events.filter((e) => e.type === filter) : events

  function eventsOn(dayStr: string) {
    return visible.filter((e) => e.start_date <= dayStr && dayStr <= e.end_date)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await scheduleApi.create({ title, type, start_date: start, end_date: end, owner, memo })
      setTitle(''); setStart(''); setEnd(''); setOwner(''); setMemo('')
      await reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(id: number) {
    await scheduleApi.remove(id)
    await reload()
  }

  function pickDay(dayStr: string) {
    setStart(dayStr)
    setEnd((prev) => (prev && prev >= dayStr ? prev : dayStr))
  }

  const todayStr = fmt(new Date())
  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`

  return (
    <div>
      <PageHeader icon={<IconCalendar />} title="팀 스케줄" sub="팀원의 휴가·근무·출장 일정을 달력에서 한눈에 확인합니다." />

      <div className="toolbar">
        <button className={'chip' + (view === 'calendar' ? ' active' : '')} onClick={() => setView('calendar')}>캘린더</button>
        <button className={'chip' + (view === 'list' ? ' active' : '')} onClick={() => setView('list')}>목록</button>
        <span className="spacer" />
        <span className="label">유형</span>
        <button className={'chip' + (filter === '' ? ' active' : '')} onClick={() => setFilter('')}>전체</button>
        {TYPES.map((t) => (
          <button key={t} className={'chip' + (filter === t ? ' active' : '')} onClick={() => setFilter(t)}>{SCHEDULE_LABEL[t]}</button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {view === 'calendar' && (
        <div className="card">
          <div className="cal-head">
            <button className="cal-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
            <div className="cal-title">{monthLabel}</div>
            <button className="cal-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
            <button className="btn btn--sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}>오늘</button>
          </div>

          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid">
            {grid.days.map((d) => {
              const ds = fmt(d)
              const inMonth = d.getMonth() === cursor.getMonth()
              const dayEvents = eventsOn(ds)
              const cls = ['cal-cell']
              if (!inMonth) cls.push('out')
              if (ds === todayStr) cls.push('today')
              if (d.getDay() === 0) cls.push('sun')
              if (d.getDay() === 6) cls.push('sat')
              return (
                <div key={ds} className={cls.join(' ')} onClick={() => pickDay(ds)} title="클릭하면 등록 폼에 날짜가 채워집니다">
                  <div className="cal-daynum">{d.getDate()}</div>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div key={ev.id} className="cal-event" style={{ background: SCHEDULE_COLOR[ev.type] }} title={`${ev.owner} · ${SCHEDULE_LABEL[ev.type]} · ${ev.title}`}>
                      {ev.owner} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="cal-more">+{dayEvents.length - 3}건</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <ul className="list">
          {visible.map((ev) => (
            <li key={ev.id} className="row-card">
              <div>
                <span className="badge" style={{ background: SCHEDULE_COLOR[ev.type], color: '#fff', marginRight: 8 }}>{SCHEDULE_LABEL[ev.type]}</span>
                <strong>{ev.title}</strong>
                <div className="meta">{ev.owner} · {ev.start_date} ~ {ev.end_date}{ev.memo ? ` · ${ev.memo}` : ''}</div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => remove(ev.id)}>삭제</button>
            </li>
          ))}
          {visible.length === 0 && <li className="empty">등록된 일정이 없습니다.</li>}
        </ul>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">일정 등록</h3>
        <form onSubmit={add} style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div className="field"><label>제목</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 연차 휴가" /></div>
          <div className="field"><label>유형</label>
            <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
              {TYPES.map((t) => <option key={t} value={t}>{SCHEDULE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field"><label>시작일</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label>종료일</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="field"><label>담당자</label><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="이름" /></div>
          <div className="field"><label>메모 (선택)</label><input value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
          <button type="submit" className="btn btn--primary" style={{ gridColumn: '1 / -1' }}>일정 등록</button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 10 }}>달력의 날짜를 클릭하면 시작일이 자동으로 채워집니다.</p>
      </div>
    </div>
  )
}
