import { computed, ref } from 'vue'

export type AppLanguage = 'system' | 'en' | 'ko'
const storageKey = 'lingualoop-app-language'
const valid = (value: unknown): value is AppLanguage => ['system', 'en', 'ko'].includes(String(value))
function read(): AppLanguage {
  try { const value = localStorage.getItem(storageKey); return valid(value) ? value : 'system' }
  catch { return 'system' }
}
function systemLanguage(): 'en' | 'ko' {
  for (const language of navigator.languages || [navigator.language]) {
    if (/^ko(?:-|$)/i.test(language)) return 'ko'
    if (/^en(?:-|$)/i.test(language)) return 'en'
  }
  return 'en'
}
export const appLanguage = ref<AppLanguage>(read())
const system = ref(systemLanguage())
export const locale = computed(() => appLanguage.value === 'system' ? system.value : appLanguage.value)
function apply() { document.documentElement.lang = locale.value }
export function setAppLanguage(value: AppLanguage) {
  if (!valid(value)) return
  appLanguage.value = value
  try { localStorage.setItem(storageKey, value) } catch { /* Keep the in-memory choice. */ }
  apply()
}
window.addEventListener('languagechange', () => { system.value = systemLanguage(); apply() })
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) { appLanguage.value = read(); apply() }
})
apply()

// Source text belongs to the course; pass only interface messages to this catalog.
const korean: Record<string, string> = {
  'Date unavailable': '날짜 정보 없음', 'App language': '앱 언어', 'System': '시스템', 'English': '영어', 'Korean': '한국어',
  'Japanese': '일본어', 'Chinese': '중국어', 'Light': '라이트', 'Dark': '다크',
  'Choose the language used throughout LinguaLoop. Lesson content stays in its original language.': 'LinguaLoop 전체에 표시할 언어를 선택하세요. 학습 콘텐츠의 언어는 바뀌지 않습니다.',
  'Use your device language.': '기기의 언어 설정을 따릅니다.',
  'Current system language: {language}': '현재 시스템 언어: {language}',
  'Display the app in English.': '앱을 영어로 표시합니다.', 'Display the app in Korean.': '앱을 한국어로 표시합니다.',
  '← Back': '← 뒤로', 'LinguaLoop home': 'LinguaLoop 홈', 'Open settings and account': '설정 및 계정 열기',
  'Appearance: {current}. Switch to {next}': '화면 모드: {current}. {next}(으)로 변경',
  'Switch to {mode} appearance': '{mode} 화면 모드로 변경',
  'Loading account': '계정 불러오는 중', 'Signed in as {name}': '{name}님으로 로그인됨',
  'Signing out…': '로그아웃 중…', 'Sign out': '로그아웃', 'Retry account': '계정 다시 불러오기',
  'Sign in with KakaoTalk': '카카오톡으로 로그인', 'Sign in': '로그인',
  'Loading your session': '로그인 정보 불러오는 중', 'Try again': '다시 시도',
  'MAKE A LITTLE ROOM FOR LANGUAGES': '일상에 언어를 더하세요',
  'Keep your language': '언어 학습을', 'learning in motion.': '꾸준히 이어가세요.',
  'English, Japanese, and Chinese expressions, Korean meanings, and examples that make them stick.': '영어, 일본어, 중국어 표현을 한국어 뜻과 예문으로 익혀 보세요.',
  'Continue with KakaoTalk →': '카카오톡으로 시작하기 →', 'A little language, every day.': '매일 조금씩, 새로운 언어.',
  'READ · RECALL · REPEAT': '읽고 · 떠올리고 · 반복하세요', 'Your next expression': '다음 표현이', 'is waiting.': '기다리고 있어요.',
  'Learn it in context. Make it your own.': '문맥 속에서 배우고, 나만의 표현으로 만드세요.', 'Keep learning in motion.': '배움을 꾸준히 이어가세요.',
  'YOUR DAILY DOSE': '매일 만나는 표현', 'A little language,': '새로운 언어를,', 'every day.': '매일 조금씩.',
  'Choose a language to explore its expressions.': '표현을 살펴볼 학습 언어를 선택하세요.',
  'Expression lists by language': '언어별 표현 목록', 'Lesson library': '학습 자료실',
  '{language} expressions': '{language} 표현', '{language} lessons': '{language} 학습 자료',
  'Practice these expressions ↗': '이 표현들 연습하기 ↗',
  'Real expressions. Useful context. Choose a lesson and make it yours.': '실용적인 표현을 문맥과 함께 익혀 보세요. 학습 자료를 선택해 시작하세요.',
  'Loading {language} lessons': '{language} 학습 자료 불러오는 중', 'Loading more lessons': '학습 자료 더 불러오는 중',
  'Loading lesson detail': '학습 내용 불러오는 중', 'Loading practice': '연습 불러오는 중',
  'Lesson': '학습 자료', 'Lesson text unavailable': '학습 내용을 표시할 수 없습니다',
  'Open the lesson to view available context.': '학습 자료를 열어 내용을 확인하세요.', 'Open lesson →': '학습 자료 열기 →',
  'Your first expression is on its way.': '첫 번째 표현을 준비하고 있어요.',
  'No {language} lessons are available yet.': '아직 {language} 학습 자료가 없습니다.', 'Refresh lessons': '학습 자료 새로고침', 'Load more lessons': '학습 자료 더 보기',
  'Lessons on this page': '이 페이지의 학습 자료', '← Back to practice': '← 연습으로 돌아가기',
  '← Previous lesson': '← 이전 학습 자료', '← Back to library': '← 자료실로 돌아가기',
  'Press Back once more to leave the app.': '앱을 종료하려면 뒤로 가기를 한 번 더 누르세요.',
  'Leave LinguaLoop?': 'LinguaLoop를 종료할까요?', 'Are you sure you want to leave the app?': '앱을 종료하시겠어요?',
  'Stay': '계속하기', 'Leave': '종료', 'Back to top': '맨 위로', 'Loading view': '화면 불러오는 중',
  'Lesson detail': '학습 내용', 'Lesson sections': '학습 내용 구분', 'Expressions': '표현', 'Examples': '예문',
  'Vocabulary': '어휘', 'Meaning': '뜻과 해설', 'Dialogue': '대화',
  'Expressions are unavailable for this lesson.': '이 학습 자료에는 표시할 표현이 없습니다.',
  'No examples supplied for this expression.': '이 표현에는 제공된 예문이 없습니다.',
  'Vocabulary is unavailable for this lesson.': '이 학습 자료에는 제공된 어휘가 없습니다.',
  'This section is unavailable. Compare the original lesson below.': '이 내용을 표시할 수 없습니다. 아래 원본 학습 자료를 확인하세요.',
  'Practice this lesson →': '이 학습 자료 연습하기 →', 'View original lesson image ↗': '원본 학습 이미지 보기 ↗',
  'Read the source article ↗': '원문 기사 읽기 ↗',
  'Extracted from a lesson image. If something looks off, compare the original.': '학습 이미지에서 추출한 내용입니다. 이상한 부분은 원본과 비교해 주세요.',
  'Extracted from a lesson image with incomplete or uncertain text. If something looks off, compare the original.': '학습 이미지에서 추출한 내용에 누락되거나 불확실한 부분이 있습니다. 원본과 비교해 주세요.',
  'Loading dialogue bubbles': '대화 불러오는 중', 'Dialogue is unavailable for this lesson.': '이 학습 자료에는 제공된 대화가 없습니다.',
  'KOREAN TRANSLATION': '한국어 번역', 'Dialogue between characters A and B': 'A와 B의 대화',
  'Recall practice': '표현 떠올리기 연습', '{language} / PRACTICE': '{language} / 연습',
  'Practice position': '연습 진행 위치', 'ONE EXPRESSION': '하나의 표현', 'Can you remember what it means?': '어떤 뜻인지 기억나나요?',
  'Hide meaning': '뜻 숨기기', 'Reveal meaning': '뜻 보기', 'Translation unavailable. Check the original lesson.': '번역이 없습니다. 원본 학습 자료를 확인하세요.',
  'Say it out loud, then open the lesson to see its context. Progress is not saved.': '소리 내어 말한 뒤 학습 자료를 열어 문맥을 확인하세요. 연습 진행 상황은 저장되지 않습니다.',
  'Open full lesson ↗': '전체 학습 자료 열기 ↗', '← Previous': '← 이전', 'Next expression →': '다음 표현 →',
  'No expressions are available to practice.': '연습할 수 있는 표현이 없습니다.',
  'LinguaLoop update': 'LinguaLoop 업데이트', 'Update recommended': '업데이트 권장', 'LinguaLoop has been updated': 'LinguaLoop가 업데이트되었습니다',
  'Update now to get the latest improvements. Your page will refresh.': '최신 개선 사항을 적용하려면 지금 업데이트하세요. 페이지가 새로고침됩니다.',
  'Updating…': '업데이트 중…', 'Update now': '지금 업데이트', 'Dismiss update notification': '업데이트 알림 닫기', 'Dismiss': '닫기',
  'Couldn’t load the update. Check your connection and try again.': '업데이트를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.',
  'A new update is available.': '새 업데이트가 있습니다.',
  'Unable to load your session. Please try again.': '로그인 정보를 불러오지 못했습니다. 다시 시도하세요.',
  'Unable to sign out. Please try again.': '로그아웃하지 못했습니다. 다시 시도하세요.',
  'Your session has expired. Please sign in again.': '로그인이 만료되었습니다. 다시 로그인하세요.',
  'This lesson is no longer available.': '이 학습 자료는 더 이상 제공되지 않습니다.',
  'Lessons are unavailable right now. Please try again.': '지금은 학습 자료를 불러올 수 없습니다. 다시 시도하세요.',
}
export function t(message: string, values: Record<string, string | number> = {}): string {
  const translated = locale.value === 'ko' ? korean[message] || message : message
  return translated.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}
