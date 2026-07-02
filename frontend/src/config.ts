// 백엔드 API 주소를 런타임에 설정/저장 (빌드 없이 UI에서 변경 가능).
// 우선순위: localStorage > 빌드시 VITE_API_BASE > 빈 문자열(상대경로/프록시).

const STORAGE_KEY = 'apiBase'

const strip = (s: string) => s.trim().replace(/\/$/, '')

// 저장된(또는 빌드 주입) 백엔드 베이스 URL. 없으면 '' (상대경로).
export function getApiBase(): string {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) return strip(saved)
  return strip(import.meta.env.VITE_API_BASE ?? '')
}

// 사용자가 입력한 백엔드 URL 저장 (빈 값이면 초기화 → 상대경로/프록시).
export function setApiBase(url: string): void {
  const v = strip(url)
  if (v) localStorage.setItem(STORAGE_KEY, v)
  else localStorage.removeItem(STORAGE_KEY)
}

// 지정 베이스(미지정 시 현재 설정)로 /api/health 연결 테스트. 응답시간(ms) 포함.
export async function testConnection(
  base?: string,
): Promise<{ ok: boolean; status?: number; ms: number; message: string }> {
  const target = strip(base ?? getApiBase())
  const started = performance.now()
  try {
    const res = await fetch(`${target}/api/health`, { method: 'GET' })
    const ms = Math.round(performance.now() - started)
    if (!res.ok) return { ok: false, status: res.status, ms, message: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({}))
    return { ok: true, status: res.status, ms, message: body.service ?? '연결 성공' }
  } catch (e) {
    const ms = Math.round(performance.now() - started)
    return { ok: false, ms, message: (e as Error).message || '연결 실패(네트워크/CORS)' }
  }
}
