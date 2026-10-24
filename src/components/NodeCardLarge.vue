<template>
  <article
    class="glass-panel node-card"
    :class="{ 'is-offline': !online }"
    @click="$emit('select', server.id)"
  >
    <!-- Header: Status, Flag, Name, Stack & Billing Badges -->
    <div class="card-header">
      <div class="node-title-row">
        <span class="status-dot" :class="online ? 'online' : 'offline'"></span>
        <img
          v-if="flagUrl"
          :src="flagUrl"
          :alt="server.region"
          class="flag-icon"
          loading="lazy"
        />
        <span v-else style="font-size: 14px;">🌐</span>
        <h3 class="node-name" :title="server.name">{{ server.name }}</h3>
      </div>

      <div class="badge-row">
        <template v-if="state.themeOptions.showIpBadges">
          <span v-if="server.ip_v4 === '1' || server.ip_v4 === 1" class="mini-badge">IPv4</span>
          <span v-if="server.ip_v6 === '1' || server.ip_v6 === 1" class="mini-badge">IPv6</span>
        </template>

        <span
          v-if="showBilling && billingInfo"
          class="mini-badge tone-accent tabular-nums"
        >
          {{ billingInfo.label }}
        </span>

        <span
          v-if="showExpiry && expiryInfo"
          class="mini-badge tabular-nums"
          :class="expiryInfo.tone !== 'normal' ? `tone-${expiryInfo.tone}` : ''"
        >
          {{ expiryInfo.text }}
        </span>
      </div>
    </div>

    <!-- Hardware & OS Strip -->
    <div v-if="state.themeOptions.showSpecsOnCard" class="specs-strip">
      <div class="os-box">
        <img :src="osIconUrl" :alt="osName" class="os-icon" loading="lazy" />
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          {{ osName }}
          <template v-if="server.cpu_cores"> · {{ server.cpu_cores }}C</template>
          <template v-if="server.arch"> · {{ server.arch }}</template>
        </span>
      </div>
      <div class="tabular-nums" style="white-space: nowrap;">
        <span>⏱ {{ uptimeText }}</span>
      </div>
    </div>

    <!-- Resource Progress Bars: CPU / RAM / Disk / GPU -->
    <div class="metrics-stack">
      <!-- CPU -->
      <div class="metric-item">
        <div class="metric-label-row tabular-nums">
          <span class="metric-name">
            {{ t.cpu }}
            <small v-if="shortLoad" style="opacity: 0.75; margin-left: 4px;">({{ shortLoad }})</small>
          </span>
          <span class="metric-val">{{ cpuPct.toFixed(1) }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`tone-${getMetricTone(cpuPct)}`"
            :style="{ width: `${cpuPct}%` }"
          ></div>
        </div>
      </div>

      <!-- RAM -->
      <div class="metric-item">
        <div class="metric-label-row tabular-nums">
          <span class="metric-name">
            {{ t.memory }}
            <small style="opacity: 0.75; margin-left: 4px;">
              {{ formatMbSize(server.ram_used, 1) }} / {{ formatMbSize(server.ram_total, 1) }}
            </small>
          </span>
          <span class="metric-val">{{ ramPct.toFixed(1) }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`tone-${getMetricTone(ramPct)}`"
            :style="{ width: `${ramPct}%` }"
          ></div>
        </div>
      </div>

      <!-- Disk -->
      <div class="metric-item">
        <div class="metric-label-row tabular-nums">
          <span class="metric-name">
            {{ t.disk }}
            <small style="opacity: 0.75; margin-left: 4px;">
              {{ formatMbSize(server.disk_used, 1) }} / {{ formatMbSize(server.disk_total, 1) }}
            </small>
          </span>
          <span class="metric-val">{{ diskPct.toFixed(1) }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`tone-${getMetricTone(diskPct)}`"
            :style="{ width: `${diskPct}%` }"
          ></div>
        </div>
      </div>

      <!-- Optional GPU if present -->
      <div v-if="gpuList.length > 0 && gpuList[0].info !== null" class="metric-item">
        <div class="metric-label-row tabular-nums">
          <span class="metric-name">{{ t.gpu }} ({{ gpuList[0].name }})</span>
          <span class="metric-val">{{ gpuList[0].info.toFixed(1) }}%</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`tone-${getMetricTone(gpuList[0].info)}`"
            :style="{ width: `${Math.min(100, Math.max(0, gpuList[0].info))}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Real-time Network Speed & Monthly Traffic Quota -->
    <div class="net-traffic-box tabular-nums">
      <div class="speed-row">
        <span class="speed-down">↓ {{ formatSpeed(server.net_in_speed) }}</span>
        <span class="speed-up">↑ {{ formatSpeed(server.net_out_speed) }}</span>
      </div>

      <template v-if="showTraffic && trafficInfo">
        <div class="speed-row" style="color: var(--text-secondary); font-size: 11px;">
          <span>↓ {{ formatBytes(trafficInfo.rx, 1) }} · ↑ {{ formatBytes(trafficInfo.tx, 1) }}</span>
          <span v-if="trafficInfo.limitBytes > 0">
            {{ trafficInfo.usedText }} / {{ trafficInfo.limitText }} ({{ trafficInfo.pct.toFixed(0) }}%)
          </span>
          <span v-else>Σ {{ trafficInfo.usedText }}</span>
        </div>
        <div v-if="trafficInfo.limitBytes > 0" class="progress-track" style="height: 5px;">
          <div
            class="progress-fill"
            :class="`tone-${getMetricTone(trafficInfo.pct)}`"
            :style="{ width: `${trafficInfo.pct}%` }"
          ></div>
        </div>
      </template>
    </div>

    <!-- Multi-Line Ping & 2h Window Bucket Strip (Strictly uses servers[].ping / loss) -->
    <div v-if="showPingSection && visiblePingLines.length > 0" class="ping-section tabular-nums">
      <div
        v-for="line in visiblePingLines"
        :key="line.key"
        class="ping-line-row"
      >
        <div class="ping-line-head">
          <span class="ping-line-name">
            <span class="ping-color-dot" :style="{ backgroundColor: line.color }"></span>
            <span>{{ line.label }}</span>
          </span>
          <span class="ping-stats-right">
            <span
              v-if="line.loss !== false && line.loss !== null"
              :style="{ color: line.loss > 0 ? 'var(--tone-warning)' : 'var(--text-secondary)' }"
            >
              {{ line.loss.toFixed(0) }}% {{ t.packetLoss }}
            </span>
            <strong
              :style="{
                color: line.ping === null
                  ? 'var(--tone-danger)'
                  : getPingLatencyTone(line.ping, line.loss) === 'danger'
                    ? 'var(--tone-danger)'
                    : getPingLatencyTone(line.ping, line.loss) === 'warning'
                      ? 'var(--tone-warning)'
                      : 'var(--tone-normal)'
              }"
            >
              {{ line.ping === null ? t.timeout : `${Math.round(line.ping)} ms` }}
            </strong>
          </span>
        </div>

        <!-- 2h Window Sparkline Strip: Only rendered when sysConfig.show_three_net_details === true and window array is non-empty -->
        <div
          v-if="state.sysConfig.show_three_net_details === true && line.buckets.length > 0"
          class="bucket-strip"
        >
          <span
            v-for="(b, idx) in padBuckets(line.buckets, 20)"
            :key="idx"
            class="bucket-cell"
            :class="b ? `tone-${getPingLatencyTone(b.rtt, b.loss)}` : ''"
            :title="b ? formatBucketTip(line.label, b) : ''"
          ></span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  isServerOnline,
  getFlagIconUrl,
  getOSIconUrl,
  getShortOSName,
  formatUptime,
  formatMbSize,
  formatBytes,
  formatSpeed,
  calcUsagePct,
  getMetricTone,
  formatServerBilling,
  getServerExpiryInfo,
  getTrafficQuotaInfo,
  extractConfiguredPingLines,
  getPingLatencyTone,
  parseGpuList
} from '../utils/format.js'

const props = defineProps({
  server: {
    type: Object,
    required: true
  }
})

defineEmits(['select'])

const { state, t } = useMonitorStore()

const serverBase = computed(() => state.serverBaseMap[props.server.id] || '')
const online = computed(() => isServerOnline(props.server, state.nowTick))
const flagUrl = computed(() => getFlagIconUrl(props.server.region, serverBase.value))
const osIconUrl = computed(() => getOSIconUrl(props.server.os, serverBase.value))
const osName = computed(() => getShortOSName(props.server.os))
const uptimeText = computed(() => formatUptime(props.server.boot_time, state.lang, state.nowTick))

const cpuPct = computed(() => Math.min(100, Math.max(0, Number(props.server.cpu) || 0)))
const ramPct = computed(() => calcUsagePct(props.server.ram_used, props.server.ram_total))
const diskPct = computed(() => calcUsagePct(props.server.disk_used, props.server.disk_total))

const shortLoad = computed(() => {
  const raw = String(props.server.load_avg || '').trim()
  if (!raw) return ''
  return raw.split(/[\s,]+/)[0] || ''
})

const gpuList = computed(() => parseGpuList(props.server.gpu_info))

const showBilling = computed(() => state.sysConfig.show_price !== false && state.themeOptions.showBillingOnCard)
const showExpiry = computed(() => state.sysConfig.show_expire !== false && state.themeOptions.showBillingOnCard)
const showTraffic = computed(() => state.sysConfig.show_tf !== false && state.themeOptions.showTrafficOnCard)
const showPingSection = computed(() => state.themeOptions.showPingStrip)

const billingInfo = computed(() => formatServerBilling(props.server, state.lang))
const expiryInfo = computed(() => getServerExpiryInfo(props.server, state.lang, state.nowTick))
const trafficInfo = computed(() => getTrafficQuotaInfo(props.server))

const visiblePingLines = computed(() => {
  const all = extractConfiguredPingLines(props.server, state.siteConfig)
  const limit = Math.max(1, Math.min(8, Number(state.themeOptions.pingLinesLimit) || 6))
  return all.slice(0, limit)
})

function padBuckets(buckets, count = 20) {
  const sliced = buckets.slice(-count)
  if (sliced.length >= count) return sliced
  const pad = new Array(count - sliced.length).fill(null)
  return [...pad, ...sliced]
}

function formatBucketTip(label, b) {
  const timeStr = b.ts ? new Date(b.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const rttStr = b.rtt === null ? t.value.timeout : `${Math.round(b.rtt)}ms`
  const lossStr = typeof b.loss === 'number' ? ` | Loss: ${b.loss}%` : ''
  return `${label} [${timeStr}] ${rttStr}${lossStr}`
}
</script>
