<template>
  <div class="glass-panel table-wrap">
    <table class="lumina-table tabular-nums">
      <thead>
        <tr>
          <th>{{ t.online }}</th>
          <th>{{ t.sortName }}</th>
          <th>OS</th>
          <th>{{ t.uptime }}</th>
          <th>{{ t.cpu }}</th>
          <th>{{ t.memory }}</th>
          <th>{{ t.disk }}</th>
          <th>{{ t.networkSpeed }}</th>
          <th v-if="state.sysConfig.show_tf !== false">{{ t.monthlyTraffic }}</th>
          <th>{{ t.latency }}</th>
          <th v-if="state.sysConfig.show_price !== false || state.sysConfig.show_expire !== false">
            {{ t.billingInfo }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="srv in servers"
          :key="srv.id"
          :style="{ opacity: isServerOnline(srv, state.nowTick) ? 1 : 0.65 }"
          @click="$emit('select', srv.id)"
        >
          <td>
            <span class="status-dot" :class="isServerOnline(srv, state.nowTick) ? 'online' : 'offline'"></span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 7px;">
              <img
                v-if="getFlagIconUrl(srv.region, state.serverBaseMap[srv.id])"
                :src="getFlagIconUrl(srv.region, state.serverBaseMap[srv.id])"
                class="flag-icon"
                loading="lazy"
              />
              <strong>{{ srv.name }}</strong>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <img
                :src="getOSIconUrl(srv.os, state.serverBaseMap[srv.id])"
                class="os-icon"
                loading="lazy"
              />
              <span>{{ getShortOSName(srv.os) }}</span>
            </div>
          </td>
          <td>{{ formatUptime(srv.boot_time, state.lang, state.nowTick) }}</td>
          <td>
            <div style="min-width: 85px;">
              <div>{{ (Number(srv.cpu) || 0).toFixed(1) }}%</div>
              <div class="progress-track" style="height: 4px; margin-top: 3px;">
                <div
                  class="progress-fill"
                  :class="`tone-${getMetricTone(srv.cpu)}`"
                  :style="{ width: `${Math.min(100, Number(srv.cpu) || 0)}%` }"
                ></div>
              </div>
            </div>
          </td>
          <td>
            <div style="min-width: 95px;">
              <div>{{ calcUsagePct(srv.ram_used, srv.ram_total).toFixed(1) }}%</div>
              <div class="progress-track" style="height: 4px; margin-top: 3px;">
                <div
                  class="progress-fill"
                  :class="`tone-${getMetricTone(calcUsagePct(srv.ram_used, srv.ram_total))}`"
                  :style="{ width: `${calcUsagePct(srv.ram_used, srv.ram_total)}%` }"
                ></div>
              </div>
            </div>
          </td>
          <td>{{ calcUsagePct(srv.disk_used, srv.disk_total).toFixed(1) }}%</td>
          <td>
            <span class="speed-down">↓{{ formatSpeed(srv.net_in_speed) }}</span>
            <span style="margin: 0 4px; opacity: 0.4;">/</span>
            <span class="speed-up">↑{{ formatSpeed(srv.net_out_speed) }}</span>
          </td>
          <td v-if="state.sysConfig.show_tf !== false">
            {{ getTrafficQuotaInfo(srv)?.usedText || '-' }}
          </td>
          <td>
            <div style="display: flex; gap: 4px;">
              <span
                v-for="line in extractConfiguredPingLines(srv, state.siteConfig).slice(0, 6)"
                :key="line.key"
                class="mini-badge"
              >
                {{ line.label }}:{{ line.ping === null ? t.timeout : `${Math.round(line.ping)}ms` }}
              </span>
            </div>
          </td>
          <td v-if="state.sysConfig.show_price !== false || state.sysConfig.show_expire !== false">
            <span v-if="formatServerBilling(srv, state.lang)" style="margin-right: 6px;">
              {{ formatServerBilling(srv, state.lang).label }}
            </span>
            <span v-if="getServerExpiryInfo(srv, state.lang, state.nowTick)" class="mini-badge">
              {{ getServerExpiryInfo(srv, state.lang, state.nowTick).text }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useMonitorStore } from '../composables/useMonitorStore.js'
import {
  isServerOnline,
  getFlagIconUrl,
  getOSIconUrl,
  getShortOSName,
  formatUptime,
  formatSpeed,
  calcUsagePct,
  getMetricTone,
  getTrafficQuotaInfo,
  extractConfiguredPingLines,
  formatServerBilling,
  getServerExpiryInfo
} from '../utils/format.js'

defineProps({
  servers: { type: Array, required: true }
})

defineEmits(['select'])

const { state, t } = useMonitorStore()
</script>
