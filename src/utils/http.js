import {
  getPrimaryApiBase,
  getJwtToken,
  clearJwtToken,
  getTurnstileToken,
  getTurnstileVerified,
  setTurnstileVerified,
  clearTurnstileCredentials
} from './config.js'

const DEFAULT_TIMEOUT_MS = 12000

let runtimePolicy = {
  isPublic: true,
  turnstileEnabled: false
}

const authErrorHandlers = new Set()
const turnstileErrorHandlers = new Set()

export function updateHttpRuntimePolicy({ isPublic, turnstileEnabled }) {
  if (typeof isPublic === 'boolean') runtimePolicy.isPublic = isPublic
  if (typeof turnstileEnabled === 'boolean') runtimePolicy.turnstileEnabled = turnstileEnabled
}

export function onUnauthorizedError(handler) {
  authErrorHandlers.add(handler)
  return () => authErrorHandlers.delete(handler)
}

export function onTurnstileError(handler) {
  turnstileErrorHandlers.add(handler)
  return () => turnstileErrorHandlers.delete(handler)
}

export class HttpApiError extends Error {
  constructor(message, status, code, path, payload = null) {
    super(message)
    this.name = 'HttpApiError'
    this.status = status
    this.code = code || status
    this.path = path
    this.payload = payload
  }
}

function buildRequestHeaders(extraHeaders = {}, forceTurnstileHeader = false) {
  const headers = {
    Accept: 'application/json',
    ...extraHeaders
  }

  const jwt = getJwtToken()
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`
  }

  if (runtimePolicy.turnstileEnabled || forceTurnstileHeader) {
    const verified = getTurnstileVerified()
    if (verified) {
      headers['X-Turnstile-Verified'] = verified
    } else {
      const token = getTurnstileToken()
      if (token) {
        headers['X-Turnstile-Token'] = token
      }
    }
  }

  return headers
}

export async function httpRequest(path, options = {}) {
  const {
    base = getPrimaryApiBase(),
    method = 'GET',
    body = undefined,
    headers = {},
    timeout = DEFAULT_TIMEOUT_MS,
    forceTurnstileHeader = false,
    skipAuthRedirect = false
  } = options

  const cleanBase = String(base || '').replace(/\/+$/, '')
  const url = `${cleanBase}${path}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const reqHeaders = buildRequestHeaders(headers, forceTurnstileHeader)
  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json'
  }

  try {
    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal
    })

    let data = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    } else {
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (typeof data.turnstile_verified === 'string' && data.turnstile_verified) {
        setTurnstileVerified(data.turnstile_verified)
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearJwtToken()
        if (!skipAuthRedirect) {
          for (const fn of authErrorHandlers) {
            try {
              fn({ path, base: cleanBase, data })
            } catch {
              // ignore listener errors
            }
          }
        }
      } else if (response.status === 403) {
        clearTurnstileCredentials()
        for (const fn of turnstileErrorHandlers) {
          try {
            fn({ path, base: cleanBase, data })
          } catch {
            // ignore listener errors
          }
        }
      }

      const errMsg = data?.error || data?.message || `HTTP ${response.status} on ${path}`
      const errCode = Number(data?.code) || response.status
      throw new HttpApiError(errMsg, response.status, errCode, path, data)
    }

    return data
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new HttpApiError(`Request timeout (${timeout}ms): ${path}`, 408, 408, path)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
