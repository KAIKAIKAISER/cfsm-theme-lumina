<template>
  <div class="app-shell">
    <TopBar />
    <router-view />
    <SiteFooter />
    <ThemeSettingsDrawer />
    <TurnstileModal />
    <WsTimeoutModal />
  </div>
</template>

<script setup>
import TopBar from './components/TopBar.vue'
import SiteFooter from './components/SiteFooter.vue'
import ThemeSettingsDrawer from './components/ThemeSettingsDrawer.vue'
import TurnstileModal from './components/TurnstileModal.vue'
import WsTimeoutModal from './components/WsTimeoutModal.vue'
</script>
