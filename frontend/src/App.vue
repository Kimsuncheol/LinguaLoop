<script setup lang="ts">
import { appearance, setAppearance } from "./services/appearance";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { currentUser, logout, type User } from "./services/api";
import LessonLibrary from "./components/LessonLibrary.vue";
import LoadingSkeleton from "./components/LoadingSkeleton.vue";
import ReleaseBanner from "./components/ReleaseBanner.vue";
const bento = ref<HTMLDetailsElement | null>(null);
const nextAppearance = computed(() =>
  appearance.value === "system" ? "light" : appearance.value === "light" ? "dark" : "system",
);
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
          <div class="appearance-control">
            <div>
              <span>Appearance</span>
              <span class="appearance-mode" aria-live="polite">{{ appearance }}</span>
            </div>
            <button
              class="appearance-toggle"
              :aria-label="`Appearance: ${appearance}. Switch to ${nextAppearance}`"
              :title="`Switch to ${nextAppearance} appearance`"
              @click="setAppearance(nextAppearance)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <g v-if="appearance === 'system'">
                  <rect x="3" y="4" width="18" height="13" rx="1" />
                  <path d="M8 21h8M12 17v4" />
                </g>
                <g v-else-if="appearance === 'light'">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </g>
                <path v-else d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
              </svg>
            </button>
          </div>
          <div v-if="loading" class="menu-account-loading" role="status" aria-label="Loading account">
            <span class="skeleton" aria-hidden="true"></span>
          </div>
          <div v-else-if="user" class="menu-account">
            <span class="menu-account-name">{{ user.name }}</span>
            <button class="menu-account-action" :disabled="signingOut" @click="signOut">
              {{ signingOut ? "Signing out…" : "Sign out" }}
            </button>
          </div>
          <button v-else-if="error" class="menu-account-action" @click="session">Retry account</button>
          <a v-else class="menu-account-action" href="/api/auth/kakao/login">Sign in with KakaoTalk ↗</a>
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
