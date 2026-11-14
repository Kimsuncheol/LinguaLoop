<script setup lang="ts">
import { computed } from "vue";
import { meaningParagraphs } from "../services/lessonText";
const props = defineProps<{ text: string }>();
const paragraphs = computed(() => meaningParagraphs(props.text));
</script>
<template>
  <div class="meaning-copy" lang="ko">
    <p v-for="(paragraph, i) in paragraphs" :key="i">{{ paragraph }}</p>
  </div>
</template>
