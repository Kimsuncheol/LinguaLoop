<script setup lang="ts">
import { t } from "../services/appLanguage";
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import {
  lessons,
  lesson,
  type Lesson,
  type Language,
  languageName,
  lessonDate,
  newestLessonFirst,
} from "../services/lessons";
import { useLibraryNavigation, type LibraryView } from "../services/navigation";
import AppLanguage from "./AppLanguage.vue";
import ExitConfirmation from "./ExitConfirmation.vue";
import LoadingSkeleton from "./LoadingSkeleton.vue";
import LessonReader from "./LessonReader.vue";
import LessonPractice from "./LessonPractice.vue";
import BackToTop from "./BackToTop.vue";
const language = ref<Language>("en");
const cache = reactive<
  Record<Language, { items: Lesson[]; next: number | null; loaded: boolean }>
>({
  en: { items: [], next: 0, loaded: false },
  ja: { items: [], next: 0, loaded: false },
  zh: { items: [], next: 0, loaded: false },
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
    target.items.sort(newestLessonFirst);
    target.next = result.nextOffset;
    target.loaded = true;
  } catch (cause) {
    if (!controller.signal.aborted) error.value = (cause as Error).message;
  } finally {
    if (listController === controller) loading.value = false;
  }
}
const detailCache = new Map<string, Lesson>();
const practiceLoading = ref(false),
  practiceError = ref("");
const {
  entry,
  view,
  navigate,
  back,
  home,
  exitRequested,
  exitReady,
  exitHint,
  stay,
  leave,
} = useLibraryNavigation(restoreView);
const backLabel = computed(() =>
  entry.value.parent === "practice"
    ? "← Back to practice"
    : entry.value.parent === "lesson"
      ? "← Previous lesson"
      : "← Back to library",
);
async function restoreView(target: LibraryView) {
  listController?.abort();
  detailController?.abort();
  loading.value = false;
  detailLoading.value = false;
  practiceLoading.value = false;
  error.value = "";
  detailError.value = "";
  practiceError.value = "";
  selected.value = null;
  practice.value = null;
  language.value = target.language;
  if (target.kind === "dashboard" || target.kind === "app-language") return;
  if (target.kind === "expressions") {
    if (!state.value.loaded) await load();
    return;
  }
  const controller = new AbortController();
  detailController = controller;
  async function get(id: string) {
    const key = `${target.language}:${id}`;
    const cached = detailCache.get(key);
    if (cached) return cached;
    const result = await lesson(target.language, id, controller.signal);
    if (!controller.signal.aborted) detailCache.set(key, result);
    return result;
  }
  if (target.kind === "lesson") {
    detailLoading.value = true;
    try {
      const result = await get(target.ids[0]!);
      if (!controller.signal.aborted) selected.value = result;
    } catch (cause) {
      if (!controller.signal.aborted)
        detailError.value = (cause as Error).message;
    } finally {
      if (detailController === controller) detailLoading.value = false;
    }
  } else {
    practiceLoading.value = true;
    try {
      // Practice normally uses loaded cards; refresh/Forward can rehydrate IDs.
      const result: Lesson[] = [];
      for (const id of target.ids) {
        if (controller.signal.aborted) return;
        result.push(
          state.value.items.find((item) => item.id === id) || (await get(id)),
        );
      }
      if (!controller.signal.aborted) practice.value = result;
    } catch (cause) {
      if (!controller.signal.aborted)
        practiceError.value = (cause as Error).message;
    } finally {
      if (detailController === controller) practiceLoading.value = false;
    }
  }
}
function openExpressions(value: Language) {
  navigate({ kind: "expressions", language: value });
}
function open(item: Lesson) {
  navigate({ kind: "lesson", language: item.language, ids: [item.id] });
}
function startPractice(items: Lesson[]) {
  navigate({
    kind: "practice",
    language: language.value,
    ids: items.map((item) => item.id),
  });
}
function retry() {
  void restoreView(view.value);
}
const loadMoreTarget = ref<HTMLElement | null>(null);
let loadMoreObserver: IntersectionObserver | undefined;
watch(
  [loadMoreTarget, loading, error, () => state.value.next, () => view.value.kind, language],
  () => {
    loadMoreObserver?.disconnect();
    loadMoreObserver = undefined;
    if (
      !loadMoreTarget.value || loading.value || error.value ||
      view.value.kind !== "expressions" || state.value.next === null ||
      !state.value.loaded || !state.value.items.length ||
      typeof IntersectionObserver === "undefined"
    ) return;
    const observer = new IntersectionObserver((entries) => {
      if (loadMoreObserver === observer && entries.some((entry) => entry.isIntersecting) && !error.value && view.value.kind === "expressions")
        void load();
    }, { rootMargin: "0px 0px 240px 0px" });
    loadMoreObserver = observer;
    loadMoreObserver.observe(loadMoreTarget.value);
  },
  { flush: "post" },
);
function openAppLanguage() { navigate({ kind: "app-language", language: language.value }); }
defineExpose({ home, openAppLanguage });
onUnmounted(() => {
  loadMoreObserver?.disconnect();
  listController?.abort();
  detailController?.abort();
});
</script>
<template>
  <AppLanguage v-if="view.kind === 'app-language'" @back="back" />
  <BackToTop v-if="view.kind === 'expressions'" />
  <ExitConfirmation
    :open="exitRequested"
    :ready="exitReady"
    @stay="stay"
    @leave="leave"
  />
  <p v-if="exitHint" class="hint" role="status">{{ t("Press Back once more to leave the app.") }}</p>
  <KeepAlive :max="10">
    <LessonPractice
      v-if="view.kind === 'practice' && practice"
      :key="entry.key"
      :lessons="practice"
      @back="back"
      @open="open"
    />
  </KeepAlive>
  <section v-if="view.kind === 'practice' && !practice" class="practice view">
    <button class="text-button" @click="back">{{ t("← Back") }}</button>
    <div v-if="practiceLoading" role="status" :aria-label="t('Loading practice')">
      <span class="sr-only">{{ t("Loading practice") }}</span>
      <div class="skeleton skeleton-heading" aria-hidden="true"></div>
      <div class="skeleton reader-skeleton-body" aria-hidden="true"></div>
    </div>
    <div v-else-if="practiceError" class="error" role="alert">
      <p>{{ t(practiceError) }}</p>
      <button class="secondary" @click="retry">{{ t("Try again") }}</button>
    </div>
  </section>
  <section
    v-if="view.kind !== 'practice' && view.kind !== 'app-language'"
    class="view"
    :class="{ 'expression-list': view.kind === 'expressions', 'loading-more': loading && state.items.length > 0 }"
    :aria-label="t('Lesson library')"
  >
    <template v-if="view.kind === 'dashboard'">
      <p class="eyebrow">{{ t("YOUR DAILY DOSE") }}</p>
      <h1 tabindex="-1">{{ t("A little language,") }}<br />{{ t("every day.") }}</h1>
      <p class="muted">{{ t("Choose a language to explore its expressions.") }}</p>
      <nav class="language-grid" :aria-label="t('Expression lists by language')">
        <button
          v-for="value in ['en', 'ja', 'zh'] as const"
          :key="value"
          class="language-card"
          :aria-label="languageName(value)"
          @click="openExpressions(value)"
        >
          <span class="language-icon" :lang="value" aria-hidden="true">{{ { en: 'Aa', ja: 'あ', zh: '文' }[value] }}</span>
          <span class="language-card-name">{{ languageName(value) }}</span>
        </button>
      </nav>
    </template>
    <div v-if="view.kind === 'lesson'" class="reader-workspace">
      <aside class="lesson-sidebar" :aria-label="t('Lessons on this page')">
        <p class="eyebrow">{{ t('{language} lessons', { language: languageName(language) }) }}</p>
        <button
          v-for="item in state.items"
          :key="item.id"
          class="sidebar-lesson"
          :aria-current="selected?.id === item.id ? 'true' : undefined"
          @click="open(item)"
        >
          <strong :lang="language">{{
            item.expression || item.title || t("Lesson")
          }}</strong><span>{{ lessonDate(item.date) }}</span>
        </button>
      </aside>
      <div>
        <div
          v-if="detailLoading"
          class="detail-skeleton"
          role="status"
          :aria-label="t('Loading lesson detail')"
        >
          <span class="sr-only">{{ t("Loading lesson detail") }}</span>
          <div class="skeleton skeleton-heading" aria-hidden="true"></div>
          <div class="skeleton skeleton-subtitle" aria-hidden="true"></div>
          <div class="skeleton reader-skeleton-body" aria-hidden="true"></div>
        </div>
        <div v-else-if="detailError" class="error" role="alert">
          <button class="text-button" @click="back">{{ t(backLabel) }}</button>
          <p>{{ t(detailError) }}</p>
          <button class="secondary" @click="retry">{{ t("Try again") }}</button>
        </div>
        <LessonReader
          v-else-if="selected"
          :lesson="selected"
          @practice="startPractice([selected])"
        />
      </div>
    </div>
    <template v-else-if="view.kind === 'expressions'">
      <div class="section-heading">
        <h1 tabindex="-1">{{ t('{language} expressions', { language: languageName(language) }) }}</h1>
        <button
          v-if="canPractice"
          class="secondary"
          @click="startPractice(state.items)"
        >{{ t("Practice these expressions ↗") }}</button>
      </div>
      <p class="muted">{{ t("Real expressions. Useful context. Choose a lesson and make it yours.") }}</p>
      <LoadingSkeleton
        :show-heading="false"
        v-if="loading && !state.items.length"
        :label="t('Loading {language} lessons', { language: languageName(language) })"
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
            {{ item.expression || item.title || t("Lesson text unavailable") }}
          </h2>
          <p v-if="item.reading" class="reading" :lang="language">
            {{ item.reading }}
          </p>
          <p lang="ko">
            {{ item.meaning || t("Open the lesson to view available context.") }}
          </p>
          <span class="card-action">{{ t("Open lesson →") }}</span>
        </button>
      </div>
      <LoadingSkeleton
        :show-heading="false"
        v-if="loading && state.items.length"
        :label="t('Loading more lessons')"
      />
      <div v-if="error" role="alert" class="error">
        <p>{{ t(error) }}</p>
        <button class="secondary" @click="load">{{ t("Try again") }}</button>
      </div>
      <div
        v-else-if="state.loaded && !state.items.length && !loading"
        class="empty"
      >
        <h2>{{ t("Your first expression is on its way.") }}</h2>
        <p>{{ t('No {language} lessons are available yet.', { language: languageName(language) }) }}</p>
        <button
          class="secondary"
          @click="
            state.next = 0;
            load();
          "
        >{{ t("Refresh lessons") }}</button>
      </div>
      <button
        v-if="!loading && !error && state.next !== null && state.items.length"
        ref="loadMoreTarget"
        class="secondary load-more"
        @click="load"
      >{{ t("Load more lessons") }}</button>
    </template>
  </section>
</template>
