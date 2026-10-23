<template>
  <section v-if="state.themeOptions.showOverviewBanner" class="overview-grid">
    <!-- Card 1: Nodes Status -->
    <div class="glass-panel summary-card">
      <div class="summary-head">
        <span>{{ t.totalNodes }}</span>
        <span class="mini-badge tone-accent tabular-nums">{{ onlineRateText }}</span>
      </div>
      <div class="summary-main tabular-nums">
        <span>{{ state.stats.online }}</span>
        <span style="font-size: 14px; color: var(--text-secondary); font-weight: 500;">
          / {{ state.stats.total }} {{ t.online }}
        </span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill tone-normal"
          :style="{ width: onlinePct + '%' }"
        ></div>
      </div>
      <div class="summary-sub tabular-nums">
        <span style="color: var(--tone-normal);">● {{ t.online }}: {{ state.stats.online }}</span>
        <span style="color: var(--tone-danger);">● {{ t.offline }}: {{ state.stats.offline }}</span>
      </div>
    </div>

    <!-- Card 2: Live Bandwidth -->
    <div class="glass-panel summary-card">
      <div class="summary-head">
        <span>{{ t.realtimeBandwidth }}</span>
        <span>⚡</span>
      </div>
      <div class="summary-main tabular-nums" style="font-size: 20px;">
        <span class="speed-down">↓ {{ formatSpeed(state.stats.globalSpeedIn) }}</span>
      </div>
      <div class="summary-sub tabular-nums">
        <span class="speed-up">↑ {{ formatSpeed(state.stats.globalSpeedOut) }}</span>
        <span>Σ {{ formatSpeed((state.stats.globalSpeedIn || 0) + (state.stats.globalSpeedOut || 0)) }}</span>
      </div>
    </div>

    <!-- Card 3: Monthly Traffic -->
    <div v-if="state.sysConfig.show_tf !== false" class="glass-panel summary-card">
      <div class="summary-head">
        <span>{{ t.monthlyTraffic }}</span>
        <span>📊</span>
      </div>
      <div class="summary-main tabular-nums" style="font-size: 20px;">
        <span>{{ formatBytes((state.stats.globalNetRx || 0) + (state.stats.globalNetTx || 0)) }}</span>
      </div>
      <div class="summary-sub tabular-nums">
        <span>↓ {{ formatBytes(state.stats.globalNetRx) }}</span>
        <span>↑ {{ formatBytes(state.stats.globalNetTx) }}</span>
      </div>
    </div>

    <!-- Card 4: Asset & Billing Summary -->
    <div
      v-if="state.sysConfig.show_price !== false || state.sysConfig.show_expire !== false"
      class="glass-panel summary-card"
    >
      <div class="summary-head">
        <span>{{ t.assetSummary }}</span>
        <span>💎</span>
      </div>
      <div class="summary-main tabular-nums" style="font-size: 20px;">
        <span v-if="state.sysConfig.show_price !== false">
          ≈ ¥{{ billingOverview.totalMonthlyCny.toFixed(1) }}
          <small style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">/ {{ state.lang === 'zh' ? '月' : 'mo' }}</small>
        </span>
        <span v-else>{{ billingOverview.expiringCount }} {{ t.expiringSoon }}</span>
      </div>
      <div class="summary-sub tabular-nums">
        <span>{{ t.expiringSoon }} (≤14d): <strong :style="{ color: billingOverview.expiringCount > 0 ? 'var(--tone-warning)' : 'inherit' }">{{ billingOverview.expiringCount }}</strong></span>
        <span>{{ Object.keys(state.regionStats || {}).length }} Regions</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  formatBytes,
  formatSpeed,
  formatServerBilling,
  getServerExpiryInfo
} from '../utils/format.js'

const { state, t } = useMonitorStore()

const onlinePct = computed(() => {
  const total = Number(state.stats.total) || 0
  if (total <= 0) return 0
  return Math.min(100, Math.round(((Number(state.stats.online) || 0) / total) * 100))
})

const onlineRateText = computed(() => `${onlinePct.value}%`)

const billingOverview = computed(() => {
  let totalMonthlyCny = 0
  let expiringCount = 0
  const now = state.nowTick

  for (const srv of state.servers) {
    const bill = formatServerBilling(srv, state.lang)
    if (bill && !bill.isFree && Number.isFinite(bill.monthlyCny)) {
      totalMonthlyCny += bill.monthlyCny
    }
    const exp = getServerExpiryInfo(srv, state.lang, now)
    if (exp && exp.daysLeft !== null && exp.daysLeft <= 14) {
      expiringCount++
    }
  }

  return {
    totalMonthlyCny,
    expiringCount
  }
})
</script>
