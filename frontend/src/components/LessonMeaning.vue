<script setup lang="ts">
import { computed } from "vue";
import { meaningParagraphs, expressionParts } from "../services/lessonText";
const props = defineProps<{ text: string; expression?: string | null }>();
const paragraphs = computed(() =>
  meaningParagraphs(props.text).map((text) =>
    expressionParts(text, props.expression),
  ),
);
</script>
<template>
  <div class="meaning-copy" lang="ko">
    <p v-for="(paragraph, i) in paragraphs" :key="i">
      <template v-for="(part, j) in paragraph" :key="j"
        ><strong v-if="part.emphasized">{{ part.text }}</strong
        ><template v-else>{{ part.text }}</template></template
      >
    </p>
  </div>
</template>
