// src/lib/nameDetector.ts
// Custom Chinese + English person name detector.
// Does NOT use jieba nr tags — scans raw text directly.

import {
  CHINESE_SURNAMES, CHINESE_TITLES, GIVEN_NAME_CHARS,
  NICKNAME_CHARS, KNOWN_NON_PERSON,
  ENGLISH_STOP_WORDS, ENGLISH_TECH_TERMS, ENGLISH_TITLE_PREFIXES,
  PERSON_SCORE_THRESHOLD, SCORE_WEIGHTS,
} from "./nameData";

export interface DetectedEntity {
  text: string;
  type: "person";
  start: number;
  end: number;
  score: number;
}

// ─── Stage 0: Preprocessing ───────────────────

/** Normalize text: full-width → half-width, collapse whitespace */
function preprocess(text: string): string {
  let result = text;
  // Newlines, tabs → space
  result = result.replace(/[\n\r\t]/g, " ");
  // Full-width punctuation → half-width
  result = result.replace(/，/g, ",");
  result = result.replace(/、/g, ",");
  result = result.replace(/．/g, ".");
  result = result.replace(/。/g, ".");
  result = result.replace(/；/g, ";");
  result = result.replace(/！/g, "!");
  result = result.replace(/？/g, "?");
  result = result.replace(/　/g, " ");  // Full-width space U+3000
  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, " ");
  return result;
}

/** Character type classifier */
function isChinese(c: string): boolean {
  return /^[一-鿿]$/.test(c);
}
function isLatin(c: string): boolean {
  return /^[A-Za-z]$/.test(c);
}
function isDigit(c: string): boolean {
  return /^[0-9]$/.test(c);
}

// ─── Stage 1: Candidate generation ────────────

export interface Candidate {
  text: string;
  start: number;
  end: number;
  source: "surname_scan" | "prefix" | "suffix" | "nickname_aa" | "quoted" | "english";
}

/** Scan text for surname occurrences and generate candidate full names */
function scanSurnameCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (let pos = 0; pos < text.length; pos++) {
    // Try 2-char surname first (compound), then 1-char
    for (const slen of [2, 1]) {
      if (pos + slen > text.length) continue;
      const maybeSurname = text.slice(pos, pos + slen);

      if (!CHINESE_SURNAMES.has(maybeSurname)) continue;

      // Found a surname. Look ahead 1-2 chars for given name.
      for (const glen of [1, 2]) {
        if (pos + slen + glen > text.length) break;

        const givenPart = text.slice(pos + slen, pos + slen + glen);
        // All chars in given name must be Chinese
        if (![...givenPart].every(isChinese)) break;
        // Skip if given name part contains digits
        if ([...givenPart].some(c => !isChinese(c) || isDigit(c))) break;

        const fullName = maybeSurname + givenPart;
        const end = pos + slen + glen;

        // Check: not in KNOWN_NON_PERSON
        if (KNOWN_NON_PERSON.has(fullName)) continue;

        // Check: don't cross hard separators
        const segment = text.slice(pos, end);
        if (/[,.;!?""()（）【】《》「」]/.test(segment)) continue;

        candidates.push({
          text: fullName, start: pos, end,
          source: "surname_scan",
        });
      }
      // Only try the first matching length at each position
      if (CHINESE_SURNAMES.has(maybeSurname)) break;
    }
  }

  return candidates;
}

/** Detect 老X / 小X / 阿X / 大X prefix patterns */
function scanPrefixCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  const prefixes = ["老", "小", "阿", "大"];

  for (let pos = 0; pos < text.length - 1; pos++) {
    if (prefixes.includes(text[pos])) {
      const next = text[pos + 1];
      if (isChinese(next) && CHINESE_SURNAMES.has(next)) {
        candidates.push({
          text: text[pos] + next, start: pos, end: pos + 2,
          source: "prefix",
        });
      }
    }
  }

  return candidates;
}

/** Detect X+title patterns (张总, 周教授, 李老师) */
function scanSuffixCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (let pos = 0; pos < text.length - 1; pos++) {
    if (!isChinese(text[pos])) continue;
    if (!CHINESE_SURNAMES.has(text[pos])) continue;

    // Check next 1-2 chars for a title
    for (const tlen of [2, 1]) {
      const maybeTitle = text.slice(pos + 1, pos + 1 + tlen);
      if (CHINESE_TITLES.has(maybeTitle)) {
        candidates.push({
          text: text[pos] + maybeTitle,
          start: pos, end: pos + 1 + tlen,
          source: "suffix",
        });
        break;
      }
    }
  }

  return candidates;
}

/** Detect AA overlapping nickname pattern (玲玲, 欢欢, 豆豆) */
function scanNicknameAACandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (let pos = 0; pos < text.length - 1; pos++) {
    const c = text[pos];
    if (isChinese(c) && NICKNAME_CHARS.has(c) && text[pos + 1] === c) {
      candidates.push({
        text: c + c, start: pos, end: pos + 2,
        source: "nickname_aa",
      });
    }
  }

  return candidates;
}

/** Detect quoted nicknames (人称"铁军", 叫他"胖子") */
function scanQuotedCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  // Chinese quotes: “” or 「」
  const patterns = [
    /[“「]([一-鿿]{1,4})[”」]/g,
    /["]([一-鿿]{1,4})["]/g,
  ];

  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (name && name.length >= 1 && name.length <= 4) {
        candidates.push({
          text: name,
          start: m.index! + 1,
          end: m.index! + 1 + name.length,
          source: "quoted",
        });
      }
    }
  }

  return candidates;
}
