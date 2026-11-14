<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type Lesson, languageName, lessonDate } from "../services/lessons";
const props = defineProps<{ lesson: Lesson }>();
defineEmits<{ practice: []; back: [] }>();
const tab = ref("Expressions");
const tabs = computed(() =>
  props.lesson.language === "ja"
    ? ["Expressions", "Examples", "Vocabulary"]
    : ["Dialogue", "Meaning", "Vocabulary"],
);
watch(
  () => props.lesson.id,
  () => {
    tab.value = tabs.value[0]!;
  },
  { immediate: true },
);
function navigate(event: KeyboardEvent) {
  const i = tabs.value.indexOf(tab.value);
  const n =
    event.key === "ArrowRight"
      ? (i + 1) % 3
      : event.key === "ArrowLeft"
        ? (i + 2) % 3
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 2
            : -1;
  if (n < 0) return;
  event.preventDefault();
  tab.value = tabs.value[n]!;
  document.getElementById(`tab-${tab.value}`)?.focus();
}
</script>
<template>
  <article class="reader-content" aria-label="Lesson detail">
    <button class="text-button" @click="$emit('back')">
      ← Back to library
    </button>
    <p class="eyebrow">
      {{ languageName(lesson.language) }} · {{ lessonDate(lesson.date) }}
    </p>
    <h1 :lang="lesson.language">
      {{ lesson.expression || lesson.title || "Lesson text unavailable" }}
    </h1>
    <p v-if="lesson.reading" class="reading" lang="ja">{{ lesson.reading }}</p>
    <p v-if="lesson.meaning" class="meaning" lang="ko">{{ lesson.meaning }}</p>
    <div class="tabs" role="tablist" aria-label="Lesson sections">
      <button
        v-for="name in tabs"
        :id="`tab-${name}`"
        :key="name"
        role="tab"
        :tabindex="tab === name ? 0 : -1"
        :aria-selected="tab === name"
        aria-controls="lesson-panel"
        :class="{ active: tab === name }"
        @keydown="navigate"
        @click="tab = name"
      >
        {{ name }}
      </button>
    </div>
    <div
      id="lesson-panel"
      class="conversation"
      role="tabpanel"
      :aria-labelledby="`tab-${tab}`"
      tabindex="0"
    >
      <template v-if="lesson.language === 'ja' && tab === 'Expressions'">
        <section
          v-for="(expression, i) in lesson.expressions"
          :key="i"
          class="expression-block"
        >
          <h2 lang="ja">{{ expression.text }}</h2>
          <p v-if="expression.reading" class="reading" lang="ja">
            {{ expression.reading }}
          </p>
          <p v-if="expression.meaning" lang="ko">{{ expression.meaning }}</p>
          <p v-if="expression.explanation" class="lesson-copy" lang="ko">
            {{ expression.explanation }}
          </p>
        </section>
        <p v-if="!lesson.expressions.length">
          Expressions are unavailable for this lesson.
        </p>
      </template>
      <template v-else-if="tab === 'Examples'">
        <section
          v-for="(expression, i) in lesson.expressions"
          :key="i"
          class="expression-block"
        >
          <h2 lang="ja">{{ expression.text }}</h2>
          <div
            v-for="(example, j) in expression.examples"
            :key="j"
            class="example-block"
          >
            <p class="lesson-copy" lang="ja">{{ example.text }}</p>
            <p v-if="example.reading" class="reading" lang="ja">
              {{ example.reading }}
            </p>
            <p v-if="example.meaning" lang="ko">{{ example.meaning }}</p>
          </div>
          <p v-if="!expression.examples.length" class="muted">
            No examples supplied for this expression.
          </p>
        </section>
      </template>
      <template v-else-if="tab === 'Vocabulary'">
        <section
          v-for="(word, i) in lesson.vocabulary"
          :key="i"
          class="expression-block"
        >
          <h2 lang="ja">{{ word.text }}</h2>
          <p v-if="word.reading" class="reading" lang="ja">
            {{ word.reading }}
          </p>
          <p v-if="word.meaning" lang="ko">{{ word.meaning }}</p>
          <p v-if="word.explanation" lang="ko">{{ word.explanation }}</p>
          <div
            v-for="(example, j) in word.examples"
            :key="j"
            class="example-block"
          >
            <p lang="ja">{{ example.text }}</p>
            <p v-if="example.reading" lang="ja">{{ example.reading }}</p>
            <p v-if="example.meaning" lang="ko">{{ example.meaning }}</p>
          </div>
        </section>
        <p v-if="lesson.words" class="lesson-copy">{{ lesson.words }}</p>
        <p v-for="(note, i) in lesson.notes" :key="i" class="lesson-copy">
          {{ note }}
        </p>
        <p
          v-if="
            !lesson.words && !lesson.vocabulary.length && !lesson.notes.length
          "
        >
          Vocabulary is unavailable for this lesson.
        </p>
      </template>
      <template v-else>
        <p class="lesson-copy" :lang="tab === 'Meaning' ? 'ko' : 'en'">
          {{
            (tab === "Dialogue" ? lesson.dialogue : lesson.explanation) ||
            "This section is unavailable. Compare the original lesson below."
          }}
        </p>
        <p
          v-if="tab === 'Dialogue' && lesson.translation"
          class="translation lesson-copy"
          lang="ko"
        >
          {{ lesson.translation }}
        </p>
      </template>
    </div>
    <button
      v-if="lesson.expressions.length"
      class="primary reader-practice"
      @click="$emit('practice')"
    >
      Practice this lesson →
    </button>
    <div class="source-links">
      <a
        v-if="lesson.imageUrl"
        :href="lesson.imageUrl"
        target="_blank"
        rel="noopener noreferrer"
        >View original lesson image ↗</a
      >
      <a
        v-if="lesson.sourceUrl"
        :href="lesson.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        >Read the source article ↗</a
      >
    </div>
    <p class="muted">
      Extracted from a lesson image{{
        lesson.partial ? " with incomplete or uncertain text" : ""
      }}. If something looks off, compare the original.
    </p>
  </article>
</template>
