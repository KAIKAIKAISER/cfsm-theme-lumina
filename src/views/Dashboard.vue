<template>
  <main style="display: flex; flex-direction: column; gap: 16px;">
    <OverviewBanner />

    <!-- Filter & Search Toolbar -->
    <section class="glass-panel filter-toolbar">
      <div class="region-tabs">
        <!-- All Nodes Pill -->
        <button
          type="button"
          class="region-pill"
          :class="{ active: activeRegion === 'ALL' && statusFilter === 'ALL' }"
          @click="resetFilters"
        >
          <span>🌐</span>
          <span>{{ t.allNodes }}</span>
          <span class="pill-count tabular-nums">{{ state.servers.length }}</span>
        </button>

        <!-- Online / Offline Quick Filters -->
        <button
          type="button"
          class="region-pill"
          :class="{ active: statusFilter === 'ONLINE' }"
          @click="toggleStatusFilter('ONLINE')"
        >
          <span style="color: var(--tone-normal);">●</span>
          <span>{{ t.online }}</span>
          <span class="pill-count tabular-nums">{{ state.stats.online }}</span>
        </button>

        <button
          v-if="state.stats.offline > 0"
          type="button"
          class="region-pill"
          :class="{ active: statusFilter === 'OFFLINE' }"
          @click="toggleStatusFilter('OFFLINE')"
        >
          <span style="color: var(--tone-danger);">●</span>
          <span>{{ t.offline }}</span>
          <span class="pill-count tabular-nums">{{ state.stats.offline }}</span>
        </button>

        <!-- Region Pills -->
        <button
          v-for="reg in regionEntries"
          :key="reg.code"
          type="button"
          class="region-pill"
          :class="{ active: activeRegion === reg.code }"
          @click="activeRegion = activeRegion === reg.code ? 'ALL' : reg.code"
        >
          <img v-if="reg.flagUrl" :src="reg.flagUrl" :alt="reg.code" class="flag-icon" loading="lazy" />
          <span>{{ reg.label }}</span>
          <span class="pill-count tabular-nums">{{ reg.count }}</span>
        </button>
      </div>

      <!-- Search & Sort -->
      <div class="search-sort-group">
        <input
          v-model.trim="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t.searchPlaceholder"
        />

        <select v-model="sortField" class="sort-select">
          <option value="default">{{ t.sortDefault }}</option>
          <option value="name">{{ t.sortName }}</option>
          <option value="cpu">{{ t.sortCpu }}</option>
          <option value="ram">{{ t.sortRam }}</option>
          <option value="disk">{{ t.sortDisk }}</option>
          <option value="speed">{{ t.sortSpeed }}</option>
          <option value="traffic">{{ t.sortTraffic }}</option>
          <option value="ping">{{ t.sortPing }}</option>
          <option value="expire">{{ t.sortExpire }}</option>
        </select>

        <button
          type="button"
          class="icon-btn"
          @click="sortAsc = !sortAsc"
          :title="sortAsc ? 'Ascending' : 'Descending'"
        >
          <span>{{ sortAsc ? '↑' : '↓' }}</span>
        </button>
      </div>
    </section>

    <!-- Error Notice -->
    <div
      v-if="state.errorMsg"
      class="glass-panel"
      style="padding: 14px 18px; border-color: rgba(239, 68, 68, 0.45); color: var(--tone-danger); font-size: 13px;"
    >
      ⚠️ {{ state.errorMsg }}
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="state.loadingServers && state.servers.length === 0"
      class="glass-panel"
      style="padding: 48px 20px; text-align: center; color: var(--text-secondary);"
    >
      Loading server metrics...
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredServers.length === 0"
      class="glass-panel"
      style="padding: 48px 20px; text-align: center; color: var(--text-secondary);"
    >
      {{ t.emptyServers }}
    </div>

    <!-- Layout 1: Large Cards -->
    <div v-else-if="state.themeOptions.layout === 'large'" class="nodes-grid-large">
      <NodeCardLarge
        v-for="srv in filteredServers"
        :key="srv.id"
        :server="srv"
        @select="openServerDetail"
      />
    </div>

    <!-- Layout 2: Compact Cards -->
    <div v-else-if="state.themeOptions.layout === 'compact'" class="nodes-grid-compact">
      <NodeCardCompact
        v-for="srv in filteredServers"
        :key="srv.id"
        :server="srv"
        @select="openServerDetail"
      />
    </div>

    <!-- Layout 3: Mini Cards -->
    <div v-else-if="state.themeOptions.layout === 'mini'" class="nodes-grid-mini">
      <NodeCardMini
        v-for="srv in filteredServers"
        :key="srv.id"
        :server="srv"
        @select="openServerDetail"
      />
    </div>

    <!-- Layout 4: Table View -->
    <NodeListTable
      v-else
      :servers="filteredServers"
      @select="openServerDetail"
    />
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  isServerOnline,
  getFlagIconUrl,
  getRegionDisplayName,
  calcUsagePct,
  getTrafficQuotaInfo,
  extractConfiguredPingLines
} from '../utils/format.js'
import OverviewBanner from '../components/OverviewBanner.vue'
import NodeCardLarge from '../components/NodeCardLarge.vue'
import NodeCardCompact from '../components/NodeCardCompact.vue'
import NodeCardMini from '../components/NodeCardMini.vue'
import NodeListTable from '../components/NodeListTable.vue'

const router = useRouter()
const {
  state,
  t,
  initializeMonitorApp,
  loadServersOnce,
  startHomeWebSockets
} = useMonitorStore()

const activeRegion = ref('ALL')
const statusFilter = ref('ALL')
const searchQuery = ref('')
const sortField = ref('default')
const sortAsc = ref(true)

function resetFilters() {
  activeRegion.value = 'ALL'
  statusFilter.value = 'ALL'
}

function toggleStatusFilter(target) {
  statusFilter.value = statusFilter.value === target ? 'ALL' : target
}

const regionEntries = computed(() => {
  const counts = new Map()
  for (const srv of state.servers) {
    const code = String(srv.region || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN'
    counts.set(code, (counts.get(code) || 0) + 1)
  }
  return Array.from(counts.entries()).map(([code, count]) => ({
    code,
    count,
    label: getRegionDisplayName(code, state.lang),
    flagUrl: getFlagIconUrl(code)
  }))
})

const filteredServers = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const now = state.nowTick

  const list = state.servers.filter(srv => {
    if (statusFilter.value === 'ONLINE' && !isServerOnline(srv, now)) return false
    if (statusFilter.value === 'OFFLINE' && isServerOnline(srv, now)) return false

    if (activeRegion.value !== 'ALL') {
      const code = String(srv.region || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN'
      if (code !== activeRegion.value) return false
    }

    if (q) {
      const hay = [
        srv.name,
        srv.region,
        srv.server_group,
        srv.tags,
        srv.os,
        srv.cpu_info
      ].map(x => String(x || '').toLowerCase()).join(' ')
      if (!hay.includes(q)) return false
    }

    return true
  })

  const dir = sortAsc.value ? 1 : -1

  return [...list].sort((a, b) => {
    if (sortField.value === 'default') {
      const orderA = Number(a.sort_order) || 0
      const orderB = Number(b.sort_order) || 0
      if (orderA !== orderB) return (orderA - orderB) * dir
      return String(a.name || '').localeCompare(String(b.name || '')) * dir
    }
    if (sortField.value === 'name') {
      return String(a.name || '').localeCompare(String(b.name || '')) * dir
    }
    if (sortField.value === 'cpu') {
      return ((Number(a.cpu) || 0) - (Number(b.cpu) || 0)) * dir
    }
    if (sortField.value === 'ram') {
      return (calcUsagePct(a.ram_used, a.ram_total) - calcUsagePct(b.ram_used, b.ram_total)) * dir
    }
    if (sortField.value === 'disk') {
      return (calcUsagePct(a.disk_used, a.disk_total) - calcUsagePct(b.disk_used, b.disk_total)) * dir
    }
    if (sortField.value === 'speed') {
      const spdA = (Number(a.net_in_speed) || 0) + (Number(a.net_out_speed) || 0)
      const spdB = (Number(b.net_in_speed) || 0) + (Number(b.net_out_speed) || 0)
      return (spdA - spdB) * dir
    }
    if (sortField.value === 'traffic') {
      const tfA = getTrafficQuotaInfo(a)?.used || 0
      const tfB = getTrafficQuotaInfo(b)?.used || 0
      return (tfA - tfB) * dir
    }
    if (sortField.value === 'ping') {
      const linesA = extractConfiguredPingLines(a, state.siteConfig).filter(l => typeof l.ping === 'number')
      const linesB = extractConfiguredPingLines(b, state.siteConfig).filter(l => typeof l.ping === 'number')
      const avgA = linesA.length ? linesA.reduce((s, l) => s + l.ping, 0) / linesA.length : 99999
      const avgB = linesB.length ? linesB.reduce((s, l) => s + l.ping, 0) / linesB.length : 99999
      return (avgA - avgB) * dir
    }
    if (sortField.value === 'expire') {
      const expA = String(a.expire_date || '9999-12-31')
      const expB = String(b.expire_date || '9999-12-31')
      return expA.localeCompare(expB) * dir
    }
    return 0
  })
})

function openServerDetail(serverId) {
  router.push({ name: 'server-detail', params: { id: serverId } })
}

onMounted(async () => {
  state.activeViewType = 'home'
  state.activeServerId = ''
  try {
    await initializeMonitorApp()
    if (!state.turnstileRequired) {
      await loadServersOnce(false)
      startHomeWebSockets()
    }
  } catch {
    // error already stored in state.errorMsg
  }
})
</script>
