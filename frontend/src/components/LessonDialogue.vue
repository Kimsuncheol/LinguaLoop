<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { dialogueMessages } from "../services/lessonText";
import { mountBubbleChat } from "../services/bubbleChat";
const props = defineProps<{
  dialogue: string | null;
  translation: string | null;
  language: string;
}>();
const content = computed(() =>
  dialogueMessages(props.dialogue, props.translation),
);
const host = ref<HTMLElement | null>(null),
  loading = ref(false),
  failed = ref(false);
let dispose: (() => void) | undefined,
  active = false,
  revision = 0;
async function render() {
  const current = ++revision;
  dispose?.();
  dispose = undefined;
  failed.value = false;
  if (!content.value.messages.length) {
    loading.value = false;
    return;
  }
  loading.value = true;
  await nextTick();
  const target = host.value;
  if (!target) return;
  try {
    // Mount in a detached node so a late import cannot paint an old lesson.
    const container = document.createElement("div");
    const stop = await mountBubbleChat(
      container,
      content.value.messages,
      props.language,
    );
    if (!active || current !== revision) {
      stop();
      return;
    }
    target.replaceChildren(container);
    dispose = stop;
  } catch {
    if (active && current === revision) failed.value = true;
  } finally {
    if (active && current === revision) loading.value = false;
  }
}
onMounted(() => {
  active = true;
  void render();
});
watch(() => [props.dialogue, props.translation, props.language], render);
onUnmounted(() => {
  active = false;
  revision++;
  dispose?.();
});
</script>
<template>
  <div class="dialogue-chat">
    <p
      v-if="content.intro && content.messages.length && !failed"
      class="lesson-copy"
      :lang="language"
    >
      {{ content.intro }}
    </p>
    <div
      v-if="loading"
      class="dialogue-skeleton"
      role="status"
      aria-label="Loading dialogue bubbles"
    >
      <span class="sr-only">Loading dialogue bubbles</span>
      <div v-for="n in 3" :key="n" class="skeleton" aria-hidden="true"></div>
    </div>
    <div
      ref="host"
      v-show="!loading && !failed && content.messages.length"
      class="dialogue-widget"
    ></div>
    <p
      v-if="failed || !content.messages.length"
      class="lesson-copy"
      :lang="language"
    >
      {{ dialogue || "Dialogue is unavailable for this lesson." }}
    </p>
    <div
      v-if="translation && (content.separateTranslation || failed)"
      class="translation"
      lang="ko"
    >
      <p class="eyebrow">KOREAN TRANSLATION</p>
      <p class="lesson-copy">{{ translation }}</p>
    </div>
  </div>
</template>
