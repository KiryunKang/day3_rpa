import { useState } from 'react'
import { excelApi } from '../../api'
import { PageHeader } from '../../components/PageHeader'
import { IconGrid } from '../../components/icons'
import type { ExcelPreview } from '../../types'

export function ExcelPage() {
  return (
    <div>
      <PageHeader icon={<IconGrid />} title="엑셀 업무자동화" sub="특정 컬럼 기준으로 엑셀을 분할하거나 여러 파일을 병합합니다." />
      <SplitSection />
      <MergeSection />
    </div>
  )
}

function SplitSection() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ExcelPreview | null>(null)
  const [keyColumn, setKeyColumn] = useState('')
  const [output, setOutput] = useState<'sheets' | 'zip'>('sheets')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onPick(f: File | null) {
    setFile(f); setPreview(null); setKeyColumn(''); setError('')
    if (!f) return
    try {
      const p = await excelApi.preview(f)
      setPreview(p)
      setKeyColumn(p.columns[0] ?? '')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function run() {
    if (!file || !keyColumn) return
    setBusy(true); setError('')
    try {
      await excelApi.split(file, keyColumn, output)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">분할 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>컬럼 값별로 나누기</span></h3>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

      {preview && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14 }}>파일 <strong>{preview.filename}</strong> · {preview.row_count}행 · 컬럼 {preview.columns.length}개</div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label>기준 컬럼</label>
            <select value={keyColumn} onChange={(e) => setKeyColumn(e.target.value)}>
              {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
              <input type="radio" checked={output === 'sheets'} onChange={() => setOutput('sheets')} /> 단일 파일(값별 시트)
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
              <input type="radio" checked={output === 'zip'} onChange={() => setOutput('zip')} /> ZIP(파일 여러 개)
            </label>
          </div>
          <button className="btn btn--primary" onClick={run} disabled={busy} style={{ justifySelf: 'start' }}>
            {busy ? '처리 중…' : '분할 실행 & 다운로드'}
          </button>
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}
    </div>
  )
}

function MergeSection() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (files.length < 2) { setError('2개 이상 선택하세요.'); return }
    setBusy(true); setError('')
    try {
      await excelApi.merge(files)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">병합 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>여러 파일 → 하나</span></h3>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 10 }}>헤더가 동일한 엑셀들을 행 방향으로 합칩니다.</p>
      <input type="file" accept=".xlsx,.xls" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-2)' }}>{files.length}개 선택: {files.map((f) => f.name).join(', ')}</div>}
      <div style={{ marginTop: 14 }}>
        <button className="btn btn--primary" onClick={run} disabled={busy}>{busy ? '처리 중…' : '병합 실행 & 다운로드'}</button>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
    </div>
  )
}
