import { test } from "node:test";
import assert from "node:assert/strict";
import { vocabularyItems } from "../src/services/vocabulary.ts";

test("splits the scraper's slash-separated English/Korean glossary", () => {
  assert.deepEqual(
    vocabularyItems("lower back 허리/work 효과가 있다/skeptical 의구심 이드는"),
    ["lower back 허리", "work 효과가 있다", "skeptical 의구심 이드는"],
  );
});
test("normalizes line breaks and existing list markers without empty entries", () => {
  assert.deepEqual(
    vocabularyItems(
      "• first 첫째\r\n\n- second 둘째\n3. third 셋째 • fourth 넷째",
    ),
    ["first 첫째", "second 둘째", "third 셋째", "fourth 넷째"],
  );
});
test("preserves lexical slashes, URLs, commas and hyphenated terms", () => {
  assert.deepEqual(
    vocabularyItems(
      "and/or 그리고/또는\nn/a 해당 없음\n24/7 항상\nhttps://example.com/a/b\nwell-known 잘 알려진, 유명한",
    ),
    [
      "and/or 그리고/또는",
      "n/a 해당 없음",
      "24/7 항상",
      "https://example.com/a/b",
      "well-known 잘 알려진, 유명한",
    ],
  );
});
test("missing and whitespace-only glossaries are empty", () => {
  assert.deepEqual(vocabularyItems(null), []);
  assert.deepEqual(vocabularyItems(" \n\r\n "), []);
});
