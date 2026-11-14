import { test } from "node:test";
import assert from "node:assert/strict";
import {
  meaningParagraphs,
  dialogueTurns,
  dialogueMessages,
} from "../src/services/lessonText.ts";

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
