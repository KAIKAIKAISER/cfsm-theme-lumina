<template>
  <div v-if="state.turnstileRequired && state.siteConfig.turnstile_enabled" class="modal-backdrop">
    <div class="glass-panel" style="padding: 24px 28px; max-width: 420px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="font-size: 17px; font-weight: 700;">🛡️ {{ t.turnstileTitle }}</h3>
      <p style="font-size: 13px; color: var(--text-secondary);">
        {{ t.turnstileDesc }}
      </p>
      <div ref="widgetContainer" style="display: flex; justify-content: center; min-height: 65px;"></div>
      <div v-if="verifyError" style="font-size: 12px; color: var(--tone-danger);">
        {{ verifyError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useMonitorStore } from '../composables/useMonitorStore.js'

const { state, t, completeTurnstileVerification } = useMonitorStore()
const widgetContainer = ref(null)
const verifyError = ref('')
let widgetId = null

function ensureTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }
    const existing = document.querySelector('script[data-cfsm-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.setAttribute('data-cfsm-turnstile', '1')
    script.onload = () => resolve(window.turnstile)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function mountTurnstileWidget() {
  if (!state.turnstileRequired || !state.siteConfig.turnstile_enabled || !state.siteConfig.turnstile_site_key) {
    return
  }
  await nextTick()
  if (!widgetContainer.value) return
  verifyError.value = ''

  try {
    const turnstile = await ensureTurnstileScript()
    if (!turnstile || !widgetContainer.value) return
    if (widgetId !== null) {
      try {
        turnstile.remove(widgetId)
      } catch {
        // ignore
      }
      widgetId = null
    }
    widgetId = turnstile.render(widgetContainer.value, {
      sitekey: state.siteConfig.turnstile_site_key,
      theme: state.effectiveColorScheme === 'light' ? 'light' : 'dark',
      callback: async (token) => {
        try {
          await completeTurnstileVerification(token)
        } catch (err) {
          verifyError.value = err?.message || 'Verification failed'
          if (window.turnstile && widgetId !== null) {
            window.turnstile.reset(widgetId)
          }
        }
      }
    })
  } catch {
    verifyError.value = 'Failed to load Turnstile script'
  }
}

watch(
  () => [state.turnstileRequired, state.siteConfig.turnstile_site_key],
  ([req]) => {
    if (req) mountTurnstileWidget()
  }
)

onMounted(() => {
  if (state.turnstileRequired) mountTurnstileWidget()
})
</script>
