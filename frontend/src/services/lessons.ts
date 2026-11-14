export type Language = "en" | "ja";
export interface Example {
  text: string;
  reading: string | null;
  meaning: string | null;
}
export interface Expression extends Example {
  explanation: string | null;
  examples: Example[];
}
export interface Lesson {
  id: string;
  language: Language;
  title: string | null;
  date: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  expression: string | null;
  meaning: string | null;
  reading: string | null;
  explanation: string | null;
  dialogue: string | null;
  translation: string | null;
  words: string | null;
  expressions: Expression[];
  vocabulary: Expression[];
  notes: string[];
  partial: boolean;
}
export interface LessonPage {
  items: Lesson[];
  nextOffset: number | null;
}
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(35000)])
      : AbortSignal.timeout(35000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 404
          ? "This lesson is no longer available."
          : "Lessons are unavailable right now. Please try again.",
    );
  return response.json();
}
export function lessons(
  offset = 0,
  language: Language = "en",
  signal?: AbortSignal,
) {
  return read<LessonPage>(
    `/api/lessons?language=${language}&offset=${offset}`,
    signal,
  );
}
export function lesson(language: Language, id: string, signal?: AbortSignal) {
  return read<Lesson>(
    `/api/lessons/${language}/${encodeURIComponent(id)}`,
    signal,
  );
}
export const languageName = (language: Language) =>
  language === "en" ? "English" : "Japanese";
export function lessonDate(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Seoul",
      })
    : "Date unavailable";
}
