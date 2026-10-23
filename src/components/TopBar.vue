<template>
  <header class="glass-panel top-bar">
    <div class="brand-group" @click="goHome">
      <div class="brand-logo-orb">L</div>
      <div>
        <div class="brand-title">{{ displayTitle }}</div>
      </div>
      <div
        class="ws-badge"
        :class="{
          'is-live': state.wsStatus === 'live',
          'is-reconnecting': state.wsStatus === 'reconnecting'
        }"
      >
        <span class="ws-dot"></span>
        <span>{{ wsStatusText }}</span>
      </div>
    </div>

    <div class="top-actions">
      <div v-if="showLayoutToggle" class="layout-segmented">
        <button
          v-for="mode in layoutModes"
          :key="mode.id"
          type="button"
          class="seg-btn"
          :class="{ active: state.themeOptions.layout === mode.id }"
          @click="updateThemePreference('layout', mode.id)"
        >
          <span>{{ mode.icon }}</span>
          <span>{{ mode.label }}</span>
        </button>
      </div>

      <button type="button" class="icon-btn" @click="cycleThemeMode" :title="t.themeMode">
        <span>{{ state.effectiveColorScheme === 'dark' ? '🌙' : '☀️' }}</span>
      </button>

      <button type="button" class="icon-btn" @click="toggleLanguage">
        <span>{{ state.lang === 'zh' ? 'EN' : '中' }}</span>
      </button>

      <button type="button" class="icon-btn" @click="state.settingsDrawerOpen = true">
        <span>⚙️</span>
        <span>{{ t.themeSettings }}</span>
      </button>

      <a class="icon-btn" :href="adminUrl">
        <span>🛡️</span>
        <span>{{ t.adminPanel }}</span>
      </a>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import { getAdminEntryUrl, getStaticSiteTitle } from '../utils/config.js'

const router = useRouter()
const route = useRoute()
const { state, t, updateThemePreference, toggleLanguage } = useMonitorStore()

const showLayoutToggle = computed(() => route.name !== 'server-detail')

const displayTitle = computed(() => {
  return getStaticSiteTitle() || state.siteConfig.site_title || t.value.siteDefaultTitle
})

const adminUrl = computed(() => getAdminEntryUrl())

const wsStatusText = computed(() => {
  if (state.wsStatus === 'live') return t.value.wsLive
  if (state.wsStatus === 'reconnecting') return t.value.wsReconnecting
  if (state.wsStatus === 'paused') return t.value.wsPaused
  return t.value.wsDisconnected
})

const layoutModes = computed(() => [
  { id: 'large', icon: '⊞', label: t.value.viewLarge },
  { id: 'compact', icon: '▤', label: t.value.viewCompact },
  { id: 'mini', icon: '▪', label: t.value.viewMini },
  { id: 'table', icon: '≡', label: t.value.viewTable }
])

function cycleThemeMode() {
  const next = state.effectiveColorScheme === 'dark' ? 'light' : 'dark'
  updateThemePreference('themeMode', next)
}

function goHome() {
  if (route.name !== 'dashboard') {
    router.push({ name: 'dashboard' })
  }
}
</script>
