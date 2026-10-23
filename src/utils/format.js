import { getPublicAssetUrl } from './config.js'

const OS_CONFIGS = [
  { name: 'AlmaLinux', image: 'os-alma.svg', keywords: ['alma', 'almalinux'] },
  { name: 'Alpine Linux', image: 'os-alpine.webp', keywords: ['alpine', 'alpine linux'] },
  { name: 'CentOS', image: 'os-centos.svg', keywords: ['centos', 'cent os'] },
  { name: 'Debian', image: 'os-debian.svg', keywords: ['debian', 'debian gnu/linux', 'deb'] },
  { name: 'Ubuntu', image: 'os-ubuntu.svg', keywords: ['ubuntu', 'elementary'] },
  { name: 'macOS', image: 'os-macos.svg', keywords: ['macos', 'mac os', 'darwin', 'os x'] },
  { name: 'Windows', image: 'os-windows.svg', keywords: ['windows', 'win32', 'win64', 'win10', 'win11', 'win server', 'microsoft'] },
  { name: 'Arch Linux', image: 'os-arch.svg', keywords: ['arch', 'archlinux', 'arch linux'] },
  { name: 'Kali Linux', image: 'os-kail.svg', keywords: ['kail', 'kali', 'kali linux'] },
  { name: 'iStoreOS', image: 'os-istore.png', keywords: ['istore', 'istoreos', 'istore os'] },
  { name: 'OpenWrt', image: 'os-openwrt.svg', keywords: ['openwrt', 'open wrt', 'open-wrt', 'qwrt', 'kwrt'] },
  { name: 'ImmortalWrt', image: 'os-openwrt.svg', keywords: ['immortalwrt', 'immortal', 'emmortal'] },
  { name: 'NixOS', image: 'os-nix.svg', keywords: ['nixos', 'nix os', 'nix'] },
  { name: 'Rocky Linux', image: 'os-rocky.svg', keywords: ['rocky', 'rocky linux'] },
  { name: 'Fedora', image: 'os-fedora.svg', keywords: ['fedora'] },
  { name: 'openSUSE', image: 'os-openSUSE.svg', keywords: ['opensuse', 'open suse', 'suse'] },
  { name: 'Gentoo', image: 'os-gentoo.svg', keywords: ['gentoo'] },
  { name: 'Red Hat', image: 'os-redhat.svg', keywords: ['redhat', 'rhel', 'red hat'] },
  { name: 'Linux Mint', image: 'os-mint.svg', keywords: ['mint', 'linux mint'] },
  { name: 'Manjaro', image: 'os-manjaro-.svg', keywords: ['manjaro'] },
  { name: 'Armbian', image: 'os-armbian.png', keywords: ['armbox', 'armbian'] },
  { name: 'Synology DSM', image: 'os-synology.ico', keywords: ['synology', 'dsm', 'synology dsm'] },
  { name: 'Proxmox VE', image: 'os-proxmox.ico', keywords: ['proxmox', 'proxmox ve', 'pve'] },
  { name: 'Alibaba Cloud', image: 'os-alibaba.svg', keywords: ['alibaba', 'aliyun', 'alinux', 'anolis', 'openanolis', '阿里', '龙蜥'] },
  { name: 'OpenCloudOS', image: 'os-opencloud.svg', keywords: ['opencloud', 'opencloudos', 'opencloud os'] },
  { name: 'Oracle Linux', image: 'os-oracle.svg', keywords: ['oracle', 'oracle linux'] }
]

const DEFAULT_OS = { name: 'Linux', image: 'os-unknown.svg' }

export function findOSConfig(osString) {
  const input = String(osString || '').toLowerCase().trim()
  if (!input) return DEFAULT_OS
  for (const cfg of OS_CONFIGS) {
    if (cfg.keywords.some(kw => input.includes(kw))) {
      return cfg
    }
  }
  return DEFAULT_OS
}

export function getOSIconUrl(osString, base = '') {
  const cfg = findOSConfig(osString)
  return getPublicAssetUrl(`os-icons/${cfg.image}`, base)
}

export function getShortOSName(osString) {
  const cfg = findOSConfig(osString)
  if (cfg !== DEFAULT_OS) return cfg.name
  const raw = String(osString || '').trim()
  if (!raw) return 'Linux'
  return raw.split(/[\s/]/)[0] || 'Linux'
}

export function normalizeFlagCode(region) {
  const raw = String(region || '').trim().toLowerCase()
  if (!raw || raw === 'unknown' || raw === 'other') return ''
  if (raw === 'uk') return 'gb'
  if (/^[a-z]{2}$/.test(raw)) return raw
  return ''
}

export function getFlagIconUrl(region, base = '') {
  const code = normalizeFlagCode(region)
  if (!code) return ''
  return getPublicAssetUrl(`flags/${code}.svg`, base)
}

const REGION_NAMES_ZH = {
  CN: '中国', HK: '香港', TW: '台湾', MO: '澳门',
  JP: '日本', KR: '韩国', SG: '新加坡', US: '美国',
  CA: '加拿大', GB: '英国', DE: '德国', FR: '法国',
  NL: '荷兰', RU: '俄罗斯', AU: '澳大利亚', IN: '印度',
  MY: '马来西亚', TH: '泰国', VN: '越南', ID: '印尼',
  PH: '菲律宾', TR: '土耳其', BR: '巴西', AR: '阿根廷',
  ZA: '南非', AE: '阿联酋', SE: '瑞典', CH: '瑞士',
  IT: '意大利', ES: '西班牙', PL: '波兰', FI: '芬兰',
  NO: '挪威', IE: '爱尔兰', AT: '奥地利', BE: '比利时'
}

export function getRegionDisplayName(region, lang = 'zh') {
  const code = String(region || '').trim().toUpperCase()
  if (!code || code === 'UNKNOWN') return lang === 'zh' ? '未知地区' : 'Unknown'
  if (lang === 'zh' && REGION_NAMES_ZH[code]) {
    return `${REGION_NAMES_ZH[code]} (${code})`
  }
  return code
}

export function isServerOnline(server, now = Date.now()) {
  if (!server) return false
  const lastUpdated = Number(server.last_updated || server.timestamp || 0)
  if (!lastUpdated || !Number.isFinite(lastUpdated)) return false
  return (now - lastUpdated) < 5 * 60 * 1000
}

export function formatBytes(bytes, decimals = 2) {
  const num = Number(bytes)
  if (!Number.isFinite(num) || num <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(num) / Math.log(k)), units.length - 1)
  const val = num / Math.pow(k, i)
  return `${val.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`
}

export function formatSpeed(bytesPerSec) {
  const num = Number(bytesPerSec)
  if (!Number.isFinite(num) || num <= 0) return '0 B/s'
  const k = 1024
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.min(Math.floor(Math.log(num) / Math.log(k)), units.length - 1)
  const val = num / Math.pow(k, i)
  return `${val.toFixed(i === 0 ? 0 : val >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatMbSize(mb, decimals = 1) {
  const num = Number(mb)
  if (!Number.isFinite(num) || num <= 0) return '0 MB'
  if (num >= 1024 * 1024) {
    return `${(num / (1024 * 1024)).toFixed(decimals)} TB`
  }
  if (num >= 1024) {
    return `${(num / 1024).toFixed(decimals)} GB`
  }
  return `${Math.round(num)} MB`
}

export function calcUsagePct(used, total) {
  const u = Number(used)
  const t = Number(total)
  if (!Number.isFinite(u) || !Number.isFinite(t) || t <= 0) return 0
  return Math.min(100, Math.max(0, (u / t) * 100))
}

export function getMetricTone(pct) {
  const n = Number(pct) || 0
  if (n >= 88) return 'danger'
  if (n >= 70) return 'warning'
  return 'normal'
}

export function formatUptime(bootTimeRaw, lang = 'zh', now = Date.now()) {
  const raw = Number(bootTimeRaw)
  if (!Number.isFinite(raw) || raw <= 0) return '-'
  const bootMs = raw < 1e11 ? raw * 1000 : raw
  const diffSec = Math.max(0, Math.floor((now - bootMs) / 1000))
  const days = Math.floor(diffSec / 86400)
  const hours = Math.floor((diffSec % 86400) / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)

  if (lang === 'zh') {
    if (days > 0) return `${days}天 ${hours}时`
    if (hours > 0) return `${hours}时 ${mins}分`
    return `${mins}分`
  } else {
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }
}

export function parseTrafficLimitBytes(limitStr) {
  const raw = String(limitStr || '').trim().toUpperCase()
  if (!raw) return 0
  const m = raw.match(/^([\d.]+)\s*(B|KB|K|MB|M|GB|G|TB|T|PB|P)?$/)
  if (!m) return 0
  const val = Number.parseFloat(m[1])
  if (!Number.isFinite(val) || val <= 0) return 0
  const unit = m[2] || 'GB'
  const mult = {
    B: 1,
    K: 1024, KB: 1024,
    M: 1024 ** 2, MB: 1024 ** 2,
    G: 1024 ** 3, GB: 1024 ** 3,
    T: 1024 ** 4, TB: 1024 ** 4,
    P: 1024 ** 5, PB: 1024 ** 5
  }[unit] || 1024 ** 3
  return val * mult
}

export function getTrafficQuotaInfo(server) {
  if (!server) return null
  const rx = Number(server.net_rx_monthly ?? server.net_rx ?? 0) || 0
  const tx = Number(server.net_tx_monthly ?? server.net_tx ?? 0) || 0
  const calcType = String(server.traffic_calc_type || 'total').toLowerCase()

  let used = rx + tx
  if (calcType === 'max') used = Math.max(rx, tx)
  else if (calcType === 'min') used = Math.min(rx, tx)
  else if (calcType === 'up' || calcType === 'tx' || calcType === 'out') used = tx
  else if (calcType === 'down' || calcType === 'rx' || calcType === 'in') used = rx

  const limitBytes = parseTrafficLimitBytes(server.traffic_limit)
  const pct = limitBytes > 0 ? Math.min(100, Math.max(0, (used / limitBytes) * 100)) : null

  return {
    rx,
    tx,
    used,
    limitBytes,
    limitText: limitBytes > 0 ? formatBytes(limitBytes, 1) : '',
    usedText: formatBytes(used, 2),
    pct
  }
}

const CYCLE_MONTHS = {
  month: { months: 1, zh: '月', en: 'mo' },
  quarter: { months: 3, zh: '季', en: 'qtr' },
  half_year: { months: 6, zh: '半年', en: '6mo' },
  year: { months: 12, zh: '年', en: 'yr' },
  two_years: { months: 24, zh: '2年', en: '2yr' },
  three_years: { months: 36, zh: '3年', en: '3yr' },
  four_years: { months: 48, zh: '4年', en: '4yr' },
  five_years: { months: 60, zh: '5年', en: '5yr' }
}

export function formatServerBilling(server, lang = 'zh') {
  const rawPrice = String(server?.price ?? '').trim()
  if (!rawPrice) return null
  const num = Number.parseFloat(rawPrice.replace(/[^0-9.-]/g, ''))
  if (rawPrice === '0' || rawPrice === '-1' || num === 0 || num === -1) {
    return {
      isFree: true,
      label: lang === 'zh' ? '免费' : 'Free',
      monthlyCny: 0
    }
  }
  if (!Number.isFinite(num) || num < 0) return null

  const currency = String(server?.currency || '¥').trim() || '¥'
  const cycleKey = String(server?.billing_cycle || 'month').toLowerCase()
  const cycleInfo = CYCLE_MONTHS[cycleKey] || CYCLE_MONTHS.month
  const cycleLabel = lang === 'zh' ? cycleInfo.zh : cycleInfo.en

  const rateToCny = {
    '¥': 1, '￥': 1, '$': 7.2, '€': 7.8, '£': 9.1,
    'HK$': 0.92, 'S$': 5.35, 'C$': 5.2, 'A$': 4.7, '¥JPY': 0.048, '₽': 0.075
  }[currency] || 1

  const monthlyCny = (num * rateToCny) / cycleInfo.months

  return {
    isFree: false,
    price: num,
    currency,
    cycleLabel,
    label: `${currency}${num.toFixed(num % 1 === 0 ? 0 : 2)}/${cycleLabel}`,
    monthlyCny
  }
}

export function getServerExpiryInfo(server, lang = 'zh', now = Date.now()) {
  const raw = String(server?.expire_date || '').trim()
  const autoRenew = server?.auto_renewal === '1' || server?.auto_renewal === 1 || server?.auto_renewal === true
  if (!raw) {
    if (autoRenew) {
      return { text: lang === 'zh' ? '长期/自动续费' : 'Auto-Renew', daysLeft: null, tone: 'normal', autoRenew }
    }
    return null
  }

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return { text: raw, daysLeft: null, tone: 'normal', autoRenew }

  const targetMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
  const diffDays = Math.ceil((targetMs - now) / 86400000)

  let tone = 'normal'
  if (diffDays <= 3) tone = 'danger'
  else if (diffDays <= 14) tone = 'warning'

  let text = ''
  if (diffDays < 0) {
    text = lang === 'zh' ? `已过期 ${Math.abs(diffDays)}天` : `Expired ${Math.abs(diffDays)}d`
  } else if (diffDays === 0) {
    text = lang === 'zh' ? '今日到期' : 'Expires today'
  } else {
    text = lang === 'zh' ? `剩余 ${diffDays}天` : `${diffDays}d left`
  }

  return {
    date: raw,
    daysLeft: diffDays,
    text,
    tone,
    autoRenew
  }
}

/**
 * Ping / Loss 三态语义严格遵守规范：
 * - false 或 undefined：未配置/未取样 -> 不显示
 * - null：明确探测超时 -> 显示 "Timeout/超时"
 * - 0：有效数据（0ms 或 0% 丢包） -> 必须正常显示
 */
export const PING_LINE_DEFINITIONS = [
  { key: 'ct', pingField: 'ping_ct', lossField: 'loss_ct', configNameField: 'custom_ct_name', defaultLabel: '电信', color: '#38bdf8' },
  { key: 'cu', pingField: 'ping_cu', lossField: 'loss_cu', configNameField: 'custom_cu_name', defaultLabel: '联通', color: '#fb923c' },
  { key: 'cm', pingField: 'ping_cm', lossField: 'loss_cm', configNameField: 'custom_cm_name', defaultLabel: '移动', color: '#34d399' },
  { key: 'bd', pingField: 'ping_bd', lossField: 'loss_bd', configNameField: 'custom_bd_name', defaultLabel: 'BGP', color: '#a78bfa' },
  { key: 'node_1', pingField: 'ping_node_1', lossField: 'loss_node_1', configNameField: 'node_1_name', defaultLabel: 'Node 1', color: '#f472b6' },
  { key: 'node_2', pingField: 'ping_node_2', lossField: 'loss_node_2', configNameField: 'node_2_name', defaultLabel: 'Node 2', color: '#facc15' },
  { key: 'node_3', pingField: 'ping_node_3', lossField: 'loss_node_3', configNameField: 'node_3_name', defaultLabel: 'Node 3', color: '#2dd4bf' },
  { key: 'node_4', pingField: 'ping_node_4', lossField: 'loss_node_4', configNameField: 'node_4_name', defaultLabel: 'Node 4', color: '#fb7185' }
]

export function isUnconfiguredPingValue(val) {
  return val === false || val === 'false' || val === undefined
}

export function normalizePingMetricValue(val) {
  if (isUnconfiguredPingValue(val)) return false
  if (val === null || val === 'null' || val === '') return null
  const num = Number(val)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

export function extractConfiguredPingLines(server, siteConfig = {}, historyRows = null) {
  if (!server) return []
  const lines = []
  const pingWindow = Array.isArray(server.ping) ? server.ping : []
  const lossWindow = Array.isArray(server.loss) ? server.loss : []

  for (const def of PING_LINE_DEFINITIONS) {
    const rawPing = server[def.pingField]
    const rawLoss = server[def.lossField]
    const normPing = normalizePingMetricValue(rawPing)
    const normLoss = normalizePingMetricValue(rawLoss)

    // Check if window or history has non-false points for this line
    let hasWindowData = false
    if (['ct', 'cu', 'cm', 'bd'].includes(def.key)) {
      hasWindowData = pingWindow.some(pt => !isUnconfiguredPingValue(pt?.[def.key]))
    }
    let hasHistoryData = false
    if (Array.isArray(historyRows) && historyRows.length > 0) {
      hasHistoryData = historyRows.some(row => !isUnconfiguredPingValue(row?.[def.pingField]))
    }

    if (normPing === false && normLoss === false && !hasWindowData && !hasHistoryData) {
      continue
    }

    const label = String(siteConfig?.[def.configNameField] || def.defaultLabel).trim() || def.defaultLabel

    // Build window buckets if available (for homepage 2h window strip)
    const buckets = []
    if (['ct', 'cu', 'cm', 'bd'].includes(def.key) && pingWindow.length > 0) {
      const lossMap = new Map()
      for (const lp of lossWindow) {
        if (lp && lp.ts) lossMap.set(lp.ts, normalizePingMetricValue(lp[def.key]))
      }
      for (const pp of pingWindow) {
        if (!pp || isUnconfiguredPingValue(pp[def.key])) continue
        const rtt = normalizePingMetricValue(pp[def.key])
        const loss = lossMap.has(pp.ts) ? lossMap.get(pp.ts) : 0
        buckets.push({
          ts: pp.ts,
          rtt,
          loss: loss === false ? 0 : loss
        })
      }
    }

    lines.push({
      key: def.key,
      pingField: def.pingField,
      lossField: def.lossField,
      label,
      color: def.color,
      ping: normPing, // number | null (Timeout)
      loss: normLoss, // number | null (Timeout) | false
      buckets
    })
  }

  return lines
}

export function getPingLatencyTone(rtt, loss = 0) {
  if (rtt === null) return 'danger'
  if (typeof loss === 'number' && loss >= 20) return 'danger'
  if (typeof loss === 'number' && loss > 0) return 'warning'
  if (typeof rtt === 'number') {
    if (rtt >= 220) return 'danger'
    if (rtt >= 120) return 'warning'
    return 'normal'
  }
  return 'normal'
}

export function parseGpuList(gpuInfoRaw) {
  if (!gpuInfoRaw) return []
  let arr = gpuInfoRaw
  if (typeof gpuInfoRaw === 'string') {
    const trimmed = gpuInfoRaw.trim()
    if (!trimmed) return []
    try {
      arr = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter(item => item && (item.name || item.info !== undefined))
    .map((item, idx) => ({
      id: String(item.id ?? idx),
      name: String(item.name || `GPU ${idx}`),
      info: item.info !== null && item.info !== undefined && Number.isFinite(Number(item.info))
        ? Number(item.info)
        : null
    }))
}

export function hasValidDiskIo(diskObj) {
  if (!diskObj || typeof diskObj !== 'object') return false
  const fields = ['read_bps', 'write_bps', 'read_iops', 'write_iops', 'await_ms', 'util']
  return fields.some(k => Number(diskObj[k]) > 0)
}
