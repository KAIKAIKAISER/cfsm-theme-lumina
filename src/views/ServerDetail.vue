<template>
  <main style="display: flex; flex-direction: column; gap: 16px;">
    <!-- Top Detail Bar: Back Button & Quick Instance Switcher -->
    <section class="glass-panel detail-header-bar">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
        <button type="button" class="icon-btn" @click="goBack">
          <span>←</span>
          <span>{{ t.backToHome }}</span>
        </button>

        <template v-if="server">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="status-dot" :class="online ? 'online' : 'offline'"></span>
            <img v-if="flagUrl" :src="flagUrl" :alt="server.region" class="flag-icon" />
            <h2 style="font-size: 18px; font-weight: 700;">{{ server.name }}</h2>
          </div>

          <div class="badge-row">
            <span v-if="server.ip_v4 === '1' || server.ip_v4 === 1" class="mini-badge">IPv4</span>
            <span v-if="server.ip_v6 === '1' || server.ip_v6 === 1" class="mini-badge">IPv6</span>
            <span v-if="server.server_group" class="mini-badge">{{ server.server_group }}</span>
            <span v-for="tag in parsedTags" :key="tag" class="mini-badge tone-accent">#{{ tag }}</span>
          </div>
        </template>
      </div>

      <!-- Instance Switcher Pills (if servers list is already cached in memory) -->
      <div v-if="state.servers.length > 1" class="instance-switcher">
        <button
          v-for="item in state.servers"
          :key="item.id"
          type="button"
          class="region-pill"
          :class="{ active: item.id === serverId }"
          @click="switchInstance(item.id)"
        >
          <span
            class="status-dot"
            style="width: 6px; height: 6px;"
            :class="isServerOnline(item, state.nowTick) ? 'online' : 'offline'"
          ></span>
          <span>{{ item.name }}</span>
        </button>
      </div>
    </section>

    <div
      v-if="state.errorMsg"
      class="glass-panel"
      style="padding: 14px 18px; color: var(--tone-danger); font-size: 13px;"
    >
      ⚠️ {{ state.errorMsg }}
    </div>

    <div
      v-if="state.loadingDetail && !server"
      class="glass-panel"
      style="padding: 48px 20px; text-align: center; color: var(--text-secondary);"
    >
      Loading instance metrics...
    </div>

    <template v-else-if="server">
      <!-- Hardware & Billing Specs Grid -->
      <section class="glass-panel spec-list tabular-nums">
        <div class="spec-kv">
          <span class="spec-k">OS / {{ t.kernel }}</span>
          <span class="spec-v" style="display: flex; align-items: center; gap: 6px;">
            <img :src="osIconUrl" class="os-icon" />
            <span>{{ server.os || 'Linux' }} {{ server.kernel_version ? `(${server.kernel_version})` : '' }}</span>
          </span>
        </div>

        <div class="spec-kv">
          <span class="spec-k">{{ t.cpu }} / {{ t.architecture }}</span>
          <span class="spec-v">
            {{ server.cpu_info || '-' }}
            <template v-if="server.cpu_cores"> ({{ server.cpu_cores }} Cores)</template>
            <template v-if="server.arch"> · {{ server.arch }}</template>
          </span>
        </div>

        <div class="spec-kv">
          <span class="spec-k">{{ t.uptime }} / {{ t.loadAvg }}</span>
          <span class="spec-v">
            {{ formatUptime(server.boot_time, state.lang, state.nowTick) }}
            <template v-if="server.load_avg"> · Load: {{ server.load_avg }}</template>
          </span>
        </div>

        <div class="spec-kv">
          <span class="spec-k">{{ t.processes }} / {{ t.connections }}</span>
          <span class="spec-v">
            Proc: {{ server.processes ?? '-' }} · TCP: {{ server.tcp_conn ?? '-' }} · UDP: {{ server.udp_conn ?? '-' }}
          </span>
        </div>

        <div v-if="billingInfo || expiryInfo" class="spec-kv">
          <span class="spec-k">{{ t.billingInfo }} / {{ t.expireDate }}</span>
          <span class="spec-v">
            <template v-if="billingInfo">{{ billingInfo.label }}</template>
            <template v-if="billingInfo && expiryInfo"> · </template>
            <template v-if="expiryInfo">{{ expiryInfo.text }} ({{ expiryInfo.date || '' }})</template>
          </span>
        </div>

        <div v-if="trafficInfo" class="spec-kv">
          <span class="spec-k">{{ t.monthlyTraffic }}</span>
          <span class="spec-v">
            ↓ {{ formatBytes(trafficInfo.rx, 2) }} / ↑ {{ formatBytes(trafficInfo.tx, 2) }}
            <template v-if="trafficInfo.limitBytes > 0">
              ({{ trafficInfo.pct.toFixed(1) }}% of {{ trafficInfo.limitText }})
            </template>
          </span>
        </div>
      </section>

      <!-- Live Gauges Row -->
      <section class="detail-grid tabular-nums">
        <!-- CPU & Load -->
        <div class="glass-panel" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
          <div class="metric-label-row">
            <span class="metric-name">{{ t.cpu }}</span>
            <span class="metric-val" style="font-size: 18px;">{{ cpuPct.toFixed(1) }}%</span>
          </div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-fill" :class="`tone-${getMetricTone(cpuPct)}`" :style="{ width: `${cpuPct}%` }"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
            <span>Load: {{ server.load_avg || '-' }}</span>
            <span>Cores: {{ server.cpu_cores || '-' }}</span>
          </div>
        </div>

        <!-- Memory & Swap -->
        <div class="glass-panel" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
          <div class="metric-label-row">
            <span class="metric-name">{{ t.memory }}</span>
            <span class="metric-val" style="font-size: 18px;">{{ ramPct.toFixed(1) }}%</span>
          </div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-fill" :class="`tone-${getMetricTone(ramPct)}`" :style="{ width: `${ramPct}%` }"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
            <span>RAM: {{ formatMbSize(server.ram_used, 1) }} / {{ formatMbSize(server.ram_total, 1) }}</span>
            <span v-if="Number(server.swap_total) > 0">
              Swap: {{ formatMbSize(server.swap_used, 1) }} / {{ formatMbSize(server.swap_total, 1) }}
            </span>
          </div>
        </div>

        <!-- Storage & Real-time Speed -->
        <div class="glass-panel" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;">
          <div class="metric-label-row">
            <span class="metric-name">{{ t.disk }}</span>
            <span class="metric-val" style="font-size: 18px;">{{ diskPct.toFixed(1) }}%</span>
          </div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-fill" :class="`tone-${getMetricTone(diskPct)}`" :style="{ width: `${diskPct}%` }"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
            <span>{{ formatMbSize(server.disk_used, 1) }} / {{ formatMbSize(server.disk_total, 1) }}</span>
            <span>
              <strong class="speed-down">↓{{ formatSpeed(server.net_in_speed) }}</strong> ·
              <strong class="speed-up">↑{{ formatSpeed(server.net_out_speed) }}</strong>
            </span>
          </div>
        </div>
      </section>

      <!-- History Time Range Selector Bar (Strictly allowed hours, default 0.167 = 10m) -->
      <section class="glass-panel filter-toolbar">
        <div style="font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <span>📈 {{ t.historyRange }}</span>
          <span v-if="state.loadingHistory" style="font-size: 11px; color: var(--accent-secondary);">
            Loading...
          </span>
        </div>

        <div class="region-tabs tabular-nums">
          <button
            v-for="opt in timeRangeOptions"
            :key="opt.hours"
            type="button"
            class="region-pill"
            :class="{ active: state.historyHours === opt.hours }"
            :disabled="opt.requiresAuth && !state.siteConfig.authorization"
            :title="opt.requiresAuth && !state.siteConfig.authorization ? t.loginRequiredForLongHistory : ''"
            :style="{ opacity: opt.requiresAuth && !state.siteConfig.authorization ? 0.45 : 1 }"
            @click="changeHours(opt.hours)"
          >
            <span>{{ opt.label }}</span>
            <span v-if="opt.requiresAuth && !state.siteConfig.authorization">🔒</span>
          </button>
        </div>
      </section>

      <!-- Chart 1: Multi-Line Ping & Packet Loss Strip (Reuses /api/history/all) -->
      <InteractiveChart
        v-if="pingChartSeries.length > 0"
        :title="t.chartPingTitle"
        :series="pingChartSeries"
        :yFormatter="val => `${Math.round(val)} ms`"
        :showLossStrip="true"
        :lossStripTitle="t.lossStripLabel"
        :timeoutLabel="t.timeout"
        :emptyText="t.noPingData"
      />

      <!-- Chart 2: CPU & Memory Usage History -->
      <InteractiveChart
        :title="t.chartResourceTitle"
        :series="resourceChartSeries"
        :yFormatter="val => `${val.toFixed(1)}%`"
        :emptyText="t.noPingData"
      />

      <!-- Chart 3: Network Throughput History -->
      <InteractiveChart
        :title="t.networkSpeed"
        :series="networkChartSeries"
        :yFormatter="val => formatSpeed(val)"
        :emptyText="t.noPingData"
      />

      <!-- Chart 4: Disk I/O History (Strictly hidden when disk IO is absent or all 0) -->
      <InteractiveChart
        v-if="showDiskIoChart"
        :title="t.chartDiskIoTitle"
        :series="diskIoChartSeries"
        :yFormatter="val => formatSpeed(val)"
        :emptyText="t.noPingData"
      />

      <!-- Chart 5: GPU History (Strictly shown only when gpu_info exists) -->
      <InteractiveChart
        v-if="gpuChartSeries.length > 0"
        :title="t.gpu"
        :series="gpuChartSeries"
        :yFormatter="val => `${val.toFixed(1)}%`"
        :emptyText="t.noPingData"
      />
    </template>
  </main>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  isServerOnline,
  getFlagIconUrl,
  getOSIconUrl,
  formatUptime,
  formatMbSize,
  formatBytes,
  formatSpeed,
  calcUsagePct,
  getMetricTone,
  formatServerBilling,
  getServerExpiryInfo,
  getTrafficQuotaInfo,
  PING_LINE_DEFINITIONS,
  isUnconfiguredPingValue,
  normalizePingMetricValue,
  parseGpuList,
  hasValidDiskIo
} from '../utils/format.js'
import InteractiveChart from '../components/InteractiveChart.vue'

const route = useRoute()
const router = useRouter()
const {
  state,
  t,
  initializeMonitorApp,
  loadSingleServerDetail,
  loadServerHistoryRange,
  startDetailWebSocket
} = useMonitorStore()

const serverId = computed(() => String(route.params.id || '').trim())
const server = computed(() => state.detailServer)
const serverBase = computed(() => state.serverBaseMap[serverId.value] || '')
const online = computed(() => isServerOnline(server.value, state.nowTick))
const flagUrl = computed(() => getFlagIconUrl(server.value?.region, serverBase.value))
const osIconUrl = computed(() => getOSIconUrl(server.value?.os, serverBase.value))

const cpuPct = computed(() => Math.min(100, Math.max(0, Number(server.value?.cpu) || 0)))
const ramPct = computed(() => calcUsagePct(server.value?.ram_used, server.value?.ram_total))
const diskPct = computed(() => calcUsagePct(server.value?.disk_used, server.value?.disk_total))

const billingInfo = computed(() => formatServerBilling(server.value, state.lang))
const expiryInfo = computed(() => getServerExpiryInfo(server.value, state.lang, state.nowTick))
const trafficInfo = computed(() => getTrafficQuotaInfo(server.value))

const parsedTags = computed(() => {
  const raw = String(server.value?.tags || '').trim()
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
})

const timeRangeOptions = computed(() => {
  const zh = state.lang === 'zh'
  return [
    { hours: 0.167, label: zh ? '10分钟' : '10m', requiresAuth: false },
    { hours: 0.5, label: zh ? '30分钟' : '30m', requiresAuth: false },
    { hours: 1, label: zh ? '1小时' : '1h', requiresAuth: false },
    { hours: 6, label: zh ? '6小时' : '6h', requiresAuth: false },
    { hours: 12, label: zh ? '12小时' : '12h', requiresAuth: false },
    { hours: 24, label: zh ? '24小时' : '24h', requiresAuth: false },
    { hours: 48, label: zh ? '2天' : '2d', requiresAuth: true },
    { hours: 96, label: zh ? '4天' : '4d', requiresAuth: true },
    { hours: 168, label: zh ? '7天' : '7d', requiresAuth: true }
  ]
})

const sortedHistoryRows = computed(() => {
  const rows = Array.isArray(state.historyRows) ? state.historyRows : []
  return [...rows].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
})

const resourceChartSeries = computed(() => {
  const rows = sortedHistoryRows.value
  const ramTotal = Number(server.value?.ram_total) || 0

  const cpuPts = rows.map(r => ({
    ts: r.timestamp,
    val: Number.isFinite(Number(r.cpu)) ? Number(r.cpu) : 0
  }))

  const ramPts = rows.map(r => {
    const used = Number(r.ram_used)
    const tot = Number(r.ram_total) || ramTotal
    const pct = tot > 0 && Number.isFinite(used) ? Math.min(100, Math.max(0, (used / tot) * 100)) : 0
    return { ts: r.timestamp, val: pct }
  })

  return [
    {
      key: 'cpu',
      label: t.value.cpu,
      color: '#38bdf8',
      latestText: `${cpuPct.value.toFixed(1)}%`,
      points: cpuPts
    },
    {
      key: 'ram',
      label: t.value.memory,
      color: '#a78bfa',
      latestText: `${ramPct.value.toFixed(1)}%`,
      points: ramPts
    }
  ]
})

const networkChartSeries = computed(() => {
  const rows = sortedHistoryRows.value
  const inPts = rows.map(r => ({
    ts: r.timestamp,
    val: Number(r.net_in_speed) || 0
  }))
  const outPts = rows.map(r => ({
    ts: r.timestamp,
    val: Number(r.net_out_speed) || 0
  }))

  return [
    {
      key: 'net_in',
      label: `↓ ${state.lang === 'zh' ? '下行速率' : 'Inbound'}`,
      color: '#34d399',
      latestText: formatSpeed(server.value?.net_in_speed),
      points: inPts
    },
    {
      key: 'net_out',
      label: `↑ ${state.lang === 'zh' ? '上行速率' : 'Outbound'}`,
      color: '#38bdf8',
      latestText: formatSpeed(server.value?.net_out_speed),
      points: outPts
    }
  ]
})

const pingChartSeries = computed(() => {
  const rows = sortedHistoryRows.value
  const srv = server.value
  if (!srv) return []

  const seriesList = []
  for (const def of PING_LINE_DEFINITIONS) {
    const curPing = normalizePingMetricValue(srv[def.pingField])
    const hasHistory = rows.some(r => !isUnconfiguredPingValue(r?.[def.pingField]))
    if (curPing === false && !hasHistory) continue

    const label = String(state.siteConfig?.[def.configNameField] || def.defaultLabel).trim() || def.defaultLabel
    const pts = rows
      .filter(r => !isUnconfiguredPingValue(r?.[def.pingField]))
      .map(r => ({
        ts: r.timestamp,
        val: normalizePingMetricValue(r[def.pingField]),
        loss: normalizePingMetricValue(r[def.lossField])
      }))

    const latestText = curPing === null
      ? t.value.timeout
      : typeof curPing === 'number'
        ? `${Math.round(curPing)}ms`
        : ''

    seriesList.push({
      key: def.key,
      label,
      color: def.color,
      latestText,
      points: pts
    })
  }
  return seriesList
})

const showDiskIoChart = computed(() => {
  if (hasValidDiskIo(server.value?.disk)) return true
  return sortedHistoryRows.value.some(r => hasValidDiskIo(r?.disk))
})

const diskIoChartSeries = computed(() => {
  if (!showDiskIoChart.value) return []
  const rows = sortedHistoryRows.value.filter(r => r?.disk && typeof r.disk === 'object')
  return [
    {
      key: 'read_bps',
      label: state.lang === 'zh' ? '读取速率' : 'Read B/s',
      color: '#34d399',
      latestText: formatSpeed(server.value?.disk?.read_bps),
      points: rows.map(r => ({ ts: r.timestamp, val: Number(r.disk.read_bps) || 0 }))
    },
    {
      key: 'write_bps',
      label: state.lang === 'zh' ? '写入速率' : 'Write B/s',
      color: '#fb923c',
      latestText: formatSpeed(server.value?.disk?.write_bps),
      points: rows.map(r => ({ ts: r.timestamp, val: Number(r.disk.write_bps) || 0 }))
    }
  ]
})

const gpuChartSeries = computed(() => {
  const curGpus = parseGpuList(server.value?.gpu_info)
  const rows = sortedHistoryRows.value
  const hasAnyGpuHistory = rows.some(r => parseGpuList(r.gpu_info).length > 0)
  if (curGpus.length === 0 && !hasAnyGpuHistory) return []

  const sampleGpus = curGpus.length > 0
    ? curGpus
    : parseGpuList(rows.find(r => parseGpuList(r.gpu_info).length > 0)?.gpu_info)

  const colors = ['#10b981', '#38bdf8', '#f472b6', '#facc15']
  return sampleGpus.map((g, idx) => ({
    key: `gpu_${g.id}`,
    label: g.name,
    color: colors[idx % colors.length],
    latestText: g.info !== null ? `${g.info.toFixed(1)}%` : '',
    points: rows.map(r => {
      const list = parseGpuList(r.gpu_info)
      const found = list.find(item => item.id === g.id) || list[idx]
      return {
        ts: r.timestamp,
        val: found && found.info !== null ? found.info : null
      }
    })
  }))
})

async function changeHours(hours) {
  if (state.historyHours === hours || !serverId.value) return
  try {
    await loadServerHistoryRange(serverId.value, hours)
  } catch {
    // handled in store
  }
}

function goBack() {
  router.push({ name: 'dashboard' })
}

function switchInstance(nextId) {
  if (nextId && nextId !== serverId.value) {
    router.push({ name: 'server-detail', params: { id: nextId } })
  }
}

async function initDetailPage(id) {
  if (!id) return
  state.activeViewType = 'detail'
  state.activeServerId = id
  state.historyHours = 0.167 // Default 10m per rule #5
  try {
    await initializeMonitorApp()
    if (!state.turnstileRequired) {
      await loadSingleServerDetail(id, true)
      startDetailWebSocket(id)
    }
  } catch {
    // error stored in state.errorMsg
  }
}

watch(serverId, (newId) => {
  if (newId) initDetailPage(newId)
})

onMounted(() => {
  if (serverId.value) initDetailPage(serverId.value)
})
</script>
