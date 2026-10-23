<template>
  <article
    class="glass-panel node-card"
    style="padding: 11px 13px; gap: 8px;"
    :class="{ 'is-offline': !online }"
    @click="$emit('select', server.id)"
  >
    <div class="card-header">
      <div class="node-title-row">
        <span class="status-dot" :class="online ? 'online' : 'offline'"></span>
        <img v-if="flagUrl" :src="flagUrl" :alt="server.region" class="flag-icon" loading="lazy" />
        <h3 class="node-name" style="font-size: 13px;" :title="server.name">{{ server.name }}</h3>
      </div>
      <span v-if="primaryPing" class="mini-badge tabular-nums">
        {{ primaryPing.ping === null ? t.timeout : `${Math.round(primaryPing.ping)}ms` }}
      </span>
    </div>

    <div class="speed-row tabular-nums" style="font-size: 11px; color: var(--text-secondary);">
      <span>CPU <strong style="color: var(--text-primary);">{{ cpuPct.toFixed(0) }}%</strong></span>
      <span>RAM <strong style="color: var(--text-primary);">{{ ramPct.toFixed(0) }}%</strong></span>
      <span class="speed-down">↓{{ formatSpeed(server.net_in_speed) }}</span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  isServerOnline,
  getFlagIconUrl,
  formatSpeed,
  calcUsagePct,
  extractConfiguredPingLines
} from '../utils/format.js'

const props = defineProps({
  server: { type: Object, required: true }
})

defineEmits(['select'])

const { state, t } = useMonitorStore()

const serverBase = computed(() => state.serverBaseMap[props.server.id] || '')
const online = computed(() => isServerOnline(props.server, state.nowTick))
const flagUrl = computed(() => getFlagIconUrl(props.server.region, serverBase.value))
const cpuPct = computed(() => Math.min(100, Math.max(0, Number(props.server.cpu) || 0)))
const ramPct = computed(() => calcUsagePct(props.server.ram_used, props.server.ram_total))
const primaryPing = computed(() => {
  const lines = extractConfiguredPingLines(props.server, state.siteConfig)
  return lines[0] || null
})
</script>
