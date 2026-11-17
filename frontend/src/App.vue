<script setup lang="ts">
import { t } from "./services/appLanguage";
import { appearance, setAppearance } from "./services/appearance";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { currentUser, logout, type User } from "./services/api";
import AppLanguage from "./components/AppLanguage.vue";
import LessonLibrary from "./components/LessonLibrary.vue";
import LoadingSkeleton from "./components/LoadingSkeleton.vue";
import ReleaseSnackbar from "./components/ReleaseSnackbar.vue";
const library = ref<InstanceType<typeof LessonLibrary> | null>(null);
function goHome() {
  if (guestSettings.value) { closeGuestSettings(); return; }
  if (library.value) library.value.home();
  else window.location.replace("/");
}
const bento = ref<HTMLDetailsElement | null>(null);
const guestSettings = ref(Boolean(window.history.state?.lingualoopGuestSettings));
let guestScroll = 0;
function closeGuestSettings() { window.history.back(); }
function syncGuestSettings() {
  const wasOpen = guestSettings.value;
  guestSettings.value = Boolean(window.history.state?.lingualoopGuestSettings);
  void nextTick(() => {
    if (guestSettings.value) document.querySelector<HTMLElement>('.app-language-view h1')?.focus();
    else if (wasOpen) window.scrollTo({ top: guestScroll, behavior: 'instant' });
  });
}
function openAppLanguage() {
  if (bento.value) bento.value.open = false;
  if (library.value) library.value.openAppLanguage();
  else if (!guestSettings.value) {
    guestScroll = window.scrollY;
    window.history.pushState({ ...window.history.state, lingualoopGuestSettings: true }, '');
    syncGuestSettings();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
const appearanceLabel = (value: string) => t(value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark');
onMounted(() => window.addEventListener('popstate', syncGuestSettings));
onUnmounted(() => window.removeEventListener('popstate', syncGuestSettings));
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
  <div class="app-shell">
    <header class="app-header">
      <div class="app-container app-header-content">
        <a class="brand" href="/" :aria-label="t('LinguaLoop home')" @click.exact.prevent="goHome">
          <img class="brand-icon" src="/lingualoop-logo.png" alt="" width="44" height="44" />
          <span>LinguaLoop</span>
        </a>
        <details ref="bento" class="bento" @keydown.esc.stop.prevent="dismissBento">
          <summary class="bento-toggle" :aria-label="t('Open settings and account')">
            <span class="bento-dots" aria-hidden="true">
              <span v-for="dot in 9" :key="dot"></span>
            </span>
          </summary>
          <div class="bento-panel">
            <button
              class="menu-tile"
              :aria-label="t('Appearance: {current}. Switch to {next}', { current: appearanceLabel(appearance), next: appearanceLabel(nextAppearance) })"
              :title="t('Switch to {mode} appearance', { mode: appearanceLabel(nextAppearance) })"
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
              <span class="menu-tile-label appearance-mode" aria-live="polite">{{ appearanceLabel(appearance) }}</span>
            </button>
            <button class="menu-tile" :disabled="loading" @click="openAppLanguage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" />
              </svg>
              <span class="menu-tile-label">{{ t('App language') }}</span>
            </button>
            <div v-if="loading" class="menu-tile menu-tile-loading" role="status" :aria-label="t('Loading account')">
              <span class="skeleton menu-icon-skeleton" aria-hidden="true"></span>
              <span class="skeleton menu-label-skeleton" aria-hidden="true"></span>
            </div>
            <button v-else-if="user" class="menu-tile" :title="t('Signed in as {name}', { name: user.name })" :disabled="signingOut" @click="signOut">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13" />
              </svg>
              <span class="menu-tile-label">{{ t(signingOut ? "Signing out…" : "Sign out") }}</span>
            </button>
            <button v-else-if="error" class="menu-tile" @click="session">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
              </svg>
              <span class="menu-tile-label">{{ t("Retry account") }}</span>
            </button>
            <a v-else class="menu-tile" href="/api/auth/kakao/login" :aria-label="t('Sign in with KakaoTalk')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 4h5v16h-5M9 8l4 4-4 4M3 12h10" />
              </svg>
              <span class="menu-tile-label">{{ t("Sign in") }}</span>
            </a>
          </div>
        </details>
      </div>
    </header>
    <main class="app-container app-content">
      <ReleaseSnackbar />
      <AppLanguage v-if="guestSettings" @back="closeGuestSettings" />
      <LoadingSkeleton v-else-if="loading" :label="t('Loading your session')" />
      <div v-else-if="error" role="alert" class="error">
        <p>{{ t(error) }}</p>
        <button class="secondary" @click="session">{{ t("Try again") }}</button>
      </div>
      <LessonLibrary v-else-if="user" ref="library" />
      <section v-else class="welcome view">
        <p class="eyebrow">{{ t("MAKE A LITTLE ROOM FOR LANGUAGES") }}</p>
        <h1>{{ t("Keep your language") }}<br />{{ t("learning in motion.") }}</h1>
        <p class="intro">{{ t("English, Japanese, and Chinese expressions, Korean meanings, and examples that make them stick.") }}</p>
        <a class="kakao" href="/api/auth/kakao/login"
          >{{ t("Continue with KakaoTalk →") }}</a
        >
        <p class="muted">{{ t("A little language, every day.") }}</p>
        <div class="welcome-preview" aria-hidden="true">
          <span class="eyebrow">{{ t("READ · RECALL · REPEAT") }}</span>
          <h2>{{ t("Your next expression") }}<br />{{ t("is waiting.") }}</h2>
          <span>{{ t("Learn it in context. Make it your own.") }}</span>
        </div>
      </section>
    </main>
    <footer class="app-footer">
      <div class="app-container app-footer-content">
        LinguaLoop <span>{{ t("Keep learning in motion.") }}</span>
      </div>
    </footer>
  </div>
</template>
