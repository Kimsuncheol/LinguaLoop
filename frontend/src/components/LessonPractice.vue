<script setup lang="ts">
import { t } from "../services/appLanguage";
import { computed, ref } from "vue";
import { type Lesson, languageName } from "../services/lessons";
const props = defineProps<{ lessons: Lesson[] }>();
defineEmits<{ back: []; open: [lesson: Lesson] }>();
const entries = computed(() =>
  props.lessons.flatMap((lesson) =>
    lesson.expressions.map((expression) => ({ lesson, expression })),
  ),
);
const index = ref(0),
  revealed = ref(false);
const current = computed(() => entries.value[index.value]);
function move(delta: number) {
  index.value = Math.max(
    0,
    Math.min(entries.value.length - 1, index.value + delta),
  );
  revealed.value = false;
}
</script>
<template>
  <section class="practice view" :aria-label="t('Recall practice')">
    <button class="text-button" @click="$emit('back')">{{ t("← Back") }}</button>
    <template v-if="current">
      <div class="section-heading">
        <p class="eyebrow">
          {{ t('{language} / PRACTICE', { language: languageName(current.lesson.language) }) }}
        </p>
        <span aria-live="polite">{{ index + 1 }} / {{ entries.length }}</span>
      </div>
      <progress
        :value="index + 1"
        :max="entries.length"
        :aria-label="t('Practice position')"
      ></progress>
      <div class="focus-card">
        <p class="eyebrow">{{ t("ONE EXPRESSION") }}</p>
        <h1 tabindex="-1" :lang="current.lesson.language">
          {{ current.expression.text }}
        </h1>
        <p v-if="current.expression.reading" :lang="current.lesson.language">
          {{ current.expression.reading }}
        </p>
        <p>{{ t("Can you remember what it means?") }}</p>
      </div>
      <button
        class="primary full"
        :aria-expanded="revealed"
        aria-controls="practice-meaning"
        @click="revealed = !revealed"
      >
        {{ t(revealed ? "Hide meaning" : "Reveal meaning") }}
      </button>
      <div id="practice-meaning" aria-live="polite">
        <p v-if="revealed" class="meaning reveal" lang="ko">
          {{
            current.expression.meaning ||
            t("Translation unavailable. Check the original lesson.")
          }}
        </p>
      </div>
      <p class="hint">{{ t("Say it out loud, then open the lesson to see its context. Progress is not saved.") }}</p>
      <button class="text-button" @click="$emit('open', current.lesson)">{{ t("Open full lesson ↗") }}</button>
      <div class="section-heading">
        <button class="text-button" :disabled="index === 0" @click="move(-1)">{{ t("← Previous") }}</button
        ><button
          class="text-button"
          :disabled="index === entries.length - 1"
          @click="move(1)"
        >{{ t("Next expression →") }}</button>
      </div>
    </template>
    <p v-else class="empty">{{ t("No expressions are available to practice.") }}</p>
  </section>
</template>
