import { test } from "node:test";
import assert from "node:assert/strict";
import {
  meaningParagraphs,
  expressionParts,
  dialogueTurns,
  dialogueMessages,
  dialogueSentences,
} from "../src/services/lessonText.ts";

test("sentence boundaries handle OCR punctuation and English titles", () => {
  assert.deepEqual(dialogueSentences("See Dr. Kim. Are you ready?", "en"), ["See Dr. Kim.", "Are you ready?"]);
  const result = dialogueMessages("A It really was. I feel recharged. I'd do it again.", "A 정말 그랬어.재충전된 기분이야.또 하고 싶다.");
  assert.equal(result.messages[0]!.text, "It really was. I feel recharged. I'd do it again.");
  assert.equal(result.messages[0]!.translation, "정말 그랬어.재충전된 기분이야.또 하고 싶다.");
});

test("a missing OCR label is recovered only with matching sentence and speaker boundaries", () => {
  const english = "A The trip was incredible. No\nphone service, just nature.\nSo you could relax, right? It sounds like the\nperfect escape.\nA It really was. I feel recharged. I'd go again.";
  const korean = "A 여행은 최고였어.휴대폰도 안 터졌어.\nB 쉴 수 있었겠다,그치?완벽한 탈출같네.\nA 정말 그랬어.재충전된 기분이야.또 가고 싶다.";
  const result = dialogueMessages(english, korean);
  assert.deepEqual(result.messages.map((m) => m.speaker), ["A", "B", "A"]);
  assert.equal(result.messages[1]!.text, "So you could relax, right? It sounds like the perfect escape.");
  assert.equal(result.separateTranslation, null);
  assert.equal(dialogueMessages(english, korean.replace("정말 그랬어.", "")).separateTranslation, korean.replace("정말 그랬어.", ""));
  assert.equal(dialogueMessages(english, korean.replace("B 쉴", "A 쉴").replace("A 여행", "B 여행")).messages.length, 2);
});

test("unequal sentence counts retain the complete bilingual turn", () => {
  const result = dialogueMessages("A Can you help? Call me at six.", "A 여섯 시에 전화해 줄 수 있어?");
  assert.equal(result.messages[0]!.text, "Can you help? Call me at six.");
  assert.equal(result.messages[0]!.translation, "여섯 시에 전화해 줄 수 있어?");
});

test("meaning paragraphs preserve Korean explanations and quoted expressions", () => {
  const source =
    "예로부터 찬사를 노래로 표현해 왔다.'sing one's praises'는 칭찬한다는 뜻이다.참고로 다른 표현도 알아 두자.";
  const result = meaningParagraphs(source);
  assert.equal(result.length, 3);
  assert.equal(result.join("").replace(/\s/g, ""), source.replace(/\s/g, ""));
  assert(result[1]!.includes("sing one's praises"));
  assert.deepEqual(meaningParagraphs(null), []);
});
test("meaning formatting retains decimal values, abbreviations and quotation text", () => {
  const source = "Dr. Kim paid 3.14 dollars.\n\n그는 '알겠어요.'라고 말했다.";
  const result = meaningParagraphs(source);
  assert.equal(result[0], "Dr. Kim paid 3.14 dollars.");
  assert(result.some((p) => p.includes("'알겠어요.'라고")));
  assert.equal(result.join("").replace(/\s/g, ""), source.replace(/\s/g, ""));
});
test("A and B remain characters, with continuation lines kept in their turns", () => {
  assert.deepEqual(
    dialogueTurns("A: Hello.\nStill speaking.\nB Hi.\nA I'm back.").turns,
    [
      { speaker: "A", text: "Hello.\nStill speaking." },
      { speaker: "B", text: "Hi." },
      { speaker: "A", text: "I'm back." },
    ],
  );
});
test("Korean translations align by both turn count and character", () => {
  const result = dialogueMessages(
    "A Hello\nB Hi\nA Really?",
    "A 안녕\nB 반가워\nA진짜?",
  );
  assert.deepEqual(
    result.messages.map((m) => [m.speaker, m.isMine, m.translation]),
    [
      ["A", false, "안녕"],
      ["B", true, "반가워"],
      ["A", false, "진짜?"],
    ],
  );
  assert.equal(result.separateTranslation, null);
  const mismatch = dialogueMessages("A Hello\nB Hi", "B 안녕\nA 반가워");
  assert(mismatch.messages.every((m) => m.translation === null));
  assert.equal(mismatch.separateTranslation, "B 안녕\nA 반가워");
});
test("unlabelled text and unsupported characters stay readable without invented assignments", () => {
  assert.equal(dialogueTurns("An unlabelled conversation.").turns.length, 0);
  const source = "A Hello\nC: A third character";
  assert.deepEqual(dialogueTurns(source), { intro: source, turns: [] });
  assert.deepEqual(dialogueTurns(null), { intro: "", turns: [] });
});

test("speaker label variants preserve negative numbers in spoken text", () => {
  assert.deepEqual(
    dialogueTurns("A -10 degrees.\nB - Fine.\n[A] Okay.\nB\nOne more line.")
      .turns,
    [
      { speaker: "A", text: "-10 degrees." },
      { speaker: "B", text: "Fine." },
      { speaker: "A", text: "Okay." },
      { speaker: "B", text: "One more line." },
    ],
  );
});

test("expression emphasis preserves spelling and handles case and apostrophe variants", () => {
  const text = "'sing one's praises'와 SING ONE’S PRAISES를 쓴다.";
  const parts = expressionParts(text, "sing one's praises");
  assert.deepEqual(
    parts.filter((p) => p.emphasized).map((p) => p.text),
    ["sing one's praises", "SING ONE’S PRAISES"],
  );
  assert.equal(parts.map((p) => p.text).join(""), text);
});
test("expression emphasis treats regex punctuation literally and avoids word fragments", () => {
  assert.equal(
    expressionParts("C++ and C++.", "C++").filter((p) => p.emphasized).length,
    2,
  );
  assert.deepEqual(
    expressionParts("conversation on ongoing", "on")
      .filter((p) => p.emphasized)
      .map((p) => p.text),
    ["on"],
  );
  assert.deepEqual(expressionParts("Original text", null), [
    { text: "Original text", emphasized: false },
  ]);
});
