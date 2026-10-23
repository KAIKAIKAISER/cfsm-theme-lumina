const API_BASE_META_NAME = 'apiBase'

export const STORAGE_KEYS = {
  JWT_TOKEN: 'jwt_token',
  TURNSTILE_TOKEN: 'turnstile_token',
  TURNSTILE_VERIFIED: 'turnstile_verified',
  THEME_PREFS: 'lumina_theme_prefs_v1',
  LANGUAGE: 'cfsm_lang_pref',
  APPEARANCE: 'cfsm_appearance_pref'
}

let cachedBases = null

function stripTrailingSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function normalizeOrigin(raw) {
  const cleaned = stripTrailingSlash(raw)
  if (!cleaned) return ''
  try {
    return stripTrailingSlash(new URL(cleaned, window.location.href).origin)
  } catch {
    return ''
  }
}

export function getApiBases() {
  if (cachedBases) return cachedBases
  if (typeof document !== 'undefined') {
    const meta = document.querySelector(`meta[name="${API_BASE_META_NAME}"]`)
    const content = meta?.getAttribute('content')?.trim() || ''
    if (content) {
      const parsed = Array.from(
        new Set(
          content
            .split(',')
            .map(item => normalizeOrigin(item))
            .filter(Boolean)
        )
      )
      if (parsed.length > 0) {
        cachedBases = parsed
        return cachedBases
      }
    }
  }
  const fallback = typeof window !== 'undefined' ? stripTrailingSlash(window.location.origin) : ''
  cachedBases = [fallback]
  return cachedBases
}

export function getPrimaryApiBase() {
  const bases = getApiBases()
  return bases[0] || (typeof window !== 'undefined' ? stripTrailingSlash(window.location.origin) : '')
}

export function isSameHostBase(base) {
  if (typeof window === 'undefined') return true
  try {
    const target = new URL(base || window.location.origin, window.location.origin)
    return target.host === window.location.host
  } catch {
    return true
  }
}

export function getPublicAssetUrl(relativePath, base = '') {
  const cleanRel = String(relativePath || '').replace(/^\/+/, '')
  const targetBase = stripTrailingSlash(base || getPrimaryApiBase())
  if (!targetBase || isSameHostBase(targetBase)) {
    return `/${cleanRel}`
  }
  return `${targetBase}/${cleanRel}`
}

export function getAdminEntryUrl(base = '') {
  const targetBase = stripTrailingSlash(base || getPrimaryApiBase())
  if (!targetBase || isSameHostBase(targetBase)) {
    return '/admin#/admin'
  }
  return `${targetBase}/admin#/admin`
}

export function getStaticSiteTitle() {
  if (typeof document === 'undefined') return ''
  const meta = document.querySelector('meta[name="siteTitle"]')
  return meta?.getAttribute('content')?.trim() || ''
}

export function readStorage(key) {
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

export function writeStorage(key, value) {
  try {
    if (value !== undefined && value !== null && value !== '') {
      window.localStorage.setItem(key, String(value))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // ignore storage errors in private browsing
  }
}

export function getJwtToken() {
  return readStorage(STORAGE_KEYS.JWT_TOKEN)
}

export function clearJwtToken() {
  writeStorage(STORAGE_KEYS.JWT_TOKEN, '')
}

export function getTurnstileToken() {
  return readStorage(STORAGE_KEYS.TURNSTILE_TOKEN)
}

export function setTurnstileToken(token) {
  writeStorage(STORAGE_KEYS.TURNSTILE_TOKEN, token)
}

export function getTurnstileVerified() {
  return readStorage(STORAGE_KEYS.TURNSTILE_VERIFIED)
}

export function setTurnstileVerified(verified) {
  writeStorage(STORAGE_KEYS.TURNSTILE_VERIFIED, verified)
  if (verified) {
    writeStorage(STORAGE_KEYS.TURNSTILE_TOKEN, '')
  }
}

export function clearTurnstileCredentials() {
  writeStorage(STORAGE_KEYS.TURNSTILE_TOKEN, '')
  writeStorage(STORAGE_KEYS.TURNSTILE_VERIFIED, '')
}

export function buildWebSocketUrl(base, subscribe = 'all') {
  const targetBase = stripTrailingSlash(base || getPrimaryApiBase()) || window.location.origin
  const parsed = new URL('/api/ws', targetBase)
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.searchParams.set('subscribe', subscribe)

  if (!isSameHostBase(targetBase)) {
    const token = getJwtToken()
    if (token) {
      parsed.searchParams.set('token', token)
    }
  }
  return parsed.toString()
}
