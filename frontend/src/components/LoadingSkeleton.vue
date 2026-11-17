<script setup lang="ts">
import { t } from "../services/appLanguage";
withDefaults(defineProps<{ label?: string; showHeading?: boolean }>(), { showHeading: true });
</script>
<template>
  <div
    role="status"
    :aria-label="label || t('Loading view')"
    class="skeleton-view"
  >
    <span class="sr-only">{{ label || t("Loading view") }}</span>
    <div v-if="showHeading" aria-hidden="true" class="skeleton skeleton-heading"></div>
    <div v-if="showHeading" aria-hidden="true" class="skeleton skeleton-subtitle"></div>
    <div aria-hidden="true" class="lesson-grid">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </div>
  </div>
</template>
