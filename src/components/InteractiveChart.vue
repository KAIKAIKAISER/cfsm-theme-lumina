<template>
  <div class="glass-panel chart-panel">
    <div class="chart-head">
      <div class="chart-title">{{ title }}</div>
      <div class="chart-legend">
        <div
          v-for="s in series"
          :key="s.key"
          class="legend-chip tabular-nums"
          :class="{ muted: hiddenKeys.has(s.key) }"
          @click="toggleSeries(s.key)"
        >
          <span class="ping-color-dot" :style="{ backgroundColor: s.color }"></span>
          <span>{{ s.label }}</span>
          <strong v-if="s.latestText !== undefined" style="margin-left: 3px;">{{ s.latestText }}</strong>
        </div>
      </div>
    </div>

    <div
      v-if="hasAnyPoints"
      style="position: relative; user-select: none;"
      @mousemove="onMouseMove"
      @mouseleave="hoverIndex = -1"
    >
      <svg
        ref="svgRef"
        viewBox="0 0 800 220"
        preserveAspectRatio="none"
        style="width: 100%; height: 220px; display: block; overflow: visible;"
      >
        <!-- Horizontal Grid Lines -->
        <g stroke="rgba(148, 163, 184, 0.14)" stroke-dasharray="4 4" stroke-width="1">
          <line x1="0" y1="20" x2="800" y2="20" />
          <line x1="0" y1="80" x2="800" y2="80" />
          <line x1="0" y1="140" x2="800" y2="140" />
          <line x1="0" y1="200" x2="800" y2="200" />
        </g>

        <!-- Series Polylines -->
        <template v-for="s in renderedSeries" :key="s.key">
          <path
            v-for="(seg, idx) in s.segments"
            :key="idx"
            :d="seg"
            fill="none"
            :stroke="s.color"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </template>

        <!-- Hover Crosshair Line -->
        <line
          v-if="hoverIndex >= 0 && hoverX !== null"
          :x1="hoverX"
          y1="10"
          :x2="hoverX"
          y2="205"
          stroke="var(--accent-secondary)"
          stroke-width="1.2"
          stroke-dasharray="3 3"
        />
      </svg>

      <!-- Y-axis Labels Overlay -->
      <div
        class="tabular-nums"
        style="position: absolute; top: 4px; left: 6px; font-size: 11px; color: var(--text-secondary); pointer-events: none;"
      >
        {{ formatY(maxY) }}
      </div>
      <div
        class="tabular-nums"
        style="position: absolute; bottom: 18px; left: 6px; font-size: 11px; color: var(--text-secondary); pointer-events: none;"
      >
        0
      </div>

      <!-- Hover Tooltip -->
      <div
        v-if="hoverIndex >= 0 && hoverTooltip"
        class="glass-panel tabular-nums"
        style="position: absolute; top: 10px; right: 12px; padding: 8px 12px; font-size: 12px; pointer-events: none; z-index: 10;"
      >
        <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-secondary);">
          {{ hoverTooltip.time }}
        </div>
        <div
          v-for="item in hoverTooltip.items"
          :key="item.key"
          style="display: flex; align-items: center; justify-content: space-between; gap: 14px;"
        >
          <span style="display: inline-flex; align-items: center; gap: 5px;">
            <span class="ping-color-dot" :style="{ backgroundColor: item.color }"></span>
            <span>{{ item.label }}</span>
          </span>
          <strong>{{ item.valueText }}</strong>
        </div>
      </div>
    </div>

    <div
      v-else
      style="height: 160px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 13px;"
    >
      {{ emptyText }}
    </div>

    <!-- Optional Packet Loss Strip (丢包色带) -->
    <div v-if="showLossStrip && activeSeries.length > 0 && hasAnyPoints" style="display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid var(--border-subtle);">
      <div style="font-size: 11px; color: var(--text-secondary);">
        {{ lossStripTitle }}
      </div>
      <div
        v-for="s in activeSeries"
        :key="`loss-${s.key}`"
        style="display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 8px; font-size: 11px;"
      >
        <span style="color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          {{ s.label }}
        </span>
        <div
          style="display: grid; gap: 1px; height: 7px; border-radius: 3px; overflow: hidden;"
          :style="{ gridTemplateColumns: `repeat(${Math.max(1, s.points.length)}, 1fr)` }"
        >
          <span
            v-for="(pt, pIdx) in s.points"
            :key="pIdx"
            :style="{ backgroundColor: getLossCellColor(pt) }"
            :title="formatLossTip(s.label, pt)"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  series: { type: Array, required: true }, // [{ key, label, color, latestText, points: [{ ts, val, loss }] }]
  yFormatter: { type: Function, default: null },
  showLossStrip: { type: Boolean, default: false },
  lossStripTitle: { type: String, default: '' },
  timeoutLabel: { type: String, default: 'Timeout' },
  emptyText: { type: String, default: 'No data' }
})

const svgRef = ref(null)
const hoverIndex = ref(-1)
const hiddenKeys = reactive(new Set())

function toggleSeries(key) {
  if (hiddenKeys.has(key)) hiddenKeys.delete(key)
  else hiddenKeys.add(key)
}

const activeSeries = computed(() => props.series.filter(s => !hiddenKeys.has(s.key)))

const maxPointCount = computed(() => {
  let max = 0
  for (const s of activeSeries.value) {
    if (Array.isArray(s.points) && s.points.length > max) {
      max = s.points.length
    }
  }
  return max
})

const hasAnyPoints = computed(() => maxPointCount.value > 0)

const maxY = computed(() => {
  let max = 0
  for (const s of activeSeries.value) {
    for (const pt of s.points || []) {
      if (pt && typeof pt.val === 'number' && Number.isFinite(pt.val) && pt.val > max) {
        max = pt.val
      }
    }
  }
  return max > 0 ? max * 1.12 : 100
})

function formatY(val) {
  if (props.yFormatter) return props.yFormatter(val)
  return `${Math.round(val)}`
}

const renderedSeries = computed(() => {
  const width = 800
  const topPad = 20
  const bottomY = 200
  const usableH = bottomY - topPad
  const ceiling = maxY.value || 100

  return activeSeries.value.map(s => {
    const pts = s.points || []
    const len = pts.length
    const segments = []
    let currentCmds = []

    for (let i = 0; i < len; i++) {
      const pt = pts[i]
      const x = len > 1 ? (i / (len - 1)) * width : width / 2
      if (!pt || pt.val === null || pt.val === false || !Number.isFinite(Number(pt.val))) {
        if (currentCmds.length > 0) {
          segments.push(currentCmds.join(' '))
          currentCmds = []
        }
        continue
      }
      const ratio = Math.min(1, Math.max(0, Number(pt.val) / ceiling))
      const y = bottomY - ratio * usableH
      const cmd = currentCmds.length === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`
      currentCmds.push(cmd)
    }

    if (currentCmds.length > 0) {
      segments.push(currentCmds.join(' '))
    }

    return {
      key: s.key,
      color: s.color,
      segments
    }
  })
})

const hoverX = computed(() => {
  const count = maxPointCount.value
  if (hoverIndex.value < 0 || count <= 0) return null
  if (count === 1) return 400
  return (hoverIndex.value / (count - 1)) * 800
})

const hoverTooltip = computed(() => {
  const idx = hoverIndex.value
  if (idx < 0 || activeSeries.value.length === 0) return null

  let ts = 0
  const items = []
  for (const s of activeSeries.value) {
    const pt = s.points?.[idx]
    if (!pt) continue
    if (pt.ts && !ts) ts = pt.ts
    let valueText = '-'
    if (pt.val === null) {
      valueText = props.timeoutLabel
    } else if (typeof pt.val === 'number' && Number.isFinite(pt.val)) {
      valueText = formatY(pt.val)
      if (typeof pt.loss === 'number' && pt.loss > 0) {
        valueText += ` (${pt.loss.toFixed(0)}% loss)`
      }
    }
    items.push({
      key: s.key,
      label: s.label,
      color: s.color,
      valueText
    })
  }

  const time = ts ? new Date(ts).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
  return { time, items }
})

function onMouseMove(e) {
  if (!svgRef.value || maxPointCount.value <= 0) return
  const rect = svgRef.value.getBoundingClientRect()
  if (rect.width <= 0) return
  const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  hoverIndex.value = Math.round(relX * (maxPointCount.value - 1))
}

function getLossCellColor(pt) {
  if (!pt) return 'rgba(148, 163, 184, 0.15)'
  if (pt.val === null || pt.loss === null) return '#ef4444'
  const loss = Number(pt.loss) || 0
  if (loss >= 20) return '#ef4444'
  if (loss > 0) return '#f59e0b'
  return '#10b981'
}

function formatLossTip(label, pt) {
  if (!pt) return ''
  const timeStr = pt.ts ? new Date(pt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const rttStr = pt.val === null ? props.timeoutLabel : `${Math.round(pt.val)}ms`
  const lossStr = pt.loss === null ? props.timeoutLabel : `${Number(pt.loss || 0).toFixed(0)}%`
  return `${label} [${timeStr}] RTT: ${rttStr} | Loss: ${lossStr}`
}
</script>
