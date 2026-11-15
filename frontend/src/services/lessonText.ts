export interface DialogueTurn {
  speaker: "A" | "B";
  text: string;
}
export function meaningParagraphs(text: string | null): string[] {
  if (!text?.trim()) return [];
  // Restore an obvious OCR boundary before a quoted English expression.
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .replace(/([가-힣][.!?])(?=['“‘「『][A-Za-z])/g, "$1\n\n")
    .split(/\n\s*\n/);
  const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
  return blocks.flatMap((block) => {
    const paragraphs: string[] = [];
    for (const part of segmenter.segment(block.replace(/\n/g, " "))) {
      const text = part.segment.trim();
      if (!text) continue;
      const last = paragraphs[paragraphs.length - 1];
      if (last && /\b(?:Dr|Mr|Mrs|Ms|Prof|St|e\.g|i\.e)\.$/i.test(last)) {
        paragraphs[paragraphs.length - 1] += " " + text;
      } else if (
        last &&
        /['"”’」』]$/.test(last) &&
        /^(?:라고|라는|라며|하고|하며|하는|이라고|이라는)/.test(text)
      ) {
        paragraphs[paragraphs.length - 1] += text;
      } else paragraphs.push(text);
    }
    return paragraphs;
  });
}
export function dialogueTurns(text: string | null): {
  intro: string;
  turns: DialogueTurn[];
} {
  const turns: DialogueTurn[] = [],
    intro: string[] = [];
  for (const line of (text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const marker = line.match(
      /^\s*(?:\[([AB])\]\s*|([AB])(?:\s*[:：.)]\s*|[ \t]+-\s+|[ \t]+|(?=[가-힣ぁ-んァ-ヶ一-龯])|$))(.*)$/,
    );
    if (marker)
      turns.push({
        speaker: (marker[1] || marker[2]) as "A" | "B",
        text: marker[3].trim(),
      });
    else if (/^\s*(?:\[[C-Z]\]|[C-Z]\s*[:：.)])/.test(line))
      return { intro: text || "", turns: [] };
    else if (turns.length) turns[turns.length - 1]!.text += "\n" + line;
    else intro.push(line);
  }
  return {
    intro: intro.join("\n").trim(),
    turns: turns.map((turn) => ({ ...turn, text: turn.text.trim() })),
  };
}
export function dialogueMessages(
  dialogue: string | null,
  translation: string | null,
) {
  const original = dialogueTurns(dialogue),
    translated = dialogueTurns(translation);
  // OCR sometimes drops a speaker label. Recover only when sentence counts
  // agree and every surviving English label matches a Korean turn boundary.
  if (
    original.turns.length > 0 &&
    original.turns.length < translated.turns.length &&
    !translated.intro
  ) {
    const english = original.turns.flatMap((turn) =>
      dialogueSentences(turn.text, "en").map((text, i) => ({
        text, speaker: i === 0 ? turn.speaker : null,
      })),
    );
    const korean = translated.turns.flatMap((turn, turnIndex) =>
      dialogueSentences(turn.text, "ko").map((text, i) => ({
        text, speaker: turn.speaker, start: i === 0, turnIndex,
      })),
    );
    if (
      english.length === korean.length &&
      english.every((sentence, i) =>
        !sentence.speaker ||
        (korean[i]!.start && sentence.speaker === korean[i]!.speaker),
      )
    ) {
      original.turns = translated.turns.map((turn, i) => ({
        speaker: turn.speaker,
        text: english.filter((_, j) => korean[j]!.turnIndex === i)
          .map((s) => s.text).join(" "),
      }));
    }
  }
  const aligned =
    translated.intro === "" &&
    original.turns.length > 0 &&
    original.turns.length === translated.turns.length &&
    original.turns.every(
      (turn, i) => turn.speaker === translated.turns[i]!.speaker,
    );
  return {
    intro: original.intro,
    messages: original.turns.map((turn, i) => {
      const translation = aligned ? translated.turns[i]!.text : null;
      return {
        ...turn,
        isMine: turn.speaker === "B",
        translation,
      };
    }),
    separateTranslation: aligned ? null : translation,
  };
}

export function dialogueSentences(text: string | null, language: string): string[] {
  if (!text?.trim()) return [];
  const normalized = text
    .replace(/\s*\n\s*/g, " ")
    .replace(/([.!?。！？])(?=[가-힣])/g, "$1\n");
  const sentences: string[] = [];
  const segmenter = new Intl.Segmenter(language, { granularity: "sentence" });
  for (const part of segmenter.segment(normalized)) {
    const sentence = part.segment.trim();
    const last = sentences[sentences.length - 1];
    if (last && /\b(?:Dr|Mr|Mrs|Ms|Prof|St|e\.g|i\.e)\.$/i.test(last)) {
      sentences[sentences.length - 1] += " " + sentence;
    } else if (sentence) sentences.push(sentence);
  }
  return sentences;
}

/** Highlight literal expression matches while keeping source text and markup safe. */
export function expressionParts(
  text: string,
  expression: string | null | undefined,
) {
  if (!expression?.trim()) return [{ text, emphasized: false }];
  const pattern = expression
    .trim()
    .split(/\s+/)
    .map((word) =>
      [...word]
        .map((char) =>
          /['’‘]/.test(char)
            ? "['’‘]"
            : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join(""),
    )
    .join("\\s+");
  const matches = text.matchAll(
    new RegExp(`(^|[^A-Za-z0-9])(${pattern})(?=$|[^A-Za-z0-9])`, "gi"),
  );
  const parts: { text: string; emphasized: boolean }[] = [];
  let cursor = 0;
  for (const match of matches) {
    const start = match.index! + match[1]!.length;
    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), emphasized: false });
    parts.push({ text: match[2]!, emphasized: true });
    cursor = start + match[2]!.length;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), emphasized: false });
  return parts.length ? parts : [{ text, emphasized: false }];
}
