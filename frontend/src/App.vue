<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { currentUser, logout, type User } from './services/api'
const user = ref<User | null>(null)
const loading = ref(true)
const error = ref('')
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
    <p class="eyebrow">LinguaLoop</p>
    <h1>Keep your language<br>learning in motion.</h1>
    <p>One home for your learning, notes, and resources.</p>
    <p v-if="loading" role="status">Loading your session…</p>
    <section v-else-if="user">
      <h2>Welcome, {{ user.name }}</h2>
      <button @click="signOut">Sign out</button>
    </section>
    <a v-else class="kakao" href="/api/auth/kakao/login">Continue with KakaoTalk</a>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="resources">
      <article><h2>Notion</h2><p>Integration foundation for your learning notes.</p></article>
      <article><h2>Google Drive</h2><p>Integration foundation for your learning files.</p></article>
    </div>
  </main>
</template>
