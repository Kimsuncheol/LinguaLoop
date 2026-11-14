<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { currentUser, logout, type User } from './services/api'
const user = ref<User | null>(null)
const loading = ref(true)
const error = ref('')
const menu = ref<HTMLDetailsElement | null>(null)
function closeMenu(event: Event) {
  if (menu.value && !event.composedPath().includes(menu.value)) menu.value.open = false
}
function escapeMenu() {
  if (menu.value?.open) {
    menu.value.open = false
    menu.value.querySelector('summary')?.focus()
  }
}
type Appearance = 'system' | 'light' | 'dark'
const appearance = ref<Appearance>('system')
try {
  const saved = localStorage.getItem('lingualoop-appearance')
  if (saved === 'light' || saved === 'dark' || saved === 'system') appearance.value = saved
} catch { /* Appearance still works when storage is unavailable. */ }
watch(appearance, (value) => {
  document.documentElement.dataset.appearance = value
  try { localStorage.setItem('lingualoop-appearance', value) } catch { /* Optional preference storage. */ }
}, { immediate: true })
onUnmounted(() => document.removeEventListener('pointerdown', closeMenu))
onMounted(async () => {
  document.addEventListener('pointerdown', closeMenu)
  try { user.value = await currentUser() }
  catch (cause) { error.value = (cause as Error).message }
  finally { loading.value = false }
})
async function signOut() {
  try { await logout(); user.value = null }
  catch (cause) { error.value = (cause as Error).message }
}
</script>

<template>
  <main>
    <header class="topbar">
      <a class="brand" href="/" aria-label="LinguaLoop home"><span class="brand-mark" aria-hidden="true">↻</span> LinguaLoop</a>
      <details ref="menu" class="app-menu" @keydown.esc.prevent="escapeMenu">
        <summary aria-label="Open settings menu" title="Menu"><span class="bento-icon" aria-hidden="true"><span v-for="dot in 9" :key="dot"></span></span></summary>
        <div class="menu-panel">
          <p class="menu-heading">Settings</p>
          <fieldset><legend>Appearance</legend><div class="mode-options"><label v-for="mode in (['light', 'dark', 'system'] as const)" :key="mode" :class="{ selected: appearance === mode }"><input v-model="appearance" type="radio" name="appearance" :value="mode"><span aria-hidden="true">{{ mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐' }}</span>{{ mode }}</label></div></fieldset>
          <button v-if="user" class="quiet-button" @click="signOut">Sign out</button>
        </div>
      </details>
    </header>
    <section class="intro" aria-labelledby="dashboard-title">
      <p class="eyebrow">A LITTLE EVERY DAY</p>
      <h1 id="dashboard-title">{{ user ? `Welcome back, ${user.name}.` : 'Make room for your next word.' }}</h1>
      <p>Your learning, notes, and resources. A little more connected.</p>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section class="learning-home" aria-label="Your learning space">
      <p v-if="loading" role="status">Loading your session…</p>
      <p v-else-if="user">You’re signed in. Welcome to your learning space.</p>
      <a v-else class="kakao" href="/api/auth/kakao/login">Continue with KakaoTalk <span aria-hidden="true">↗</span></a>
    </section>
    <footer><span>Made for the joy of learning.</span><span>One word. One day. One loop.</span></footer>
  </main>
</template>
