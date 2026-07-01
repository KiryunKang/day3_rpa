import { useEffect, useMemo, useState } from 'react'
import { memberApi, scheduleApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconCalendar } from '../../components/icons'
import { SCHEDULE_COLOR, SCHEDULE_LABEL } from '../../types'
import type { Member, ScheduleEvent, ScheduleType } from '../../types'

const TYPES: ScheduleType[] = ['vacation', 'work', 'trip', 'etc']
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function SchedulePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [filter, setFilter] = useState<ScheduleType | ''>('')
  const [view, setView] = useState<'month' | 'week'>('month')
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [weekCursor, setWeekCursor] = useState(() => new Date())
  const [showMembers, setShowMembers] = useState(false)
  const [error, setError] = useState('')

  // 일정 등록 폼
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ScheduleType>('vacation')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [owner, setOwner] = useState('')
  const [memo, setMemo] = useState('')

  const todayStr = fmt(new Date())

  // ----- 월간 그리드 (6주) -----
  const monthGrid = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
    const startGrid = new Date(first)
    startGrid.setDate(1 - first.getDay())
    const days: Date[] = []
    for (let i = 0; i < 42; i++) { const d = new Date(startGrid); d.setDate(startGrid.getDate() + i); days.push(d) }
    return { days, startStr: fmt(days[0]), endStr: fmt(days[41]) }
  }, [monthCursor])

  // ----- 주간 (월~일) -----
  const weekGrid = useMemo(() => {
    const d = new Date(weekCursor)
    const offset = (d.getDay() + 6) % 7 // 월요일 시작
    const monday = new Date(d); monday.setDate(d.getDate() - offset)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) { const x = new Date(monday); x.setDate(monday.getDate() + i); days.push(x) }
    return { days, startStr: fmt(days[0]), endStr: fmt(days[6]) }
  }, [weekCursor])

  const range = view === 'month' ? monthGrid : weekGrid

  async function loadEvents() {
    const params = { start: range.startStr, end: range.endStr, ...(filter ? { type: filter } : {}) }
    setEvents(await scheduleApi.list(params))
  }
  async function loadMembers() {
    const list = await memberApi.list()
    setMembers(list)
    setOwner((prev) => prev || (list[0]?.name ?? ''))
  }

  useEffect(() => { loadMembers().catch((e) => setError(e.message)) }, [])
  useEffect(() => { loadEvents().catch((e) => setError(e.message)) }, [view, range.startStr, filter])

  const visible = filter ? events.filter((e) => e.type === filter) : events
  const eventsOn = (owner: string, dayStr: string) =>
    visible.filter((e) => e.owner === owner && e.start_date <= dayStr && dayStr <= e.end_date)
  const allEventsOn = (dayStr: string) =>
    visible.filter((e) => e.start_date <= dayStr && dayStr <= e.end_date)

  // 주간 표 행: 팀원 + (팀원에 없는 담당자)
  const weekOwners = useMemo(() => {
    const names = members.map((m) => m.name)
    const extra = [...new Set(visible.map((e) => e.owner))].filter((n) => !names.includes(n))
    return [
      ...members.map((m) => ({ name: m.name, sub: [m.team, m.role].filter(Boolean).join(' · ') })),
      ...extra.map((n) => ({ name: n, sub: '(미등록)' })),
    ]
  }, [members, visible])

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await scheduleApi.create({ title, type, start_date: start, end_date: end, owner, memo })
      setTitle(''); setStart(''); setEnd(''); setMemo('')
      await loadEvents()
    } catch (err) { setError((err as Error).message) }
  }
  async function removeEvent(ev: ScheduleEvent) {
    if (!confirm(`'${ev.title}' 일정을 삭제할까요?`)) return
    await scheduleApi.remove(ev.id)
    await loadEvents()
  }

  return (
    <div>
      <PageHeader icon={<IconCalendar />} title="팀 스케줄" sub="팀원 일정을 월간 캘린더와 주간 표로 확인합니다." />

      <div className="toolbar">
        <button className={'chip' + (view === 'month' ? ' active' : '')} onClick={() => setView('month')}>월간</button>
        <button className={'chip' + (view === 'week' ? ' active' : '')} onClick={() => setView('week')}>주간</button>
        <span className="spacer" />
        <span className="label">유형</span>
        <button className={'chip' + (filter === '' ? ' active' : '')} onClick={() => setFilter('')}>전체</button>
        {TYPES.map((t) => (
          <button key={t} className={'chip' + (filter === t ? ' active' : '')} onClick={() => setFilter(t)}>{SCHEDULE_LABEL[t]}</button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* ===== 월간 캘린더 ===== */}
      {view === 'month' && (
        <div className="card">
          <div className="cal-head">
            <button className="cal-nav" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>‹</button>
            <div className="cal-title">{monthCursor.getFullYear()}년 {monthCursor.getMonth() + 1}월</div>
            <button className="cal-nav" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>›</button>
            <button className="btn btn--sm" onClick={() => { const d = new Date(); setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}>오늘</button>
          </div>
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid">
            {monthGrid.days.map((d) => {
              const ds = fmt(d)
              const inMonth = d.getMonth() === monthCursor.getMonth()
              const dayEvents = allEventsOn(ds)
              const cls = ['cal-cell']
              if (!inMonth) cls.push('out')
              if (ds === todayStr) cls.push('today')
              if (d.getDay() === 0) cls.push('sun')
              if (d.getDay() === 6) cls.push('sat')
              return (
                <div key={ds} className={cls.join(' ')} onClick={() => { setStart(ds); setEnd((p) => (p && p >= ds ? p : ds)) }} title="클릭하면 등록 폼 시작일이 채워집니다">
                  <div className="cal-daynum">{d.getDate()}</div>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div key={ev.id} className="cal-event" style={{ background: SCHEDULE_COLOR[ev.type] }}
                      title={`${ev.owner} · ${ev.title} (클릭 삭제)`}
                      onClick={(e) => { e.stopPropagation(); removeEvent(ev) }}>
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

      {/* ===== 주간 표 ===== */}
      {view === 'week' && (
        <div className="card">
          <div className="cal-head">
            <button className="cal-nav" onClick={() => { const d = new Date(weekCursor); d.setDate(d.getDate() - 7); setWeekCursor(d) }}>‹</button>
            <div className="cal-title" style={{ minWidth: 150 }}>{weekGrid.startStr.slice(5)} ~ {weekGrid.endStr.slice(5)}</div>
            <button className="cal-nav" onClick={() => { const d = new Date(weekCursor); d.setDate(d.getDate() + 7); setWeekCursor(d) }}>›</button>
            <button className="btn btn--sm" onClick={() => setWeekCursor(new Date())}>이번 주</button>
          </div>
          <div className="wk-wrap">
            <table className="wk-table">
              <thead>
                <tr>
                  <th className="wk-th" style={{ textAlign: 'left' }}>팀원</th>
                  {weekGrid.days.map((d) => {
                    const ds = fmt(d)
                    const cls = ['wk-th']
                    if (ds === todayStr) cls.push('today')
                    if (d.getDay() === 0) cls.push('sun')
                    if (d.getDay() === 6) cls.push('sat')
                    return <th key={ds} className={cls.join(' ')}>{DOW[d.getDay()]}<small>{d.getMonth() + 1}/{d.getDate()}</small></th>
                  })}
                </tr>
              </thead>
              <tbody>
                {weekOwners.map((o) => (
                  <tr key={o.name}>
                    <td><div className="wk-name"><b>{o.name}</b>{o.sub && <small>{o.sub}</small>}</div></td>
                    {weekGrid.days.map((d) => {
                      const ds = fmt(d)
                      const cellEvents = eventsOn(o.name, ds)
                      return (
                        <td key={ds}>
                          <div className={'wk-cell' + (ds === todayStr ? ' today' : '')}>
                            {cellEvents.map((ev) => (
                              <div key={ev.id} className="wk-ev" style={{ background: SCHEDULE_COLOR[ev.type] }}
                                title={`${SCHEDULE_LABEL[ev.type]} · ${ev.title} (클릭 삭제)`}
                                onClick={() => removeEvent(ev)}>
                                {ev.title}
                              </div>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {weekOwners.length === 0 && <tr><td colSpan={8} className="empty">팀원을 먼저 등록하세요.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 일정 등록 ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">일정 등록</h3>
        <form onSubmit={addEvent} style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div className="field"><label>제목</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 연차 휴가" /></div>
          <div className="field"><label>유형</label>
            <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
              {TYPES.map((t) => <option key={t} value={t}>{SCHEDULE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field"><label>시작일</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label>종료일</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="field"><label>담당자</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.length === 0 && <option value="">팀원을 먼저 등록하세요</option>}
              {members.map((m) => <option key={m.id} value={m.name}>{m.name}{m.team ? ` (${m.team})` : ''}</option>)}
            </select>
          </div>
          <div className="field"><label>메모 (선택)</label><input value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
          <button type="submit" className="btn btn--primary" style={{ gridColumn: '1 / -1' }} disabled={members.length === 0}>일정 등록</button>
        </form>
      </div>

      {/* ===== 팀원 관리 ===== */}
      <div className="toolbar" style={{ marginTop: 16 }}>
        <button className={'btn' + (showMembers ? ' btn--primary' : '')} onClick={() => setShowMembers((v) => !v)}>
          팀원 관리 ({members.length}) {showMembers ? '▲' : '▾'}
        </button>
      </div>
      {showMembers && <MemberManager members={members} onChange={loadMembers} />}
    </div>
  )
}

// ===== 팀원 관리 컴포넌트 =====
function MemberManager({ members, onChange }: { members: Member[]; onChange: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [role, setRole] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  function reset() { setName(''); setTeam(''); setRole(''); setEditingId(null) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    try {
      const body = { name, team, role }
      if (editingId != null) await memberApi.update(editingId, body)
      else await memberApi.create(body)
      reset()
      await onChange()
    } catch (err) { setError((err as Error).message) }
  }
  function startEdit(m: Member) { setEditingId(m.id); setName(m.name); setTeam(m.team); setRole(m.role) }
  async function remove(m: Member) {
    if (!confirm(`팀원 '${m.name}'을(를) 삭제할까요? (기존 일정은 유지됩니다)`)) return
    await memberApi.remove(m.id)
    if (editingId === m.id) reset()
    await onChange()
  }

  return (
    <div className="card">
      <h3 className="section-title">팀원 {editingId != null ? '수정' : '등록'}</h3>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input style={{ flex: '1 1 140px' }} placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ flex: '1 1 120px' }} placeholder="팀 (예: 총무팀)" value={team} onChange={(e) => setTeam(e.target.value)} />
        <input style={{ flex: '1 1 120px' }} placeholder="직급 (예: 주무관)" value={role} onChange={(e) => setRole(e.target.value)} />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>{editingId != null ? '수정' : '추가'}</button>
        {editingId != null && <button type="button" className="btn" onClick={reset}>취소</button>}
      </form>
      {error && <div className="alert alert--error">{error}</div>}
      <div>
        {members.map((m) => (
          <div key={m.id} className="mem-row">
            <span className="mem-name">{m.name}</span>
            <span className="mem-sub">{[m.team, m.role].filter(Boolean).join(' · ') || '—'}</span>
            <span className="spacer" />
            <button className="btn btn--ghost btn--sm" onClick={() => startEdit(m)}>수정</button>
            <button className="btn btn--ghost btn--sm" onClick={() => remove(m)}>삭제</button>
          </div>
        ))}
        {members.length === 0 && <div className="empty">등록된 팀원이 없습니다.</div>}
      </div>
    </div>
  )
}
