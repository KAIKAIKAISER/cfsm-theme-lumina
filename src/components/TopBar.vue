<template>
  <header class="glass-panel top-bar">
    <div class="top-nav-main">
      <div class="brand-group" @click="goHome">
        <div class="brand-logo-orb">L</div>
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
      <div v-if="showLayoutToggle" class="layout-dropdown" ref="layoutDropdownRef">
        <button
          type="button"
          class="icon-btn layout-dropdown-trigger"
          :class="{ open: isLayoutDropdownOpen }"
          @click="toggleLayoutDropdown"
          :aria-expanded="isLayoutDropdownOpen"
          :title="t.defaultView"
        >
          <span class="layout-btn-icon">{{ currentLayout.icon }}</span>
          <span class="layout-btn-label">{{ currentLayout.label }}</span>
          <svg
            class="dropdown-chevron"
            :class="{ 'is-open': isLayoutDropdownOpen }"
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        <transition name="dropdown-fade">
          <div v-if="isLayoutDropdownOpen" class="layout-dropdown-menu glass-panel">
            <button
              v-for="mode in layoutModes"
              :key="mode.id"
              type="button"
              class="layout-dropdown-item"
              :class="{ active: state.themeOptions.layout === mode.id }"
              @click="selectLayout(mode.id)"
            >
              <span class="item-icon">{{ mode.icon }}</span>
              <span class="item-label">{{ mode.label }}</span>
              <span v-if="state.themeOptions.layout === mode.id" class="item-check">✓</span>
            </button>
          </div>
        </transition>
      </div>

      <button type="button" class="icon-btn" @click="cycleThemeMode" :title="t.themeMode">
        <span>{{ state.effectiveColorScheme === 'dark' ? '🌙' : '☀️' }}</span>
      </button>

      <button type="button" class="icon-btn" @click="toggleLanguage" :title="state.lang === 'zh' ? 'English' : '简体中文'">
        <span>{{ state.lang === 'zh' ? 'EN' : '中' }}</span>
      </button>

      <button type="button" class="icon-btn" @click="state.settingsDrawerOpen = true" :title="t.themeSettings">
        <span>⚙️</span>
        <span class="btn-text">{{ t.themeSettings }}</span>
      </button>

      <a class="icon-btn" :href="adminUrl" :title="t.adminPanel">
        <span>🛡️</span>
        <span class="btn-text">{{ t.adminPanel }}</span>
      </a>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import { getAdminEntryUrl, getStaticSiteTitle } from '../utils/config.js'

const router = useRouter()
const route = useRoute()
const { state, t, updateThemePreference, toggleLanguage } = useMonitorStore()

const showLayoutToggle = computed(() => route.name !== 'server-detail')
const isLayoutDropdownOpen = ref(false)
const layoutDropdownRef = ref(null)

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

const currentLayout = computed(() => {
  return layoutModes.value.find(m => m.id === state.themeOptions.layout) || layoutModes.value[0]
})

function toggleLayoutDropdown() {
  isLayoutDropdownOpen.value = !isLayoutDropdownOpen.value
}

function selectLayout(modeId) {
  updateThemePreference('layout', modeId)
  isLayoutDropdownOpen.value = false
}

function handleClickOutside(event) {
  if (layoutDropdownRef.value && !layoutDropdownRef.value.contains(event.target)) {
    isLayoutDropdownOpen.value = false
  }
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    isLayoutDropdownOpen.value = false
  }
}

watch(
  () => route.name,
  () => {
    isLayoutDropdownOpen.value = false
  }
)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

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
