<script setup lang="ts">
import { appearance, setAppearance } from "./services/appearance";
import { onMounted, onUnmounted, ref } from "vue";
import { currentUser, logout, type User } from "./services/api";
import LessonLibrary from "./components/LessonLibrary.vue";
import LoadingSkeleton from "./components/LoadingSkeleton.vue";
import ReleaseBanner from "./components/ReleaseBanner.vue";
const bento = ref<HTMLDetailsElement | null>(null);
function closeBento(event: Event) {
  if (bento.value && !bento.value.contains(event.target as Node)) {
    bento.value.open = false;
  }
}
function dismissBento() {
  if (!bento.value?.open) return;
  bento.value.open = false;
  bento.value.querySelector("summary")?.focus();
}
onMounted(() => document.addEventListener("click", closeBento));
onUnmounted(() => document.removeEventListener("click", closeBento));
const user = ref<User | null>(null),
  loading = ref(true),
  signingOut = ref(false),
  error = ref("");
async function session() {
  loading.value = true;
  error.value = "";
  try {
    user.value = await currentUser();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(session);
async function signOut() {
  signingOut.value = true;
  error.value = "";
  try {
    await logout();
    user.value = null;
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    signingOut.value = false;
  }
}
</script>
<template>
  <main>
    <header class="app-header">
      <a class="brand" href="/" aria-label="LinguaLoop home">
        <img class="brand-icon" src="/lingualoop-logo.png" alt="" width="44" height="44" />
        <span>LinguaLoop</span>
      </a>
      <details ref="bento" class="bento" @keydown.esc.stop.prevent="dismissBento">
        <summary class="bento-toggle" aria-label="Open settings and account">
          <span class="bento-dots" aria-hidden="true">
            <span v-for="dot in 9" :key="dot"></span>
          </span>
        </summary>
        <div class="bento-panel">
          <label class="appearance-control">
            <span>Appearance</span>
            <select :value="appearance" @change="setAppearance(($event.target as HTMLSelectElement).value)">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <div v-if="user" class="account">
            <span>{{ user.name }}</span
            ><button class="text-button" :disabled="signingOut" @click="signOut">
              {{ signingOut ? "Signing out…" : "Sign out" }}
            </button>
          </div>
        </div>
      </details>
    </header>
    <ReleaseBanner />
    <LoadingSkeleton v-if="loading" label="Loading your session" />
    <div v-else-if="error" role="alert" class="error">
      <p>{{ error }}</p>
      <button class="secondary" @click="session">Try again</button>
    </div>
    <LessonLibrary v-else-if="user" />
    <section v-else class="welcome view">
      <p class="eyebrow">MAKE A LITTLE ROOM FOR ENGLISH</p>
      <h1>Keep your language<br />learning in motion.</h1>
      <p class="intro">
        Everyday expressions, Korean meanings, and conversations that make them
        stick.
      </p>
      <a class="kakao" href="/api/auth/kakao/login"
        >Continue with KakaoTalk →</a
      >
      <p class="muted">A little English, every day.</p>
      <div class="welcome-preview" aria-hidden="true">
        <span class="eyebrow">READ · RECALL · REPEAT</span>
        <h2>Your next expression<br />is waiting.</h2>
        <span>Learn it in context. Make it your own.</span>
      </div>
    </section>
    <footer class="app-footer">
      LinguaLoop <span>Keep learning in motion.</span>
    </footer>
  </main>
</template>
