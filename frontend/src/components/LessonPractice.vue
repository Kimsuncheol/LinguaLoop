<script setup lang="ts">
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
  <section class="practice view" aria-label="Recall practice">
    <button class="text-button" @click="$emit('back')">← Back</button>
    <template v-if="current">
      <div class="section-heading">
        <p class="eyebrow">
          {{ languageName(current.lesson.language) }} / PRACTICE
        </p>
        <span aria-live="polite">{{ index + 1 }} / {{ entries.length }}</span>
      </div>
      <progress
        :value="index + 1"
        :max="entries.length"
        aria-label="Practice position"
      ></progress>
      <div class="focus-card">
        <p class="eyebrow">ONE EXPRESSION</p>
        <h1 tabindex="-1" :lang="current.lesson.language">
          {{ current.expression.text }}
        </h1>
        <p v-if="current.expression.reading" lang="ja">
          {{ current.expression.reading }}
        </p>
        <p>Can you remember what it means?</p>
      </div>
      <button
        class="primary full"
        :aria-expanded="revealed"
        aria-controls="practice-meaning"
        @click="revealed = !revealed"
      >
        {{ revealed ? "Hide meaning" : "Reveal meaning" }}
      </button>
      <div id="practice-meaning" aria-live="polite">
        <p v-if="revealed" class="meaning reveal" lang="ko">
          {{
            current.expression.meaning ||
            "Translation unavailable. Check the original lesson."
          }}
        </p>
      </div>
      <p class="hint">
        Say it out loud, then open the lesson to see its context. Progress is
        not saved.
      </p>
      <button class="text-button" @click="$emit('open', current.lesson)">
        Open full lesson ↗
      </button>
      <div class="section-heading">
        <button class="text-button" :disabled="index === 0" @click="move(-1)">
          ← Previous</button
        ><button
          class="text-button"
          :disabled="index === entries.length - 1"
          @click="move(1)"
        >
          Next expression →
        </button>
      </div>
    </template>
    <p v-else class="empty">No expressions are available to practice.</p>
  </section>
</template>
