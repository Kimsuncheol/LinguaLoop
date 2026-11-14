<script setup lang="ts">
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
    <h2 id="exit-title">Leave LinguaLoop?</h2>
    <p id="exit-description">Are you sure you want to leave the app?</p>
    <div class="exit-dialog-actions">
      <button
        ref="stayButton"
        class="secondary"
        autofocus
        @click="emit('stay')"
      >
        Stay
      </button>
      <button class="primary" :disabled="!ready" @click="emit('leave')">
        Leave
      </button>
    </div>
  </dialog>
</template>
