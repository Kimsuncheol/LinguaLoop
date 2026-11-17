<script setup lang="ts">
import { appLanguage, locale, setAppLanguage, t, type AppLanguage } from '../services/appLanguage';
defineEmits<{ back: [] }>();
const options: { value: AppLanguage; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Use your device language.' },
  { value: 'en', label: 'English', description: 'Display the app in English.' },
  { value: 'ko', label: 'Korean', description: 'Display the app in Korean.' },
];
</script>
<template>
  <section class="view app-language-view" :aria-label="t('App language')">
    <button class="text-button" @click="$emit('back')">{{ t('← Back') }}</button>
    <h1 tabindex="-1">{{ t('App language') }}</h1>
    <p class="muted">{{ t('Choose the language used throughout LinguaLoop. Lesson content stays in its original language.') }}</p>
    <fieldset class="language-options">
      <legend class="sr-only">{{ t('App language') }}</legend>
      <label v-for="option in options" :key="option.value" class="language-option">
        <input type="radio" name="app-language" :value="option.value" :checked="appLanguage === option.value" @change="setAppLanguage(option.value)" />
        <span><strong>{{ t(option.label) }}</strong><span class="muted">{{ t(option.description) }}</span></span>
      </label>
    </fieldset>
    <p v-if="appLanguage === 'system'" class="muted" role="status">{{ t('Current system language: {language}', { language: t(locale === 'ko' ? 'Korean' : 'English') }) }}</p>
  </section>
</template>
