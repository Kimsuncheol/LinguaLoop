<script setup lang="ts">
import { t } from "../services/appLanguage";
import { nextTick, onMounted, ref, watch } from "vue";
const props = defineProps<{ open: boolean; ready: boolean }>();
const emit = defineEmits<{ stay: []; leave: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const stayButton = ref<HTMLButtonElement | null>(null);
async function sync() {
  await nextTick();
  if (props.open && !dialog.value?.open) {
    dialog.value?.showModal();
    stayButton.value?.focus();
  } else if (!props.open && dialog.value?.open) dialog.value.close();
}
watch(() => props.open, sync);
onMounted(sync);
</script>
<template>
  <dialog
    ref="dialog"
    class="exit-dialog"
    aria-labelledby="exit-title"
    aria-describedby="exit-description"
    @cancel.prevent="emit('stay')"
  >
    <h2 id="exit-title">{{ t("Leave LinguaLoop?") }}</h2>
    <p id="exit-description">{{ t("Are you sure you want to leave the app?") }}</p>
    <div class="exit-dialog-actions">
      <button
        ref="stayButton"
        class="secondary"
        autofocus
        @click="emit('stay')"
      >{{ t("Stay") }}</button>
      <button class="primary" :disabled="!ready" @click="emit('leave')">{{ t("Leave") }}</button>
    </div>
  </dialog>
</template>
