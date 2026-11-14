/** Turn the scraper's plain glossary into list items without guessing word meanings. */
export function vocabularyItems(text: string | null): string[] {
  return (
    (text || "")
      // English glossary entries commonly arrive as “word 뜻/next word 뜻”.
      // Preserve lexical slashes such as and/or and URLs.
      .replace(/([가-힣][.!?…)\]”’"']*)\s*\/\s*(?=[A-Za-z])/g, "$1\n")
      .replace(/\s+\/\s+/g, "\n")
      .replace(/[•●▪]|\s+·\s+/g, "\n")
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/^(?:[-*]\s+|\d+[.)]\s+)/, ""))
      .filter(Boolean)
  );
}
