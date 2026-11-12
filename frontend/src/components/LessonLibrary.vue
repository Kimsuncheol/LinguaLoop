<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { lessons, type Lesson } from "../services/lessons";
import LoadingSkeleton from "./LoadingSkeleton.vue";
const items = ref<Lesson[]>([]);
const loading = ref(false),
  error = ref(""),
  nextOffset = ref<number | null>(0);
const selected = ref<Lesson | null>(null),
  practicing = ref(false),
  revealed = ref(false),
  index = ref(0);
const tab = ref("Dialogue");
const practiceItems = computed(() =>
  items.value.filter((item) => item.expression),
);
const current = computed(() => practiceItems.value[index.value]);
const content = computed(() =>
  selected.value
    ? {
        Dialogue: selected.value.dialogue,
        Meaning: selected.value.explanation,
        Words: selected.value.words,
      }[tab.value]
    : null,
);
function date(value: string | null) {
  if (!value) return "CHOSUN";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "CHOSUN"
    : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Seoul" })} · CHOSUN`;
}
async function load() {
  if (loading.value || nextOffset.value === null) return;
  loading.value = true;
  error.value = "";
  try {
    const result = await lessons(nextOffset.value);
    items.value.push(
      ...result.items.filter(
        (item) => !items.value.some((old) => old.id === item.id),
      ),
    );
    nextOffset.value = result.nextOffset;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to load lessons.";
  } finally {
    loading.value = false;
  }
}
function open(item: Lesson) {
  selected.value = item;
  tab.value = item.dialogue
    ? "Dialogue"
    : item.explanation
      ? "Meaning"
      : "Words";
  practicing.value = false;
}
function selectTab(event: KeyboardEvent) {
  const names = ["Dialogue", "Meaning", "Words"];
  const position = names.indexOf(tab.value);
  const next =
    event.key === "ArrowRight"
      ? (position + 1) % 3
      : event.key === "ArrowLeft"
        ? (position + 2) % 3
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 2
            : -1;
  if (next < 0) return;
  event.preventDefault();
  tab.value = names[next]!;
  document.getElementById(`tab-${tab.value}`)?.focus();
}
function move(delta: number) {
  index.value += delta;
  revealed.value = false;
}
onMounted(load);
</script>
<template>
  <LoadingSkeleton v-if="loading && !items.length" label="Loading lessons" />
  <section v-else-if="selected" class="detail view" aria-label="Lesson detail">
    <button class="text-button" @click="selected = null">← Lessons</button>
    <p class="eyebrow">{{ date(selected.date) }}</p>
    <h1>
      {{ selected.expression || selected.title || "Lesson text unavailable" }}
    </h1>
    <p v-if="selected.meaning" class="meaning" lang="ko">
      {{ selected.meaning }}
    </p>
    <div class="tabs" role="tablist" aria-label="Lesson sections">
      <button
        v-for="name in ['Dialogue', 'Meaning', 'Words']"
        :id="`tab-${name}`"
        :key="name"
        role="tab"
        :tabindex="tab === name ? 0 : -1"
        @keydown="selectTab"
        :aria-selected="tab === name"
        aria-controls="lesson-panel"
        :class="{ active: tab === name }"
        @click="tab = name"
      >
        {{ name }}
      </button>
    </div>
    <div
      id="lesson-panel"
      role="tabpanel"
      :aria-labelledby="`tab-${tab}`"
      class="conversation"
    >
      <p class="eyebrow">
        {{ tab === "Dialogue" ? "IN CONVERSATION" : tab.toUpperCase() }}
      </p>
      <p
        v-if="content"
        class="lesson-copy"
        :lang="tab === 'Meaning' ? 'ko' : undefined"
      >
        {{ content }}
      </p>
      <p v-else>
        This section is unavailable. You can compare the original lesson below.
      </p>
      <p
        v-if="tab === 'Dialogue' && selected.translation"
        class="translation lesson-copy"
        lang="ko"
      >
        {{ selected.translation }}
      </p>
    </div>
    <div class="source-links">
      <a
        v-if="selected.imageUrl"
        :href="selected.imageUrl"
        target="_blank"
        rel="noopener noreferrer"
        >View original lesson image ↗</a
      >
      <a
        v-if="selected.sourceUrl"
        :href="selected.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        >Read the source article ↗</a
      >
    </div>
    <p class="muted">
      Extracted from a lesson image{{
        selected.partial ? " with incomplete processing" : ""
      }}. If something looks off, compare the original.
    </p>
  </section>
  <section
    v-else-if="practicing && current"
    class="practice view"
    aria-label="Recall practice"
  >
    <button class="text-button" @click="practicing = false">← Lessons</button>
    <div class="section-heading">
      <p class="eyebrow">FROM THIS PAGE</p>
      <span>{{ index + 1 }} / {{ practiceItems.length }}</span>
    </div>
    <progress
      :value="index + 1"
      :max="practiceItems.length"
      aria-label="Practice position"
    ></progress>
    <div class="focus-card">
      <p class="eyebrow">ONE EXPRESSION</p>
      <h1>{{ current.expression }}</h1>
      <p>Can you remember what it means?</p>
      <p class="eyebrow">{{ date(current.date) }}</p>
    </div>
    <button
      class="primary full"
      :aria-expanded="revealed"
      @click="revealed = !revealed"
    >
      {{ revealed ? "Hide Korean meaning" : "Reveal Korean meaning" }}
    </button>
    <p v-if="revealed" class="meaning reveal" lang="ko" aria-live="polite">
      {{
        current.meaning || "Translation unavailable. Check the original lesson."
      }}
    </p>
    <p class="hint">
      Take a moment. Say it out loud. Then open the dialogue to see how the
      expression is used.
    </p>
    <button class="text-button" @click="open(current)">
      Open full lesson ↗
    </button>
    <div class="section-heading">
      <button :disabled="index === 0" class="text-button" @click="move(-1)">
        ← Previous</button
      ><button
        :disabled="index === practiceItems.length - 1"
        class="text-button"
        @click="move(1)"
      >
        Next expression →
      </button>
    </div>
  </section>
  <section v-else class="view" aria-label="Lesson library">
    <p class="eyebrow">YOUR DAILY DOSE</p>
    <div class="section-heading">
      <h1>A little English,<br />every day.</h1>
      <button
        v-if="practiceItems.length"
        class="secondary"
        @click="
          practicing = true;
          index = 0;
          revealed = false;
        "
      >
        Practice these expressions ↗
      </button>
    </div>
    <p class="muted">
      Short expressions. Real conversations. One lesson at a time.
    </p>
    <div v-if="items.length" class="lesson-grid">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        class="lesson-card"
        :class="{ featured: i === 0 }"
        @click="open(item)"
      >
        <span class="eyebrow">{{ date(item.date) }}</span>
        <h2>
          {{ item.expression || item.title || "Lesson text unavailable" }}
        </h2>
        <p lang="ko">
          {{ item.meaning || "Open the lesson to view available context." }}
        </p>
        <span class="card-action">Read lesson →</span>
      </button>
    </div>
    <div v-else-if="!error" class="empty">
      <h2>Your first expression is on its way.</h2>
      <p>No lessons are available yet. Check again in a little while.</p>
      <button
        class="secondary"
        @click="
          nextOffset = 0;
          load();
        "
      >
        Refresh lessons
      </button>
    </div>
    <LoadingSkeleton v-if="loading" label="Loading more lessons" />
    <div v-if="error" role="alert" class="error">
      <p>{{ error }}</p>
      <button class="secondary" @click="load">Try again</button>
    </div>
    <button
      v-else-if="nextOffset !== null && items.length"
      class="secondary load-more"
      :disabled="loading"
      @click="load"
    >
      {{ loading ? "Loading…" : "Load more lessons" }}
    </button>
  </section>
</template>
