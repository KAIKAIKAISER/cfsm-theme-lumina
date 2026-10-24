import { reactive, computed } from 'vue'
import {
  getApiBases,
  getPrimaryApiBase,
  getAdminEntryUrl,
  getStaticSiteTitle,
  buildWebSocketUrl,
  STORAGE_KEYS,
  readStorage,
  writeStorage,
  getTurnstileVerified
} from '../utils/config.js'
import { onUnauthorizedError, onTurnstileError } from '../utils/http.js'
import {
  fetchSiteConfig,
  submitTurnstileToken,
  fetchServersList,
  fetchServerDetail,
  fetchServerHistory,
  saveThemeOptionsToServer,
  ALLOWED_HISTORY_HOURS
} from '../utils/api.js'
import { isServerOnline } from '../utils/format.js'
import { MESSAGES, resolveLanguage, saveUserLanguage } from '../utils/i18n.js'

export const DEFAULT_THEME_OPTIONS = {
  layout: 'large',           // 'large' | 'compact' | 'mini' | 'table'
  accent: 'cyan',            // 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose'
  themeMode: 'auto',         // 'auto' | 'dark' | 'light'
  glassOpacity: 82,          // 50 - 98
  showOverviewBanner: true,
  showBillingOnCard: true,
  showTrafficOnCard: true,
  showSpecsOnCard: true,
  showIpBadges: true,
  showPingStrip: true,
  pingLinesLimit: 6          // 1 - 8 (default 6 to show 3-net V4 + V6)
}

const state = reactive({
  initialized: false,
  loadingConfig: false,
  loadingServers: false,
  loadingDetail: false,
  loadingHistory: false,
  errorMsg: '',

  siteConfig: {
    version: '',
    last_workers_version: null,
    last_agent_version: null,
    is_public: true,
    authorization: false,
    turnstile_enabled: false,
    turnstile_site_key: '',
    custom_ct_name: '电信',
    custom_cu_name: '联通',
    custom_cm_name: '移动',
    custom_bd_name: 'BGP',
    node_1_name: 'Node 1',
    node_2_name: 'Node 2',
    node_3_name: 'Node 3',
    node_4_name: 'Node 4',
    site_title: '',
    preferred_theme: 'auto',
    default_language: 'auto',
    theme_options: {},
    verified: false,
    frontend_ws_timeout_minutes: 0,
    long_history_points: 120,
    latency_window: { points: 20, hours: 2 }
  },

  sysConfig: {
    show_price: true,
    show_expire: true,
    show_tf: true,
    show_three_net_details: true
  },

  servers: [],
  serverBaseMap: {}, // serverId -> apiBase
  stats: {
    total: 0,
    online: 0,
    offline: 0,
    globalSpeedIn: 0,
    globalSpeedOut: 0,
    globalNetTx: 0,
    globalNetRx: 0
  },
  regionStats: {},

  // Detail page state
  activeViewType: 'home', // 'home' | 'detail'
  activeServerId: '',
  detailServer: null,
  historyHours: 0.167,
  historyRows: [],

  // WebSocket state
  wsStatus: 'disconnected', // 'live' | 'reconnecting' | 'paused' | 'disconnected'
  wsTimeoutPromptVisible: false,

  // Turnstile gate state
  turnstileRequired: false,

  // Theme & UI preferences
  themeOptions: { ...DEFAULT_THEME_OPTIONS },
  localOverrides: {},
  settingsDrawerOpen: false,
  saveStatusHint: '',
  lang: 'zh',
  effectiveColorScheme: 'dark',
  nowTick: Date.now()
})

// Internal non-reactive WS & throttle management
const wsConnections = new Map() // key -> { ws, retryCount, retryTimer }
const pendingPatches = new Map() // serverId -> merged patch object
let flushThrottleTimer = null
let wsSessionTimeoutTimer = null
let saveThemeDebounceTimer = null
let visibilityListenerBound = false

function loadLocalThemeOverrides() {
  const raw = readStorage(STORAGE_KEYS.THEME_PREFS)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function applyThemeAttributesToDom() {
  if (typeof document === 'undefined') return
  const mode = state.themeOptions.themeMode || state.siteConfig.preferred_theme || 'auto'
  let isDark = true
  if (mode === 'light') {
    isDark = false
  } else if (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
    isDark = !window.matchMedia('(prefers-color-scheme: light)').matches
  }
  state.effectiveColorScheme = isDark ? 'dark' : 'light'

  const root = document.documentElement
  root.setAttribute('data-theme', state.effectiveColorScheme)
  root.setAttribute('data-accent', state.themeOptions.accent || 'cyan')
  const opacity = Math.min(98, Math.max(50, Number(state.themeOptions.glassOpacity) || 82)) / 100
  root.style.setProperty('--lumina-glass-opacity', String(opacity))

  const title = getStaticSiteTitle() || state.siteConfig.site_title || MESSAGES[state.lang]?.siteDefaultTitle || 'Server Monitor'
  document.title = title
}

function recomputeThemeOptions() {
  const siteOpts =
    state.siteConfig.theme_options && typeof state.siteConfig.theme_options === 'object' && !Array.isArray(state.siteConfig.theme_options)
      ? state.siteConfig.theme_options
      : {}
  const localOpts = loadLocalThemeOverrides()
  state.localOverrides = localOpts

  const merged = {
    ...DEFAULT_THEME_OPTIONS,
    ...(state.siteConfig.preferred_theme ? { themeMode: state.siteConfig.preferred_theme } : {}),
    ...siteOpts,
    ...localOpts
  }
  // Auto-upgrade legacy default limit (4) to 6 so 3-net V4/V6 show seamlessly without manual settings change
  if (!localOpts.pingLinesLimit || localOpts.pingLinesLimit === 4) {
    merged.pingLinesLimit = Math.max(6, Number(merged.pingLinesLimit) || 6)
  }
  state.themeOptions = merged
  applyThemeAttributesToDom()
}

/**
 * 增量合并单台服务器的采样字段，保留未在本次高频样本中出现的报告级字段
 */
function mergeServerSampleInPlace(target, patch, sampleTs) {
  if (!target || !patch || typeof patch !== 'object') return

  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue
    if (key === 'disk') {
      // Only update disk IO if patch carries a valid object with fields
      if (val && typeof val === 'object') {
        target.disk = { ...(target.disk || {}), ...val }
      }
      continue
    }
    target[key] = val
  }

  const ts = Number(sampleTs || patch.timestamp || patch.last_updated || Date.now())
  if (ts > 0) {
    target.last_updated = ts
    target.timestamp = ts
  }

  // If sample includes ping_ct/cu/cm/bd, append to in-memory 2h window array if needed
  const hasNewPing = ['ping_ct', 'ping_cu', 'ping_cm', 'ping_bd'].some(k => patch[k] !== undefined)
  if (hasNewPing && Array.isArray(target.ping)) {
    const lastPt = target.ping[target.ping.length - 1]
    if (!lastPt || ts - Number(lastPt.ts || 0) >= 60000) {
      target.ping.push({
        ts,
        ct: patch.ping_ct !== undefined ? patch.ping_ct : target.ping_ct,
        cu: patch.ping_cu !== undefined ? patch.ping_cu : target.ping_cu,
        cm: patch.ping_cm !== undefined ? patch.ping_cm : target.ping_cm,
        bd: patch.ping_bd !== undefined ? patch.ping_bd : target.ping_bd
      })
      if (target.ping.length > 24) target.ping.shift()
    }
  }

  const hasNewLoss = ['loss_ct', 'loss_cu', 'loss_cm', 'loss_bd'].some(k => patch[k] !== undefined)
  if (hasNewLoss && Array.isArray(target.loss)) {
    const lastLossPt = target.loss[target.loss.length - 1]
    if (!lastLossPt || ts - Number(lastLossPt.ts || 0) >= 60000) {
      target.loss.push({
        ts,
        ct: patch.loss_ct !== undefined ? patch.loss_ct : target.loss_ct,
        cu: patch.loss_cu !== undefined ? patch.loss_cu : target.loss_cu,
        cm: patch.loss_cm !== undefined ? patch.loss_cm : target.loss_cm,
        bd: patch.loss_bd !== undefined ? patch.loss_bd : target.loss_bd
      })
      if (target.loss.length > 24) target.loss.shift()
    }
  }
}

function recomputeGlobalStatsFromServers() {
  const now = Date.now()
  state.nowTick = now
  if (!Array.isArray(state.servers) || state.servers.length === 0) return
  let online = 0
  let speedIn = 0
  let speedOut = 0
  let netRx = 0
  let netTx = 0

  for (const srv of state.servers) {
    if (isServerOnline(srv, now)) {
      online++
      speedIn += Number(srv.net_in_speed) || 0
      speedOut += Number(srv.net_out_speed) || 0
    }
    netRx += Number(srv.net_rx_monthly ?? srv.net_rx) || 0
    netTx += Number(srv.net_tx_monthly ?? srv.net_tx) || 0
  }

  state.stats.total = state.servers.length
  state.stats.online = online
  state.stats.offline = Math.max(0, state.servers.length - online)
  state.stats.globalSpeedIn = speedIn
  state.stats.globalSpeedOut = speedOut
  state.stats.globalNetRx = netRx
  state.stats.globalNetTx = netTx
}

/**
 * 节流刷新：首页/详情页最多每 1000ms 将缓存的 WS 样本合并更新一次响应式状态
 */
function flushPendingWsUpdates() {
  flushThrottleTimer = null
  if (pendingPatches.size === 0) return

  const serverMap = new Map(state.servers.map(s => [s.id, s]))

  for (const [serverId, entry] of pendingPatches.entries()) {
    const listTarget = serverMap.get(serverId)
    if (listTarget) {
      mergeServerSampleInPlace(listTarget, entry.patch, entry.ts)
    }
    if (state.detailServer && state.detailServer.id === serverId) {
      mergeServerSampleInPlace(state.detailServer, entry.patch, entry.ts)
    }
  }

  pendingPatches.clear()
  recomputeGlobalStatsFromServers()
}

function enqueueBatchUpdate(updates) {
  if (!Array.isArray(updates)) return
  for (const item of updates) {
    const serverId = item?.serverId
    if (!serverId || !Array.isArray(item.samples)) continue

    let acc = pendingPatches.get(serverId)
    if (!acc) {
      acc = { patch: {}, ts: 0 }
      pendingPatches.set(serverId, acc)
    }

    for (const sample of item.samples) {
      if (!sample) continue
      const metrics = sample.data || sample.payload || sample.metrics
      if (!metrics || typeof metrics !== 'object') continue
      for (const [k, v] of Object.entries(metrics)) {
        if (v !== undefined) {
          acc.patch[k] = v
        }
      }
      if (sample.ts) acc.ts = sample.ts
    }
  }

  if (!flushThrottleTimer) {
    flushThrottleTimer = setTimeout(flushPendingWsUpdates, 1000)
  }
}

function applyInitialReportUpdates(serverObj) {
  if (!serverObj || !Array.isArray(serverObj.latestReportUpdates)) return
  for (const u of serverObj.latestReportUpdates) {
    if (!u || !Array.isArray(u.samples)) continue
    for (const s of u.samples) {
      const m = s?.data || s?.payload || s?.metrics
      if (m) mergeServerSampleInPlace(serverObj, m, s.ts || u.reportTs)
    }
  }
}

function clearWsSessionTimeout() {
  if (wsSessionTimeoutTimer) {
    clearTimeout(wsSessionTimeoutTimer)
    wsSessionTimeoutTimer = null
  }
}

function startWsSessionTimeoutIfNeeded() {
  clearWsSessionTimeout()
  const mins = Number(state.siteConfig.frontend_ws_timeout_minutes) || 0
  if (mins <= 0) return
  const ms = Math.min(1440, Math.max(1, mins)) * 60 * 1000
  wsSessionTimeoutTimer = setTimeout(() => {
    closeAllWebSockets('paused')
    state.wsTimeoutPromptVisible = true
  }, ms)
}

export function closeAllWebSockets(nextStatus = 'disconnected') {
  clearWsSessionTimeout()
  for (const conn of wsConnections.values()) {
    conn.disposed = true
    if (conn.retryTimer) clearTimeout(conn.retryTimer)
    if (conn.ws) {
      try {
        conn.ws.onclose = null
        conn.ws.onerror = null
        conn.ws.onmessage = null
        conn.ws.close()
      } catch {
        // ignore close error
      }
    }
  }
  wsConnections.clear()
  state.wsStatus = nextStatus
}

function openManagedWebSocket({ key, base, subscribe, ids = [] }) {
  if (typeof window === 'undefined' || typeof document !== 'undefined' && document.hidden) {
    return
  }

  const existing = wsConnections.get(key)
  if (existing) {
    existing.disposed = true
    if (existing.retryTimer) clearTimeout(existing.retryTimer)
    if (existing.ws) {
      try {
        existing.ws.onclose = null
        existing.ws.close()
      } catch {
        // ignore
      }
    }
  }

  const record = {
    ws: null,
    retryCount: 0,
    retryTimer: null,
    disposed: false
  }
  wsConnections.set(key, record)

  const connectAttempt = () => {
    if (record.disposed || (typeof document !== 'undefined' && document.hidden)) return

    const wsUrl = buildWebSocketUrl(base, subscribe)
    let ws
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      scheduleReconnect()
      return
    }
    record.ws = ws

    ws.onopen = () => {
      if (record.disposed) {
        ws.close()
        return
      }
      record.retryCount = 0
      state.wsStatus = 'live'
      if (subscribe === 'all') {
        const validIds = ids.filter(id => typeof id === 'string' && id.length >= 1 && id.length <= 64)
        if (validIds.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            scope: 'all',
            ids: validIds.slice(0, 500)
          }))
        }
      }
    }

    ws.onmessage = (event) => {
      if (record.disposed) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'batchUpdate' && Array.isArray(msg.updates)) {
          enqueueBatchUpdate(msg.updates)
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
        }
      } catch {
        // ignore malformed frame
      }
    }

    ws.onclose = () => {
      if (record.disposed) return
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will handle backoff
    }
  }

  const scheduleReconnect = () => {
    if (record.disposed || (typeof document !== 'undefined' && document.hidden)) return
    if (record.retryCount >= 10) {
      state.wsStatus = 'disconnected'
      return
    }
    state.wsStatus = 'reconnecting'
    const delay = Math.min(30000, 1000 * Math.pow(2, record.retryCount))
    record.retryCount++
    record.retryTimer = setTimeout(connectAttempt, delay)
  }

  connectAttempt()
}

export function startHomeWebSockets() {
  closeAllWebSockets('disconnected')
  if (!state.servers.length) return

  // Group server IDs by their owning apiBase (multi-base rule #9)
  const idsByBase = new Map()
  for (const srv of state.servers) {
    const base = state.serverBaseMap[srv.id] || getPrimaryApiBase()
    if (!idsByBase.has(base)) idsByBase.set(base, [])
    idsByBase.get(base).push(srv.id)
  }

  for (const [base, ids] of idsByBase.entries()) {
    if (ids.length > 0) {
      openManagedWebSocket({
        key: `all:${base}`,
        base,
        subscribe: 'all',
        ids
      })
    }
  }
  startWsSessionTimeoutIfNeeded()
}

export function startDetailWebSocket(serverId) {
  closeAllWebSockets('disconnected')
  if (!serverId) return
  const base = state.serverBaseMap[serverId] || getPrimaryApiBase()
  openManagedWebSocket({
    key: `single:${base}:${serverId}`,
    base,
    subscribe: serverId
  })
  startWsSessionTimeoutIfNeeded()
}

function bindGlobalListenersOnce() {
  if (visibilityListenerBound || typeof document === 'undefined') return
  visibilityListenerBound = true

  onUnauthorizedError(({ base }) => {
    state.siteConfig.authorization = false
    if (!state.siteConfig.is_public) {
      window.location.href = getAdminEntryUrl(base)
    }
  })

  onTurnstileError(() => {
    if (state.siteConfig.turnstile_enabled) {
      state.turnstileRequired = true
    }
  })

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      closeAllWebSockets('paused')
    } else {
      if (state.turnstileRequired || state.wsTimeoutPromptVisible) return
      if (state.activeViewType === 'home') {
        await loadServersOnce(true)
        startHomeWebSockets()
      } else if (state.activeViewType === 'detail' && state.activeServerId) {
        await loadSingleServerDetail(state.activeServerId, false)
        startDetailWebSocket(state.activeServerId)
      }
    }
  })
}

let serversFetchedOnce = false

export async function initializeMonitorApp() {
  bindGlobalListenersOnce()
  if (state.initialized) return state.siteConfig

  state.loadingConfig = true
  state.errorMsg = ''
  try {
    const bases = getApiBases()
    const primaryCfg = await fetchSiteConfig(bases[0])
    state.siteConfig = primaryCfg
    state.lang = resolveLanguage(primaryCfg.default_language)
    recomputeThemeOptions()

    // Private site check: if not public and not authorized, redirect to admin login
    if (!primaryCfg.is_public && !primaryCfg.authorization) {
      window.location.href = getAdminEntryUrl(bases[0])
      return primaryCfg
    }

    // Turnstile check: if enabled and neither verified in response nor cached in storage
    if (primaryCfg.turnstile_enabled && !primaryCfg.verified && !getTurnstileVerified()) {
      state.turnstileRequired = true
    }

    state.initialized = true
    return primaryCfg
  } catch (err) {
    state.errorMsg = err?.message || 'Failed to load site configuration'
    throw err
  } finally {
    state.loadingConfig = false
  }
}

export async function loadServersOnce(forceRefreshOnVisible = false) {
  if (serversFetchedOnce && !forceRefreshOnVisible) {
    return state.servers
  }
  if (state.turnstileRequired) return []

  state.loadingServers = true
  state.errorMsg = ''
  try {
    const bases = getApiBases()
    const results = await Promise.allSettled(
      bases.map(async (base) => {
        const res = await fetchServersList(base)
        return { base, ...res }
      })
    )

    const mergedServers = []
    const baseMap = {}
    const regionMap = {}
    let primarySysConfig = null

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const { base, servers, regionStats, sysConfig } = r.value
        if (!primarySysConfig) primarySysConfig = sysConfig
        for (const srv of servers) {
          applyInitialReportUpdates(srv)
          baseMap[srv.id] = base
          mergedServers.push(srv)
        }
        for (const [reg, cnt] of Object.entries(regionStats || {})) {
          regionMap[reg] = (regionMap[reg] || 0) + (Number(cnt) || 0)
        }
      } else if (r.status === 'rejected') {
        const err = r.reason
        if (err?.status === 403 && state.siteConfig.turnstile_enabled) {
          state.turnstileRequired = true
          return []
        }
        if (bases.length === 1) {
          throw err
        }
      }
    }

    state.serverBaseMap = baseMap
    state.servers = mergedServers
    state.regionStats = regionMap
    if (primarySysConfig) {
      state.sysConfig = primarySysConfig
    }
    recomputeGlobalStatsFromServers()
    serversFetchedOnce = true
    return state.servers
  } catch (err) {
    state.errorMsg = err?.message || 'Failed to load servers list'
    throw err
  } finally {
    state.loadingServers = false
  }
}

export async function loadSingleServerDetail(serverId, loadDefaultHistory = true) {
  if (!serverId || state.turnstileRequired) return null
  state.loadingDetail = true
  state.errorMsg = ''

  try {
    const base = state.serverBaseMap[serverId] || getPrimaryApiBase()
    const detail = await fetchServerDetail(serverId, base)
    if (detail) {
      applyInitialReportUpdates(detail)
      // Preserve 2h ping/loss window if already loaded from list
      const existingInList = state.servers.find(s => s.id === serverId)
      if (existingInList) {
        if (!detail.ping && existingInList.ping) detail.ping = existingInList.ping
        if (!detail.loss && existingInList.loss) detail.loss = existingInList.loss
      }
      state.detailServer = detail
    }
    if (loadDefaultHistory) {
      await loadServerHistoryRange(serverId, state.historyHours)
    }
    return detail
  } catch (err) {
    state.errorMsg = err?.message || 'Failed to load server detail'
    throw err
  } finally {
    state.loadingDetail = false
  }
}

export async function loadServerHistoryRange(serverId, hours = 0.167) {
  if (!serverId || state.turnstileRequired) return []
  const validHours = ALLOWED_HISTORY_HOURS.includes(Number(hours)) ? Number(hours) : 0.167
  state.historyHours = validHours
  state.loadingHistory = true

  try {
    const base = state.serverBaseMap[serverId] || getPrimaryApiBase()
    const rows = await fetchServerHistory(serverId, validHours, base)
    state.historyRows = rows
    return rows
  } catch (err) {
    state.historyRows = []
    throw err
  } finally {
    state.loadingHistory = false
  }
}

export async function completeTurnstileVerification(token) {
  const cfg = await submitTurnstileToken(token, getPrimaryApiBase())
  state.siteConfig = cfg
  state.turnstileRequired = false
  if (state.activeViewType === 'home') {
    await loadServersOnce(true)
    startHomeWebSockets()
  } else if (state.activeViewType === 'detail' && state.activeServerId) {
    await loadSingleServerDetail(state.activeServerId, true)
    startDetailWebSocket(state.activeServerId)
  }
}

export function resumeWebSocketAfterTimeout() {
  state.wsTimeoutPromptVisible = false
  if (state.activeViewType === 'home') {
    startHomeWebSockets()
  } else if (state.activeViewType === 'detail' && state.activeServerId) {
    startDetailWebSocket(state.activeServerId)
  }
}

export function dismissWebSocketTimeoutPrompt() {
  state.wsTimeoutPromptVisible = false
  state.wsStatus = 'disconnected'
}

export function updateThemePreference(key, value) {
  const overrides = { ...loadLocalThemeOverrides(), [key]: value }
  writeStorage(STORAGE_KEYS.THEME_PREFS, JSON.stringify(overrides))
  recomputeThemeOptions()

  const t = MESSAGES[state.lang] || MESSAGES.zh
  if (state.siteConfig.authorization) {
    if (saveThemeDebounceTimer) clearTimeout(saveThemeDebounceTimer)
    saveThemeDebounceTimer = setTimeout(async () => {
      try {
        const nextSiteThemeOpts = {
          ...(state.siteConfig.theme_options || {}),
          ...overrides
        }
        await saveThemeOptionsToServer(nextSiteThemeOpts)
        state.saveStatusHint = t.syncedToServer
        setTimeout(() => { state.saveStatusHint = '' }, 2500)
      } catch {
        state.saveStatusHint = t.savedLocally
        setTimeout(() => { state.saveStatusHint = '' }, 2500)
      }
    }, 600)
  } else {
    state.saveStatusHint = t.savedLocally
    setTimeout(() => { state.saveStatusHint = '' }, 2000)
  }
}

export function resetThemePreferencesToSiteDefault() {
  writeStorage(STORAGE_KEYS.THEME_PREFS, '')
  recomputeThemeOptions()
}

export function toggleLanguage() {
  const next = state.lang === 'zh' ? 'en' : 'zh'
  state.lang = next
  saveUserLanguage(next)
  applyThemeAttributesToDom()
}

export function useMonitorStore() {
  const t = computed(() => MESSAGES[state.lang] || MESSAGES.zh)
  return {
    state,
    t,
    initializeMonitorApp,
    loadServersOnce,
    loadSingleServerDetail,
    loadServerHistoryRange,
    startHomeWebSockets,
    startDetailWebSocket,
    closeAllWebSockets,
    completeTurnstileVerification,
    resumeWebSocketAfterTimeout,
    dismissWebSocketTimeoutPrompt,
    updateThemePreference,
    resetThemePreferencesToSiteDefault,
    toggleLanguage
  }
}
