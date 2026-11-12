export interface Lesson {
  id: string;
  title: string | null;
  date: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  expression: string | null;
  meaning: string | null;
  explanation: string | null;
  dialogue: string | null;
  translation: string | null;
  words: string | null;
  partial: boolean;
}
export interface LessonPage {
  items: Lesson[];
  nextOffset: number | null;
}
export async function lessons(offset = 0): Promise<LessonPage> {
  const response = await fetch(`/api/lessons?offset=${offset}`, {
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : "Lessons are unavailable right now. Please try again.",
    );
  return response.json();
}
