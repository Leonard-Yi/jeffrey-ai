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
  // Newlines, tabs → strip (Chinese names can span line breaks)
  result = result.replace(/[\n\r\t]/g, "");
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
      // Require surname or high-score given-name char (rejects 大家, 大佬, etc.)
      if (isChinese(next) && (CHINESE_SURNAMES.has(next) || (GIVEN_NAME_CHARS.get(next) ?? 0) >= 0.5)) {
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
  // Chinese quotes, corner brackets, ASCII double/single quotes
  const patterns = [
    /[“「]([一-鿿]{1,4})[”」]/g,   // U+201C left + U+201D right double quotes + corner brackets
    /[“]([一-鿿]{1,4})[”]/g,
    /\x22([一-鿿]{1,4})\x22/g,               // ASCII double quote U+0022
    /\x27([一-鿿]{1,4})\x27/g,               // ASCII single quote U+0027
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

// ─── Stage 1b: English name candidates ────────

/** Scan for English/Latin name patterns */
function scanEnglishCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  // Pattern: capitalized Latin word (possibly with internal . or - or ')
  const wordRe = /[A-Z][a-z]*\.?(?:[-\x27][A-Z][a-z]*)?/g;

  for (const m of text.matchAll(wordRe)) {
    const word = m[0];

    // Skip single letters (except when part of initials like "J.")
    if (word.length === 1) continue;

    // Skip all-caps tech terms
    if (/^[A-Z]{2,}$/.test(word)) continue;
    if (ENGLISH_TECH_TERMS.has(word)) continue;
    if (ENGLISH_STOP_WORDS.has(word.toLowerCase())) continue;

    // Check if this English word is followed by another English word (first+last)
    const nextPos = m.index! + word.length;
    const remaining = text.slice(nextPos);
    const nextWordMatch = remaining.match(/^\s+([A-Z][a-z]+)/);

    if (nextWordMatch && !ENGLISH_TECH_TERMS.has(nextWordMatch[1])) {
      // Check if first word is a title prefix (Dr., Mr., etc.)
      const isTitle = /^(Dr|Mr|Ms|Mrs|Prof|Sir|Madam)\.?$/i.test(word);
      const actualName = isTitle ? nextWordMatch[1] : word + " " + nextWordMatch[1];
      const actualStart = isTitle ? nextPos + (nextWordMatch[0].length - nextWordMatch[1].length) : m.index!;
      candidates.push({
        text: actualName,
        start: actualStart,
        end: nextPos + nextWordMatch[0].length,
        source: "english",
      });
    } else {
      // Skip standalone English title words (Dr., Mr., etc. without a following name)
      if (/^(Dr|Mr|Ms|Mrs|Prof|Sir|Madam)\.?$/i.test(word)) continue;
      // Just the single English name
      candidates.push({
        text: word,
        start: m.index!,
        end: nextPos,
        source: "english",
      });
    }
  }

  return candidates;
}

// ─── Stage 2: Context Scoring ─────────────────

interface ScoredCandidate extends Candidate {
  score: number;
  dimensions: {
    nameStructure: number;
    prefix: number;
    suffix: number;
    context: number;
  };
}

function scoreCandidates(raw: Candidate[], originalText: string): ScoredCandidate[] {
  return raw.map(c => scoreOne(c, originalText));
}

function scoreOne(c: Candidate, text: string): ScoredCandidate {
  const dims = {
    nameStructure: scoreNameStructure(c),
    prefix: scorePrefix(c, text),
    suffix: scoreSuffix(c, text),
    context: scoreContext(c, text),
  };

  const score =
    dims.nameStructure * SCORE_WEIGHTS.nameStructure +
    dims.prefix * SCORE_WEIGHTS.prefix +
    dims.suffix * SCORE_WEIGHTS.suffix +
    dims.context * SCORE_WEIGHTS.context;

  return { ...c, score, dimensions: dims };
}

function scoreNameStructure(c: Candidate): number {
  if (c.source === "english") return 0.95;
  if (c.source === "prefix") return 0.7;
  if (c.source === "suffix") return 0.75;
  if (c.source === "nickname_aa") return 0.8;
  if (c.source === "quoted") return 0.8;

  // surname_scan: score each char in the given name part
  const chars = [...c.text];
  const surnameLen = CHINESE_SURNAMES.has(chars.slice(0, 2).join("")) ? 2 : 1;
  const givenChars = chars.slice(surnameLen);

  if (givenChars.length === 0) return 0.3;

  let total = 0;
  for (const ch of givenChars) {
    total += GIVEN_NAME_CHARS.get(ch) ?? 0.3;
  }
  return total / givenChars.length;
}

function scorePrefix(c: Candidate, text: string): number {
  if (c.source === "prefix") return 1.0;
  if (c.start === 0) return 0;

  const prev = text[c.start - 1];
  if (prev === "老" || prev === "小" || prev === "阿" || prev === "大") {
    return 0.5;
  }
  return 0;
}

function scoreSuffix(c: Candidate, text: string): number {
  if (c.source === "suffix") return 1.0;
  if (c.end >= text.length) return 0;

  const after = text.slice(c.end);
  for (const title of CHINESE_TITLES) {
    if (after.startsWith(title)) return 0.8;
  }
  return 0;
}

function scoreContext(c: Candidate, text: string): number {
  let score = 0.5;

  // Check if preceded by 在/去/到/从 (location context) → likely a place
  if (c.start > 0) {
    const before = text[c.start - 1];
    if (before === "在" || before === "去" || before === "到" || before === "从") {
      score -= 0.3;
    }
  }

  // Check if preceded by 跟/和/与/同/见/找/问/请/叫/派/让/称 (person context)
  if (c.start >= 1) {
    const before3 = text.slice(Math.max(0, c.start - 3), c.start);
    if (/[跟和与同见找问请叫派让称]/.test(before3)) {
      score += 0.2;
    }
  }

  // Check if followed by verbs (person-as-subject context)
  if (c.end < text.length) {
    const after2 = text.slice(c.end, Math.min(text.length, c.end + 4));
    if (/[说说聊聊讲讲谈谈来去给发做搞弄想能会要]/.test(after2)) {
      score += 0.15;
    }
  }

  // Check: is it at sentence start? (likely subject → person)
  if (c.start === 0 || (c.start >= 1 && /[.。!！?？]/.test(text[c.start - 1]))) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

// ─── Stage 3: Filter & Dedup ──────────────────

function filterAndDedup(scored: ScoredCandidate[]): DetectedEntity[] {
  // 1. Filter by threshold
  const aboveThreshold = scored.filter(c => c.score >= PERSON_SCORE_THRESHOLD);

  // 2. Sort by score descending, then by length descending (longer = more specific)
  aboveThreshold.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.text.length - a.text.length;
  });

  // 3. Remove overlapping entities, keeping higher-scored one
  const result: DetectedEntity[] = [];
  for (const c of aboveThreshold) {
    const overlaps = result.some(existing =>
      (c.start >= existing.start && c.start < existing.end) ||
      (c.end > existing.start && c.end <= existing.end) ||
      (c.start <= existing.start && c.end >= existing.end)
    );
    if (!overlaps) {
      result.push({
        text: c.text,
        type: "person",
        start: c.start,
        end: c.end,
        score: c.score,
      });
    }
  }

  // 4. Sort by position in text
  result.sort((a, b) => a.start - b.start);

  return result;
}

// ─── Public API ───────────────────────────────

/**
 * Detect person names in text.
 * Does NOT use jieba nr tags — scans raw text using surname dictionaries
 * and context patterns. English names detected via regex.
 *
 * @returns DetectedEntity[] sorted by position in text
 */
export function detectNames(text: string): DetectedEntity[] {
  const normalized = preprocess(text);

  // Stage 1: Generate all candidates
  const candidates: Candidate[] = [
    ...scanSurnameCandidates(normalized),
    ...scanPrefixCandidates(normalized),
    ...scanSuffixCandidates(normalized),
    ...scanNicknameAACandidates(normalized),
    ...scanQuotedCandidates(normalized),
    ...scanEnglishCandidates(normalized),
  ];

  // Stage 2: Score each candidate
  const scored = scoreCandidates(candidates, normalized);

  // Stage 3: Filter and deduplicate
  return filterAndDedup(scored);
}
