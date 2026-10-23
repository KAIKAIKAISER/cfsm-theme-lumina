<template>
  <div v-if="state.wsTimeoutPromptVisible" class="modal-backdrop">
    <div class="glass-panel" style="padding: 24px 28px; max-width: 420px; width: 100%; display: flex; flex-direction: column; gap: 14px;">
      <h3 style="font-size: 16px; font-weight: 700;">⏱ {{ t.wsTimeoutTitle }}</h3>
      <p style="font-size: 13px; color: var(--text-secondary);">
        {{ t.wsTimeoutDesc }}
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
        <button type="button" class="icon-btn" @click="dismissWebSocketTimeoutPrompt">
          {{ t.wsStayStatic }}
        </button>
        <button
          type="button"
          class="icon-btn"
          style="background: var(--accent-primary); color: #fff; border-color: var(--accent-primary);"
          @click="resumeWebSocketAfterTimeout"
        >
          {{ t.wsContinue }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMonitorStore } from '../composables/useMonitorStore.js'

const { state, t, resumeWebSocketAfterTimeout, dismissWebSocketTimeoutPrompt } = useMonitorStore()
</script>
