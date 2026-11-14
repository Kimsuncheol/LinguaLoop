<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  lessons,
  lesson,
  type Lesson,
  type Language,
  languageName,
  lessonDate,
} from "../services/lessons";
import LoadingSkeleton from "./LoadingSkeleton.vue";
import LessonReader from "./LessonReader.vue";
import LessonPractice from "./LessonPractice.vue";
const language = ref<Language>("en");
const cache = reactive<
  Record<Language, { items: Lesson[]; next: number | null; loaded: boolean }>
>({
  en: { items: [], next: 0, loaded: false },
  ja: { items: [], next: 0, loaded: false },
});
const state = computed(() => cache[language.value]);
const loading = ref(false),
  error = ref(""),
  selected = ref<Lesson | null>(null),
  detailLoading = ref(false),
  detailError = ref("");
const practice = ref<Lesson[] | null>(null);
const canPractice = computed(() =>
  state.value.items.some((item) => item.expressions.length),
);
let listController: AbortController | undefined,
  detailController: AbortController | undefined;
async function load() {
  if (loading.value || state.value.next === null) return;
  listController = new AbortController();
  const controller = listController;
  const target = state.value,
    requestedLanguage = language.value;
  loading.value = true;
  error.value = "";
  try {
    const result = await lessons(
      target.next!,
      requestedLanguage,
      controller.signal,
    );
    if (controller.signal.aborted) return;
    target.items.push(
      ...result.items.filter(
        (item) => !target.items.some((old) => old.id === item.id),
      ),
    );
    target.next = result.nextOffset;
    target.loaded = true;
  } catch (cause) {
    if (!controller.signal.aborted) error.value = (cause as Error).message;
  } finally {
    if (listController === controller) loading.value = false;
  }
}
function switchLanguage(value: Language) {
  if (value === language.value) return;
  listController?.abort();
  detailController?.abort();
  loading.value = false;
  detailLoading.value = false;
  language.value = value;
  selected.value = null;
  practice.value = null;
  error.value = "";
  detailError.value = "";
  if (!state.value.loaded) void load();
}
async function open(item: Lesson) {
  detailController?.abort();
  const controller = new AbortController();
  detailController = controller;
  practice.value = null;
  selected.value = item;
  detailLoading.value = true;
  detailError.value = "";
  try {
    const result = await lesson(item.language, item.id, controller.signal);
    if (!controller.signal.aborted) selected.value = result;
  } catch (cause) {
    if (!controller.signal.aborted)
      detailError.value = (cause as Error).message;
  } finally {
    if (detailController === controller) detailLoading.value = false;
  }
}
function back() {
  detailController?.abort();
  selected.value = null;
  detailLoading.value = false;
  detailError.value = "";
}
function startPractice(items: Lesson[]) {
  practice.value = items;
}
onMounted(load);
onUnmounted(() => {
  listController?.abort();
  detailController?.abort();
});
</script>
<template>
  <LessonPractice
    v-if="practice"
    :lessons="practice"
    @back="practice = null"
    @open="open"
  />
  <section v-else class="view" aria-label="Lesson library">
    <div
      v-if="!selected"
      class="language-switch"
      role="group"
      aria-label="Lesson language"
    >
      <button
        v-for="value in ['en', 'ja'] as const"
        :key="value"
        class="secondary"
        :class="{ chosen: language === value }"
        :aria-pressed="language === value"
        @click="switchLanguage(value)"
      >
        {{ languageName(value) }}
      </button>
    </div>
    <div v-if="selected" class="reader-workspace">
      <aside class="lesson-sidebar" aria-label="Lessons on this page">
        <p class="eyebrow">{{ languageName(language) }} LESSONS</p>
        <button
          v-for="item in state.items"
          :key="item.id"
          class="sidebar-lesson"
          :aria-current="selected.id === item.id ? 'true' : undefined"
          @click="open(item)"
        >
          <strong :lang="language">{{
            item.expression || item.title || "Lesson"
          }}</strong><span>{{ lessonDate(item.date) }}</span>
        </button>
      </aside>
      <div>
        <div
          v-if="detailLoading"
          class="detail-skeleton"
          role="status"
          aria-label="Loading lesson detail"
        >
          <button class="text-button" @click="back">← Back to library</button
          ><span class="sr-only">Loading lesson detail</span>
          <div class="skeleton skeleton-heading" aria-hidden="true"></div>
          <div class="skeleton skeleton-subtitle" aria-hidden="true"></div>
          <div class="skeleton reader-skeleton-body" aria-hidden="true"></div>
        </div>
        <div v-else-if="detailError" class="error" role="alert">
          <button class="text-button" @click="back">← Back to library</button>
          <p>{{ detailError }}</p>
          <button class="secondary" @click="open(selected)">Try again</button>
        </div>
        <LessonReader
          v-else
          :lesson="selected"
          @back="back"
          @practice="startPractice([selected])"
        />
      </div>
    </div>
    <template v-else>
      <p class="eyebrow library-eyebrow">
        YOUR DAILY DOSE / {{ languageName(language) }}
      </p>
      <div class="section-heading">
        <h1>A little language,<br />every day.</h1>
        <button
          v-if="canPractice"
          class="secondary"
          @click="startPractice(state.items)"
        >
          Practice these expressions ↗
        </button>
      </div>
      <p class="muted">
        Real expressions. Useful context. Choose a lesson and make it yours.
      </p>
      <LoadingSkeleton
        v-if="loading && !state.items.length"
        :label="`Loading ${languageName(language)} lessons`"
      />
      <div v-if="state.items.length" class="lesson-grid">
        <button
          v-for="(item, i) in state.items"
          :key="item.id"
          class="lesson-card"
          :class="{ featured: i === 0 }"
          @click="open(item)"
        >
          <span class="eyebrow"
            >{{ languageName(language) }} · {{ lessonDate(item.date) }}</span
          >
          <h2 :lang="language">
            {{ item.expression || item.title || "Lesson text unavailable" }}
          </h2>
          <p v-if="item.reading" class="reading" lang="ja">
            {{ item.reading }}
          </p>
          <p lang="ko">
            {{ item.meaning || "Open the lesson to view available context." }}
          </p>
          <span class="card-action">Open lesson →</span>
        </button>
      </div>
      <LoadingSkeleton
        v-if="loading && state.items.length"
        label="Loading more lessons"
      />
      <div v-if="error" role="alert" class="error">
        <p>{{ error }}</p>
        <button class="secondary" @click="load">Try again</button>
      </div>
      <div
        v-else-if="state.loaded && !state.items.length && !loading"
        class="empty"
      >
        <h2>Your first expression is on its way.</h2>
        <p>No {{ languageName(language) }} lessons are available yet.</p>
        <button
          class="secondary"
          @click="
            state.next = 0;
            load();
          "
        >
          Refresh lessons
        </button>
      </div>
      <button
        v-if="!error && state.next !== null && state.items.length"
        class="secondary load-more"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? "Loading…" : "Load more lessons" }}
      </button>
    </template>
  </section>
</template>
