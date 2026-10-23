<template>
  <div v-if="state.settingsDrawerOpen" class="modal-backdrop" @click.self="state.settingsDrawerOpen = false">
    <aside class="drawer-panel">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700;">{{ t.settingsTitle }}</h3>
          <p style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
            {{ t.settingsSubtitle }}
          </p>
        </div>
        <button type="button" class="icon-btn" @click="state.settingsDrawerOpen = false">✕</button>
      </div>

      <div v-if="state.saveStatusHint" class="mini-badge tone-accent" style="padding: 6px 10px;">
        ✓ {{ state.saveStatusHint }}
      </div>

      <!-- Group 1: Appearance -->
      <div class="setting-group">
        <div class="setting-group-title">{{ t.secAppearance }}</div>

        <div class="setting-row">
          <span>{{ t.themeMode }}</span>
          <div class="layout-segmented">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: state.themeOptions.themeMode === 'auto' }"
              @click="updateThemePreference('themeMode', 'auto')"
            >{{ t.modeAuto }}</button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: state.themeOptions.themeMode === 'dark' }"
              @click="updateThemePreference('themeMode', 'dark')"
            >{{ t.modeDark }}</button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: state.themeOptions.themeMode === 'light' }"
              @click="updateThemePreference('themeMode', 'light')"
            >{{ t.modeLight }}</button>
          </div>
        </div>

        <div class="setting-row">
          <span>{{ t.accentColor }}</span>
          <div class="color-swatches">
            <button
              v-for="sw in swatches"
              :key="sw.id"
              type="button"
              class="swatch-btn"
              :class="{ active: state.themeOptions.accent === sw.id }"
              :style="{ backgroundColor: sw.color }"
              @click="updateThemePreference('accent', sw.id)"
            ></button>
          </div>
        </div>

        <div class="setting-row">
          <span>{{ t.glassOpacity }} ({{ state.themeOptions.glassOpacity }}%)</span>
          <input
            type="range"
            min="50"
            max="98"
            :value="state.themeOptions.glassOpacity"
            @input="updateThemePreference('glassOpacity', Number($event.target.value))"
          />
        </div>
      </div>

      <!-- Group 2: Layout & Card Elements -->
      <div class="setting-group">
        <div class="setting-group-title">{{ t.secCardLayout }}</div>

        <div class="setting-row">
          <span>{{ t.cardLayoutMode }}</span>
          <select
            class="sort-select"
            :value="state.themeOptions.layout"
            @change="updateThemePreference('layout', $event.target.value)"
          >
            <option value="large">{{ t.viewLarge }}</option>
            <option value="compact">{{ t.viewCompact }}</option>
            <option value="mini">{{ t.viewMini }}</option>
            <option value="table">{{ t.viewTable }}</option>
          </select>
        </div>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showOverviewBanner }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showOverviewBanner"
            @change="updateThemePreference('showOverviewBanner', $event.target.checked)"
          />
        </label>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showBillingOnCard }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showBillingOnCard"
            @change="updateThemePreference('showBillingOnCard', $event.target.checked)"
          />
        </label>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showTrafficOnCard }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showTrafficOnCard"
            @change="updateThemePreference('showTrafficOnCard', $event.target.checked)"
          />
        </label>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showSpecsOnCard }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showSpecsOnCard"
            @change="updateThemePreference('showSpecsOnCard', $event.target.checked)"
          />
        </label>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showIpBadges }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showIpBadges"
            @change="updateThemePreference('showIpBadges', $event.target.checked)"
          />
        </label>
      </div>

      <!-- Group 3: Ping & Loss Strip -->
      <div class="setting-group">
        <div class="setting-group-title">{{ t.secPingDisplay }}</div>

        <label class="setting-row" style="cursor: pointer;">
          <span>{{ t.showPingStrip }}</span>
          <input
            type="checkbox"
            :checked="state.themeOptions.showPingStrip"
            @change="updateThemePreference('showPingStrip', $event.target.checked)"
          />
        </label>

        <div class="setting-row">
          <span>{{ t.pingLinesLimit }} ({{ state.themeOptions.pingLinesLimit }})</span>
          <input
            type="range"
            min="1"
            max="8"
            :value="state.themeOptions.pingLinesLimit"
            @input="updateThemePreference('pingLinesLimit', Number($event.target.value))"
          />
        </div>
      </div>

      <!-- Actions -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;">
        <button type="button" class="icon-btn" style="justify-content: center;" @click="copyJson">
          📋 {{ t.copyThemeJson }}
        </button>
        <button type="button" class="icon-btn" style="justify-content: center;" @click="resetThemePreferencesToSiteDefault">
          ↺ {{ t.resetToSiteDefault }}
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { useMonitorStore } from '../composables/useMonitorStore.js'

const { state, t, updateThemePreference, resetThemePreferencesToSiteDefault } = useMonitorStore()

const swatches = [
  { id: 'cyan', color: '#06b6d4' },
  { id: 'emerald', color: '#10b981' },
  { id: 'violet', color: '#8b5cf6' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'rose', color: '#f43f5e' }
]

async function copyJson() {
  try {
    const json = JSON.stringify(state.themeOptions, null, 2)
    await navigator.clipboard.writeText(json)
    state.saveStatusHint = t.value.copiedSuccess
    setTimeout(() => { state.saveStatusHint = '' }, 2000)
  } catch {
    // ignore clipboard error
  }
}
</script>
