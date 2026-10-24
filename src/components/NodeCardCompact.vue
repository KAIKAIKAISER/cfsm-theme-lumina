<template>
  <article
    class="glass-panel node-card"
    style="padding: 13px 15px; gap: 10px;"
    :class="{ 'is-offline': !online }"
    @click="$emit('select', server.id)"
  >
    <div class="card-header">
      <div class="node-title-row">
        <span class="status-dot" :class="online ? 'online' : 'offline'"></span>
        <img v-if="flagUrl" :src="flagUrl" :alt="server.region" class="flag-icon" loading="lazy" />
        <img :src="osIconUrl" :alt="osName" class="os-icon" loading="lazy" />
        <h3 class="node-name" style="font-size: 14px;" :title="server.name">{{ server.name }}</h3>
      </div>
      <span v-if="billingInfo && state.sysConfig.show_price !== false" class="mini-badge tabular-nums">
        {{ billingInfo.label }}
      </span>
    </div>

    <!-- 3 Inline Mini Bars: CPU / RAM / Disk -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;" class="tabular-nums">
      <div class="metric-item">
        <div class="metric-label-row" style="font-size: 11px;">
          <span class="metric-name">CPU</span>
          <span class="metric-val">{{ cpuPct.toFixed(0) }}%</span>
        </div>
        <div class="progress-track" style="height: 5px;">
          <div class="progress-fill" :class="`tone-${getMetricTone(cpuPct)}`" :style="{ width: `${cpuPct}%` }"></div>
        </div>
      </div>

      <div class="metric-item">
        <div class="metric-label-row" style="font-size: 11px;">
          <span class="metric-name">RAM</span>
          <span class="metric-val">{{ ramPct.toFixed(0) }}%</span>
        </div>
        <div class="progress-track" style="height: 5px;">
          <div class="progress-fill" :class="`tone-${getMetricTone(ramPct)}`" :style="{ width: `${ramPct}%` }"></div>
        </div>
      </div>

      <div class="metric-item">
        <div class="metric-label-row" style="font-size: 11px;">
          <span class="metric-name">DSK</span>
          <span class="metric-val">{{ diskPct.toFixed(0) }}%</span>
        </div>
        <div class="progress-track" style="height: 5px;">
          <div class="progress-fill" :class="`tone-${getMetricTone(diskPct)}`" :style="{ width: `${diskPct}%` }"></div>
        </div>
      </div>
    </div>

    <div class="speed-row tabular-nums" style="font-size: 11px; padding-top: 4px; border-top: 1px solid var(--border-subtle);">
      <span class="speed-down">↓ {{ formatSpeed(server.net_in_speed) }}</span>
      <span class="speed-up">↑ {{ formatSpeed(server.net_out_speed) }}</span>
    </div>

    <!-- Compact Ping Badges -->
    <div v-if="pingLines.length > 0 && state.themeOptions.showPingStrip" class="badge-row tabular-nums">
      <span
        v-for="line in pingLines.slice(0, 6)"
        :key="line.key"
        class="mini-badge"
        :class="getPingLatencyTone(line.ping, line.loss) !== 'normal' ? `tone-${getPingLatencyTone(line.ping, line.loss)}` : ''"
      >
        {{ line.label }}: {{ line.ping === null ? t.timeout : `${Math.round(line.ping)}ms` }}
      </span>
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
  formatSpeed,
  calcUsagePct,
  getMetricTone,
  formatServerBilling,
  extractConfiguredPingLines,
  getPingLatencyTone
} from '../utils/format.js'

const props = defineProps({
  server: { type: Object, required: true }
})

defineEmits(['select'])

const { state, t } = useMonitorStore()

const serverBase = computed(() => state.serverBaseMap[props.server.id] || '')
const online = computed(() => isServerOnline(props.server, state.nowTick))
const flagUrl = computed(() => getFlagIconUrl(props.server.region, serverBase.value))
const osIconUrl = computed(() => getOSIconUrl(props.server.os, serverBase.value))
const osName = computed(() => getShortOSName(props.server.os))

const cpuPct = computed(() => Math.min(100, Math.max(0, Number(props.server.cpu) || 0)))
const ramPct = computed(() => calcUsagePct(props.server.ram_used, props.server.ram_total))
const diskPct = computed(() => calcUsagePct(props.server.disk_used, props.server.disk_total))
const billingInfo = computed(() => formatServerBilling(props.server, state.lang))
const pingLines = computed(() => extractConfiguredPingLines(props.server, state.siteConfig))
</script>
