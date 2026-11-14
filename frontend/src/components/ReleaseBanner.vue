<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

type Release = { id: string; message: string };
const current = __APP_RELEASE__;
const release = ref<Release>(current);
const dismissed = ref("");
const refreshing = ref(false);
const error = ref("");
const storageKey = "lingualoop-dismissed-release";
const visible = computed(() => {
  const lastDismissed = Date.parse(dismissed.value);
  return !Number.isFinite(lastDismissed) || Date.parse(release.value.id) > lastDismissed;
});
const updateAvailable = computed(() => release.value.id !== current.id);
let interval: ReturnType<typeof setInterval> | undefined;
let request: AbortController | undefined;

function readDismissal() {
  try {
    dismissed.value = localStorage.getItem(storageKey) || "";
  } catch {
    // Dismissal still works for this visit when storage is unavailable.
  }
}
readDismissal();
function dismiss() {
  dismissed.value = release.value.id;
  try {
    localStorage.setItem(storageKey, dismissed.value);
  } catch {
    // Keep the in-memory dismissal.
  }
}
async function checkForRelease() {
  if (document.hidden || request) return;
  request = new AbortController();
  const timeout = window.setTimeout(() => request?.abort(), 8000);
  try {
    const response = await fetch("/app-release.json", {
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok) return;
    const candidate: unknown = await response.json();
    if (
      candidate && typeof candidate === "object" &&
      "id" in candidate && typeof candidate.id === "string" &&
      "message" in candidate && typeof candidate.message === "string" &&
      candidate.message.length <= 1000 &&
      Date.parse(candidate.id) > Date.parse(release.value.id)
    ) {
      release.value = { id: candidate.id, message: candidate.message };
    }
  } catch {
    // Offline checks must not interrupt learning or hide existing content.
  } finally {
    window.clearTimeout(timeout);
    request = undefined;
  }
}
async function refresh() {
  refreshing.value = true;
  error.value = "";
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    const worker = registration?.installing || registration?.waiting;
    if (worker && worker.state !== "activated") {
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (worker.state === "activated" || worker.state === "redundant") {
            cleanup();
            worker.state === "activated" ? resolve() : reject(new Error());
          }
        };
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error());
        }, 15000);
        function cleanup() {
          window.clearTimeout(timeout);
          worker?.removeEventListener("statechange", finish);
        }
        worker.addEventListener("statechange", finish);
        finish();
      });
    }
    window.location.reload();
  } catch {
    error.value = "Couldn’t load the update. Check your connection and try again.";
    refreshing.value = false;
  }
}
onMounted(() => {
  void checkForRelease();
  interval = setInterval(checkForRelease, 60000);
  document.addEventListener("visibilitychange", checkForRelease);
  window.addEventListener("focus", checkForRelease);
  window.addEventListener("online", checkForRelease);
  window.addEventListener("storage", readDismissal);
});
onUnmounted(() => {
  clearInterval(interval);
  request?.abort();
  document.removeEventListener("visibilitychange", checkForRelease);
  window.removeEventListener("focus", checkForRelease);
  window.removeEventListener("online", checkForRelease);
  window.removeEventListener("storage", readDismissal);
});
</script>

<template>
  <aside v-if="visible" class="release-banner" aria-label="LinguaLoop update">
    <div role="status" aria-live="polite" aria-atomic="true">
      <strong>{{ updateAvailable ? "Update recommended" : "LinguaLoop has been updated" }}</strong>
      <p>{{ release.message }}</p>
      <p v-if="updateAvailable">Update now to get the latest improvements. Your page will refresh.</p>
      <p v-else>This update is installed.</p>
      <p v-if="error">{{ error }}</p>
    </div>
    <div class="release-actions">
      <button v-if="updateAvailable" class="primary" :disabled="refreshing" @click="refresh">
        {{ refreshing ? "Updating…" : "Update now" }}
      </button>
      <button class="text-button" :disabled="refreshing" aria-label="Dismiss update banner" @click="dismiss">
        Dismiss
      </button>
    </div>
  </aside>
</template>
