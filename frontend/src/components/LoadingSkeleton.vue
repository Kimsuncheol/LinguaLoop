<script setup lang="ts">
defineProps<{ label?: string }>();
</script>
<template>
  <div
    role="status"
    :aria-label="label || 'Loading view'"
    class="skeleton-view"
  >
    <span class="sr-only">{{ label || "Loading view" }}</span>
    <div aria-hidden="true" class="skeleton skeleton-heading"></div>
    <div aria-hidden="true" class="skeleton skeleton-subtitle"></div>
    <div aria-hidden="true" class="lesson-grid">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </div>
  </div>
</template>
