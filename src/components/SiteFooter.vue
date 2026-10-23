<template>
  <footer class="site-footer">
    <div>
      <span>Powered by </span>
      <a href="https://github.com/huilang-me/CF-Server-Monitor/" target="_blank" rel="noopener noreferrer">
        CF-Server-Monitor
      </a>
      <span v-if="state.siteConfig.version" class="tabular-nums" style="margin-left: 5px;">
        v{{ state.siteConfig.version.replace(/^v/i, '') }}
      </span>
      <span
        v-if="hasWorkersUpdate"
        class="mini-badge tone-accent tabular-nums"
        style="margin-left: 8px;"
      >
        ↑ {{ t.upgradeHint }} v{{ state.siteConfig.last_workers_version.replace(/^v/i, '') }}
      </span>
    </div>

    <div class="tabular-nums" style="opacity: 0.8;">
      <span>Theme: LuminaCustom v1.0.0</span>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../composables/useMonitorStore.js'

const { state, t } = useMonitorStore()

const hasWorkersUpdate = computed(() => {
  if (!state.siteConfig.authorization) return false
  const cur = String(state.siteConfig.version || '').trim().replace(/^v/i, '')
  const latest = String(state.siteConfig.last_workers_version || '').trim().replace(/^v/i, '')
  return Boolean(cur && latest && cur !== latest)
})
</script>
