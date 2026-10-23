import { getPrimaryApiBase, setTurnstileToken } from './config.js'
import { httpRequest, updateHttpRuntimePolicy } from './http.js'

export const ALLOWED_HISTORY_HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168]

const configCacheByBase = new Map()
const configInflightByBase = new Map()

function normalizeBaseKey(base) {
  return String(base || getPrimaryApiBase() || '').replace(/\/+$/, '')
}

function normalizeConfigPayload(raw = {}) {
  const isPublic = raw.is_public !== false && raw.is_public !== 'false' && raw.is_public !== '0'
  const turnstileEnabled = raw.turnstile_enabled === true || raw.turnstile_enabled === 'true' || raw.turnstile_enabled === '1'
  const authorization = raw.authorization === true || raw.authorization === 'true' || raw.authorization === '1'
  const verified = raw.verified === true || raw.verified === 'true' || raw.verified === '1'
  const themeOptions =
    raw.theme_options && typeof raw.theme_options === 'object' && !Array.isArray(raw.theme_options)
      ? raw.theme_options
      : {}

  return {
    version: String(raw.version || ''),
    last_workers_version: raw.last_workers_version || null,
    last_agent_version: raw.last_agent_version || null,
    is_public: isPublic,
    authorization,
    turnstile_enabled: turnstileEnabled,
    turnstile_login_enabled: Boolean(raw.turnstile_login_enabled),
    turnstile_site_key: String(raw.turnstile_site_key || ''),
    custom_ct_name: String(raw.custom_ct_name || '电信'),
    custom_cu_name: String(raw.custom_cu_name || '联通'),
    custom_cm_name: String(raw.custom_cm_name || '移动'),
    custom_bd_name: String(raw.custom_bd_name || 'BGP'),
    node_1_name: String(raw.node_1_name || 'Node 1'),
    node_2_name: String(raw.node_2_name || 'Node 2'),
    node_3_name: String(raw.node_3_name || 'Node 3'),
    node_4_name: String(raw.node_4_name || 'Node 4'),
    site_title: String(raw.site_title || ''),
    preferred_theme: String(raw.preferred_theme || 'auto'),
    default_language: String(raw.default_language || 'auto'),
    theme_options: themeOptions,
    verified,
    turnstile_verified: raw.turnstile_verified || null,
    frontend_ws_timeout_minutes: Number(raw.frontend_ws_timeout_minutes) || 0,
    long_history_points: Number(raw.long_history_points) || 120,
    latency_window: raw.latency_window || { points: 20, hours: 2 }
  }
}

/**
 * 首次载入：GET /api/config
 * 全页面生命周期只请求一次，结果缓存在内存中。
 */
export async function fetchSiteConfig(base = getPrimaryApiBase()) {
  const key = normalizeBaseKey(base)
  if (configCacheByBase.has(key)) {
    return configCacheByBase.get(key)
  }
  if (configInflightByBase.has(key)) {
    return configInflightByBase.get(key)
  }

  const promise = (async () => {
    try {
      const raw = await httpRequest('/api/config', {
        base: key,
        forceTurnstileHeader: true,
        skipAuthRedirect: true
      })
      const normalized = normalizeConfigPayload(raw || {})
      updateHttpRuntimePolicy({
        isPublic: normalized.is_public,
        turnstileEnabled: normalized.turnstile_enabled
      })
      configCacheByBase.set(key, normalized)
      return normalized
    } finally {
      configInflightByBase.delete(key)
    }
  })()

  configInflightByBase.set(key, promise)
  return promise
}

/**
 * 当用户完成 Turnstile 验证拿到一次性 token 时，通过 /api/config 换取可复用的 turnstile_verified 凭证
 */
export async function submitTurnstileToken(token, base = getPrimaryApiBase()) {
  const key = normalizeBaseKey(base)
  setTurnstileToken(token)
  const raw = await httpRequest('/api/config', {
    base: key,
    forceTurnstileHeader: true,
    skipAuthRedirect: true
  })
  const normalized = normalizeConfigPayload(raw || {})
  updateHttpRuntimePolicy({
    isPublic: normalized.is_public,
    turnstileEnabled: normalized.turnstile_enabled
  })
  configCacheByBase.set(key, normalized)
  return normalized
}

export function getCachedSiteConfig(base = getPrimaryApiBase()) {
  return configCacheByBase.get(normalizeBaseKey(base)) || null
}

/**
 * 首页获取服务器列表：GET /api/servers
 */
export async function fetchServersList(base = getPrimaryApiBase()) {
  const key = normalizeBaseKey(base)
  const data = await httpRequest('/api/servers', { base: key })
  return {
    servers: Array.isArray(data?.servers) ? data.servers : [],
    stats: data?.stats || {
      total: 0,
      online: 0,
      offline: 0,
      globalSpeedIn: 0,
      globalSpeedOut: 0,
      globalNetTx: 0,
      globalNetRx: 0
    },
    regionStats: data?.regionStats || {},
    sysConfig: {
      show_price: data?.sysConfig?.show_price !== false,
      show_expire: data?.sysConfig?.show_expire !== false,
      show_tf: data?.sysConfig?.show_tf !== false,
      show_three_net_details: data?.sysConfig?.show_three_net_details === true
    }
  }
}

/**
 * 详情页获取单台服务器：GET /api/server?id=<id>
 */
export async function fetchServerDetail(serverId, base = getPrimaryApiBase()) {
  const key = normalizeBaseKey(base)
  const encodedId = encodeURIComponent(String(serverId || '').trim())
  return httpRequest(`/api/server?id=${encodedId}`, { base: key })
}

/**
 * 详情页获取历史曲线：GET /api/history/all?id=<id>&hours=<hours>
 * hours 严格限制在允许列表中，默认 0.167（10 分钟）
 */
export async function fetchServerHistory(serverId, hours = 0.167, base = getPrimaryApiBase()) {
  const key = normalizeBaseKey(base)
  const encodedId = encodeURIComponent(String(serverId || '').trim())
  const numHours = Number(hours)
  const validHours = ALLOWED_HISTORY_HOURS.includes(numHours) ? numHours : 0.167
  const rows = await httpRequest(`/api/history/all?id=${encodedId}&hours=${validHours}`, {
    base: key,
    skipAuthRedirect: validHours > 24
  })
  return Array.isArray(rows) ? rows : []
}

/**
 * 保存主题自身配置：POST /api/theme_options
 */
export async function saveThemeOptionsToServer(themeOptions, base = getPrimaryApiBase()) {
  if (!themeOptions || typeof themeOptions !== 'object' || Array.isArray(themeOptions)) {
    throw new Error('invalidThemeOptionsFormat')
  }
  const key = normalizeBaseKey(base)
  const res = await httpRequest('/api/theme_options', {
    base: key,
    method: 'POST',
    body: { theme_options: themeOptions },
    skipAuthRedirect: true
  })
  const cached = configCacheByBase.get(key)
  if (cached && res?.theme_options) {
    cached.theme_options = res.theme_options
  }
  return res?.theme_options || themeOptions
}
