import type { RawItem, StoryType } from "../types";

const LETTER = /\b(letter to (shareholders|investors|clients|LPs|limited partners)|(shareholder|investor|annual|client) letter|memo)\b/i;
const QUOTED = /["“][^"”]{8,}["”]|‘[^’]{8,}’/;
const SPEECH_VERB = /\b(says|said|warns|argues|sees|expects|predicts|believes)\b/i;

/**
 * What kind of story this is, so readers know whether they're reading reporting, someone's own
 * words, a regulatory filing or a long-form letter. Checked in order; the first match wins.
 */
export function storyTypeOf(item: RawItem): StoryType {
  if (item.source.contentType === "filing") return "filing";
  if (item.source.id === "oaktree-memo" || LETTER.test(item.title)) return "letter";
  if (item.source.contentType === "podcast") return "podcast";
  if (item.source.id === "fed-speeches" || QUOTED.test(item.title) || SPEECH_VERB.test(item.title)) return "quote";
  return "news";
}
