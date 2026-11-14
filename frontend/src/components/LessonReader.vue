<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { vocabularyItems } from "../services/vocabulary";
import type { Lesson } from "../services/lessons";
const props = defineProps<{ lesson: Lesson }>();
defineEmits<{ practice: [] }>();
const wordItems = computed(() => vocabularyItems(props.lesson.words));
const tab = ref("Expressions");
const tabs = computed(() =>
  props.lesson.language === "ja"
    ? ["Expressions", "Examples", "Vocabulary"]
    : ["Meaning", "Dialogue", "Vocabulary"],
);
watch(
  () => props.lesson.id,
  () => {
    tab.value = tabs.value[0]!;
  },
  { immediate: true },
);
const mobile = ref(false);
let viewport: MediaQueryList;
let scrollFrame = 0;
function updateViewport() {
  mobile.value = viewport.matches;
  document.documentElement.classList.toggle(
    "mobile-lesson-reader",
    mobile.value,
  );
}
function scrollToSection(name: string) {
  tab.value = name;
  const section = document.getElementById(`lesson-section-${name}`);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}
function trackSection() {
  if (!mobile.value || scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    let active = tabs.value[0]!;
    for (const name of tabs.value) {
      const section = document.getElementById(`lesson-section-${name}`);
      if (section && section.getBoundingClientRect().top <= 160) active = name;
    }
    if (
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2
    ) {
      active = tabs.value[tabs.value.length - 1]!;
    }
    tab.value = active;
  });
}
onMounted(() => {
  viewport = window.matchMedia("(max-width: 800px)");
  updateViewport();
  viewport.addEventListener("change", updateViewport);
  window.addEventListener("scroll", trackSection, { passive: true });
});
onUnmounted(() => {
  viewport.removeEventListener("change", updateViewport);
  window.removeEventListener("scroll", trackSection);
  window.cancelAnimationFrame(scrollFrame);
  document.documentElement.classList.remove("mobile-lesson-reader");
});
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
    <h1 tabindex="-1" :lang="lesson.language">
      {{ lesson.expression || lesson.title || "Lesson text unavailable" }}
    </h1>
    <p v-if="lesson.reading" class="reading" lang="ja">{{ lesson.reading }}</p>
    <p v-if="lesson.meaning" class="meaning" lang="ko">{{ lesson.meaning }}</p>
    <nav v-if="mobile" class="tabs section-chips" aria-label="Lesson sections">
      <a
        v-for="name in tabs"
        :key="name"
        :href="`#lesson-section-${name}`"
        :class="{ active: tab === name }"
        :aria-current="tab === name ? 'location' : undefined"
        @click.prevent="scrollToSection(name)"
        >{{ name }}</a
      >
    </nav>
    <div v-else class="tabs" role="tablist" aria-label="Lesson sections">
      <button
        v-for="name in tabs"
        :id="`tab-${name}`"
        :key="name"
        role="tab"
        :tabindex="tab === name ? 0 : -1"
        :aria-selected="tab === name"
        :aria-controls="`lesson-section-${name}`"
        :class="{ active: tab === name }"
        @keydown="navigate"
        @click="tab = name"
      >
        {{ name }}
      </button>
    </div>
    <section
      v-for="section in tabs"
      v-show="mobile || tab === section"
      :id="`lesson-section-${section}`"
      :key="section"
      class="conversation lesson-section"
      :role="mobile ? 'region' : 'tabpanel'"
      :aria-label="mobile ? section : undefined"
      :aria-labelledby="mobile ? undefined : `tab-${section}`"
      :tabindex="mobile ? -1 : 0"
    >
      <h2 v-if="mobile" class="lesson-section-heading">{{ section }}</h2>
      <template v-if="lesson.language === 'ja' && section === 'Expressions'">
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
      <template v-else-if="section === 'Examples'">
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
      <template v-else-if="section === 'Vocabulary'">
        <ul
          v-if="
            lesson.vocabulary.length || wordItems.length || lesson.notes.length
          "
          class="vocabulary-list"
        >
          <li v-for="(word, i) in lesson.vocabulary" :key="`word-${i}`">
            <h3 :lang="lesson.language">{{ word.text }}</h3>
            <p v-if="word.reading" class="reading" :lang="lesson.language">
              {{ word.reading }}
            </p>
            <p v-if="word.meaning" lang="ko">{{ word.meaning }}</p>
            <p v-if="word.explanation" lang="ko">{{ word.explanation }}</p>
            <div
              v-for="(example, j) in word.examples"
              :key="j"
              class="example-block"
            >
              <p :lang="lesson.language">{{ example.text }}</p>
              <p v-if="example.reading" :lang="lesson.language">
                {{ example.reading }}
              </p>
              <p v-if="example.meaning" lang="ko">{{ example.meaning }}</p>
            </div>
          </li>
          <li
            v-for="(item, i) in wordItems"
            :key="`text-${i}`"
            class="lesson-copy"
          >
            {{ item }}
          </li>
          <li
            v-for="(note, i) in lesson.notes"
            :key="`note-${i}`"
            class="lesson-copy"
          >
            {{ note }}
          </li>
        </ul>
        <p
          v-if="
            !wordItems.length &&
            !lesson.vocabulary.length &&
            !lesson.notes.length
          "
        >
          Vocabulary is unavailable for this lesson.
        </p>
      </template>
      <template v-else>
        <p class="lesson-copy" :lang="section === 'Meaning' ? 'ko' : 'en'">
          {{
            (section === "Dialogue" ? lesson.dialogue : lesson.explanation) ||
            "This section is unavailable. Compare the original lesson below."
          }}
        </p>
        <p
          v-if="section === 'Dialogue' && lesson.translation"
          class="translation lesson-copy"
          lang="ko"
        >
          {{ lesson.translation }}
        </p>
      </template>
    </section>
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
