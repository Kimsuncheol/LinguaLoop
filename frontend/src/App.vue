<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { currentUser, logout, type User } from './services/api'
const user = ref<User | null>(null)
const loading = ref(true)
const error = ref('')
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
onMounted(async () => {
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
      <span class="workspace-label">YOUR LEARNING SPACE</span>
      <button v-if="user" class="quiet-button" @click="signOut">Sign out</button>
    </header>
    <section class="intro" aria-labelledby="dashboard-title">
      <p class="eyebrow">A LITTLE EVERY DAY</p>
      <h1 id="dashboard-title">{{ user ? `Welcome back, ${user.name}.` : 'Make room for your next word.' }}</h1>
      <p>Your learning, notes, and resources. A little more connected.</p>
    </section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="bento">
      <section class="card hero" aria-labelledby="start-title">
        <div><span class="pill">YOUR DAILY LOOP</span><h2 id="start-title">Small steps.<br>New worlds.</h2><p>A space to return to your language learning,<br class="desktop-break"> one day at a time.</p></div>
        <div class="hero-bottom">
          <p v-if="loading" role="status">Loading your session…</p>
          <p v-else-if="user" class="session-status"><span aria-hidden="true">●</span> You’re signed in. Make yourself at home.</p>
          <a v-else class="kakao" href="/api/auth/kakao/login">Continue with KakaoTalk <span aria-hidden="true">↗</span></a>
          <span class="hero-note">Stay curious. Keep going.</span>
        </div>
        <div class="loop-art" aria-hidden="true"><span></span><span></span><span></span><b>안녕<br><i>hello</i></b></div>
      </section>
      <section class="card thought" aria-labelledby="thought-title"><span class="card-icon" aria-hidden="true">✳</span><p class="eyebrow" id="thought-title">A MOMENT OF ENCOURAGEMENT</p><blockquote>Every word is<br>a new way to<br>see the world.</blockquote><p class="small">Let curiosity lead the way.</p></section>
      <section class="card resource" aria-labelledby="notion-title"><div class="card-top"><span class="provider-icon" aria-hidden="true">N</span><span class="status">Coming soon</span></div><div><h2 id="notion-title">Your ideas, together.</h2><p>A home for your learning notes with Notion.</p></div><div class="card-footer">Notion <span aria-hidden="true">↗</span></div></section>
      <section class="card resource" aria-labelledby="drive-title"><div class="card-top"><span class="provider-icon drive-icon" aria-hidden="true">△</span><span class="status">Coming soon</span></div><div><h2 id="drive-title">Keep the good finds.</h2><p>Your learning files, organized with Google Drive.</p></div><div class="card-footer">Google Drive <span aria-hidden="true">↗</span></div></section>
      <section class="card appearance" aria-labelledby="appearance-title"><div><span class="card-icon" aria-hidden="true">◐</span><h2 id="appearance-title">Set the mood.</h2><p>A space that feels like you.</p></div><fieldset><legend>Appearance</legend><div class="mode-options"><label v-for="mode in (['light', 'dark', 'system'] as const)" :key="mode" :class="{ selected: appearance === mode }"><input v-model="appearance" type="radio" name="appearance" :value="mode"><span aria-hidden="true">{{ mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐' }}</span>{{ mode }}</label></div></fieldset></section>
    </div>
    <footer><span>Made for the joy of learning.</span><span>One word. One day. One loop.</span></footer>
  </main>
</template>
