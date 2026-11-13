export const ADMIN_TOKEN_KEY = 'yxd_admin_token'
export const ADMIN_INFO_KEY = 'yxd_admin_info'

export function getAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

export function setAdminSession(token: string, admin: { id: string; username: string; role: string; isImmutable: boolean }) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
  localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(admin))
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(ADMIN_INFO_KEY)
}

export function getAdminInfo(): { id: string; username: string; role: string; isImmutable: boolean } | null {
  try {
    const raw = localStorage.getItem(ADMIN_INFO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken()
  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('X-Admin-Token', token)
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401 && !url.includes('/api/admin/login')) {
    clearAdminSession()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login'
    }
  }
  return res
}
