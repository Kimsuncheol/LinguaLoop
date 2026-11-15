<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const scrolled = ref(false);
function updateScroll() {
  scrolled.value = window.scrollY > 0;
}
onMounted(() => {
  updateScroll();
  window.addEventListener("scroll", updateScroll, { passive: true });
});
onUnmounted(() => window.removeEventListener("scroll", updateScroll));

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
</script>

<template>
  <button v-if="scrolled" class="back-to-top" aria-label="Back to top" @click="scrollToTop">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 12 6-6 6 6M12 6v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
