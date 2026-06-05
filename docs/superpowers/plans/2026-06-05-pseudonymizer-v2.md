# Pseudonymizer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace jieba nr-tag-based person name detection with a dedicated `NameDetector` that scans raw text using surname dictionaries, context patterns, and configurable scoring.

**Architecture:** `NameDetector` is a pure function `detectNames(text: string): DetectedEntity[]` with three internal stages (preprocess → candidate generation → scoring → filtering). Dictionary data lives in separate `nameData.ts`. `pseudonymizer.ts` combines NameDetector output with jieba's ns/nt entities. `resolve/route.ts` uses NameDetector directly.

**Tech Stack:** TypeScript, @node-rs/jieba (for ns/nt only, NOT nr)

---

## File Structure

| File | Operation | Responsibility |
|---|---|---|
| `src/lib/nameData.ts` | Create | All static dictionaries: surnames, titles, name chars, exclusions, nicknames |
| `src/lib/nameDetector.ts` | Create | Core engine: preprocess → candidates → score → filter |
| `src/lib/pseudonymizer.ts` | Modify | `extractEntities()`: replace nr detection with NameDetector, keep ns/nt from jieba |
| `src/app/api/persons/resolve/route.ts` | Modify | `extractNames()`: replace with NameDetector call |
| `src/test/nameDetector.test.ts` | Create | 30+ test cases covering all spec scenarios |

---

### Task 1: Create nameData.ts — static dictionaries

**Files:**
- Create: `src/lib/nameData.ts`

- [ ] **Step 1: Create the data file**

```typescript
// src/lib/nameData.ts
// Static dictionaries for the NameDetector.
// Separated from logic so data can be maintained independently.

/** ~500 Chinese surnames, including compound surnames */
export const CHINESE_SURNAMES: ReadonlySet<string> = new Set([
  // Top 100 single-char surnames (covers ~87% of Chinese population)
  "王","李","张","刘","陈","杨","黄","赵","周","吴",
  "徐","孙","马","胡","朱","郭","何","罗","高","林",
  "郑","梁","谢","宋","唐","许","邓","韩","冯","曹",
  "彭","曾","肖","田","董","潘","袁","蔡","蒋","余",
  "于","杜","叶","程","魏","苏","吕","丁","任","卢",
  "姚","沈","钟","姜","崔","谭","陆","汪","范","金",
  "石","廖","贾","夏","韦","付","方","白","邹","孟",
  "熊","秦","邱","江","尹","薛","闫","段","雷","侯",
  "龙","史","陶","黎","贺","顾","毛","郝","龚","邵",
  "万","钱","严","覃","武","戴","莫","孔","向","汤",
  // Extended 100-200
  "温","段","康","施","陶","洪","翟","安","颜","倪",
  "严","牛","温","芦","季","俞","章","鲁","葛","伍",
  "韦","申","尤","毕","聂","丛","焦","向","柳","邢",
  "骆","岳","齐","尚","梅","莫","庄","辛","管","祝",
  "左","涂","谷","祁","时","舒","耿","牟","卜","路",
  "詹","关","苗","凌","费","纪","靳","盛","童","欧",
  "甄","项","曲","成","游","阳","裴","席","卫","查",
  "屈","鲍","覃","霍","翁","隋","植","甘","景","薄",
  "单","包","司","柏","宁","柯","阮","桂","闵","欧阳",
  // Compound surnames
  "欧阳","司马","上官","诸葛","令狐","慕容","公孙","尉迟",
  "长孙","宇文","鲜于","司徒","司空","夏侯","端木","东方",
  "皇甫","申屠","闾丘","濮阳","公羊","万俟","赫连","太史",
  "宗政","乐正","壤驷","公良","夹谷","宰父","谷梁","拓跋",
  "轩猿","南门","东门","西门","北门","第五",
]);

/** Common Chinese titles that follow surnames */
export const CHINESE_TITLES: ReadonlySet<string> = new Set([
  "总","老师","教授","工","经理","主任","博士",
  "先生","女士","小姐","同志","局长","处长","科长",
  "部长","校长","院长","律师","医生","会计",
  "工程师","设计师","编辑","导演","老板","师傅",
  "董","书记","政委","司令","将军",
]);

/** Common given-name characters. Higher frequency = more likely to be part of a name. */
export const GIVEN_NAME_CHARS: ReadonlyMap<string, number> = new Map([
  // Very common in given names (score 1.0)
  ["明",1.0],["文",1.0],["华",1.0],["伟",1.0],["强",1.0],
  ["磊",1.0],["军",1.0],["洋",1.0],["勇",1.0],["涛",1.0],
  ["杰",1.0],["峰",1.0],["超",1.0],["鹏",1.0],["飞",1.0],
  // Common (score 0.8)
  ["宇",0.8],["浩",0.8],["然",0.8],["博",0.8],["豪",0.8],
  ["晨",0.8],["曦",0.8],["悦",0.8],["萱",0.8],["怡",0.8],
  ["瑶",0.8],["睿",0.8],["昊",0.8],["哲",0.8],["毅",0.8],
  ["琳",0.8],["鑫",0.8],["凯",0.8],["瑞",0.8],["龙",0.8],
  // Less common but plausible (score 0.5)
  ["宁",0.5],["静",0.5],["雪",0.5],["梅",0.5],["兰",0.5],
  ["芳",0.5],["丽",0.5],["敏",0.5],["洁",0.5],["晶",0.5],
  ["亮",0.5],["刚",0.5],["平",0.5],["志",0.5],["国",0.5],
  ["建",0.5],["成",0.5],["宏",0.5],["海",0.5],["春",0.5],
  ["秀",0.5],["英",0.5],["荣",0.5],["德",0.5],["仁",0.5],
  // Very rare in given names (score 0.1 — penalty)
  ["的",0.1],["了",0.1],["在",0.1],["是",0.1],["我",0.1],
  ["不",0.1],["人",0.1],["们",0.1],["这",0.1],["有",0.1],
  ["和",0.1],["就",0.1],["都",0.1],["要",0.1],["会",0.1],
  ["可",0.1],["对",0.1],["去",0.1],["能",0.1],["做",0.1],
]);

/** Nickname characters — AA重叠式 first char candidates */
export const NICKNAME_CHARS: ReadonlySet<string> = new Set([
  "玲","欢","豆","婷","伟","超","飞","龙","明","亮",
  "静","雪","瑶","睿","鑫","洋","涛","鹏","晨","曦",
  "悦","萱","怡","琳","豪","然","博","宇","浩","哲",
]);

/** Known non-person entities that should not be pseudonymized */
export const KNOWN_NON_PERSON: ReadonlySet<string> = new Set([
  "星巴克","麦当劳","肯德基",
  "区块链","人工智能","机器学习","深度学习","神经网络",
  "互联网","物联网","大数据","云计算",
]);

/** English function words / common words that are not person names */
export const ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set([
  "the","a","an","is","are","was","were","be","been",
  "in","on","at","to","for","of","with","by","from",
  "and","or","but","not","this","that","it","we","he","she","they",
  "hi","hey","ok","okay","yes","no","thanks","please",
]);

/** Programming languages / tech terms in Chinese contexts — not names */
export const ENGLISH_TECH_TERMS: ReadonlySet<string> = new Set([
  "React","Python","Java","JavaScript","TypeScript","Node","Vue",
  "Angular","Docker","Kubernetes","Linux","Windows","Mac","iOS",
  "Android","Git","GitHub","SQL","MySQL","PostgreSQL","Redis",
]);

/** Common English titles/honorifics before names */
export const ENGLISH_TITLE_PREFIXES = /^(Dr|Mr|Ms|Mrs|Prof|Sir|Madam)\.?\s/i;

/** Minimum score threshold for accepting a candidate as a person entity */
export const PERSON_SCORE_THRESHOLD = 0.5;

/** Scoring weights for each dimension */
export const SCORE_WEIGHTS = {
  nameStructure: 0.45,  // surname + given name plausibility
  prefix: 0.15,         // 老/小/阿/大
  suffix: 0.25,         // title
  context: 0.15,        // position in sentence
};
```

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/nameData.ts
git commit -m "feat(nameDetector): add static dictionaries — surnames, titles, name chars, exclusions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Create nameDetector.ts — Stage 0 preprocessor + Stage 1 Chinese candidates

**Files:**
- Create: `src/lib/nameDetector.ts`

- [ ] **Step 1: Create file with preprocessor and Chinese candidate generator**

```typescript
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
  result = result.replace(/，/g, ",");   // ，
  result = result.replace(/、/g, ",");   // 、→,
  result = result.replace(/．/g, ".");   // ．
  result = result.replace(/。/g, ".");   // 。
  result = result.replace(/；/g, ";");   // ；
  result = result.replace(/！/g, "!");   // ！
  result = result.replace(/？/g, "?");   // ？
  result = result.replace(/　/g, " ");   // Full-width space
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

// ─── Stage 1a: Chinese name candidates ────────

interface Candidate {
  text: string;
  start: number;
  end: number;
  source: "surname_scan" | "prefix" | "suffix" | "nickname_aa" | "quoted" | "english";
}

/** Scan text for surname occurrences and generate candidate full names */
function scanSurnameCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (let pos = 0; pos < text.length; pos++) {
    // Try 2-char surname first (compound)
    for (const slen of [2, 1]) {
      if (pos + slen > text.length) continue;
      const maybeSurname = text.slice(pos, pos + slen);

      if (!CHINESE_SURNAMES.has(maybeSurname)) continue;

      // Found a surname. Look ahead 1-2 chars for given name.
      for (const glen of [1, 2]) {
        if (pos + slen + glen > text.length) break;

        const givenPart = text.slice(pos + slen, pos + slen + glen);
        // All chars in given name must be Chinese (no punctuation, digits, latin)
        if (![...givenPart].every(isChinese)) break;

        // Skip if given name part contains digits or punctuation
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
  // Chinese quotes: "" or ""
  const patterns = [
    /[""“]([一-鿿]{1,4})[""”]/g,
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
```

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/nameDetector.ts
git commit -m "feat(nameDetector): Stage 0 preprocessor + Stage 1 Chinese candidates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add Stage 1b — English name candidates

**Files:**
- Modify: `src/lib/nameDetector.ts`

- [ ] **Step 1: Add English name scanner**

Append to `nameDetector.ts`:

```typescript
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

    // Skip title prefixes, capture the name after
    const titleMatch = word.match(ENGLISH_TITLE_PREFIXES);

    // Check if this English word is followed by another English word (first+last)
    const nextPos = m.index! + word.length;
    const remaining = text.slice(nextPos);
    const nextWordMatch = remaining.match(/^\s+([A-Z][a-z]+)/);

    if (nextWordMatch && !ENGLISH_TECH_TERMS.has(nextWordMatch[1])) {
      // Merge: "Michael Chen"
      candidates.push({
        text: word + " " + nextWordMatch[1],
        start: m.index!,
        end: nextPos + nextWordMatch[0].length,
        source: "english",
      });
    } else {
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
```

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/nameDetector.ts
git commit -m "feat(nameDetector): Stage 1b — English name candidate scanner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Add Stage 2 — context scorer

**Files:**
- Modify: `src/lib/nameDetector.ts`

- [ ] **Step 1: Add scoring functions**

Append to `nameDetector.ts`:

```typescript
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
  if (c.source === "english") return 0.9; // English names get high default
  if (c.source === "prefix") return 0.7;   // 老王, 小王
  if (c.source === "suffix") return 0.75;  // 张总, 周教授
  if (c.source === "nickname_aa") return 0.5;
  if (c.source === "quoted") return 0.5;

  // surname_scan: score each char in the given name part
  const chars = [...c.text];
  const surnameLen = CHINESE_SURNAMES.has(chars.slice(0, 2).join("")) ? 2 : 1;
  const givenChars = chars.slice(surnameLen);

  if (givenChars.length === 0) return 0.3; // surname only

  let total = 0;
  for (const ch of givenChars) {
    total += GIVEN_NAME_CHARS.get(ch) ?? 0.3; // unknown chars get 0.3
  }
  return total / givenChars.length;
}

function scorePrefix(c: Candidate, text: string): number {
  if (c.source === "prefix") return 1.0;
  if (c.start === 0) return 0;

  const prev = text[c.start - 1];
  if (prev === "老" || prev === "小" || prev === "阿" || prev === "大") {
    return 0.5; // prefix is there but not captured in this candidate
  }
  return 0;
}

function scoreSuffix(c: Candidate, text: string): number {
  if (c.source === "suffix") return 1.0;
  if (c.end >= text.length) return 0;

  const after = text.slice(c.end);
  // Check if any title immediately follows
  for (const title of CHINESE_TITLES) {
    if (after.startsWith(title)) return 0.8;
  }
  return 0;
}

function scoreContext(c: Candidate, text: string): number {
  let score = 0.5; // neutral

  // Check if preceded by 在/去/到 (location context) → likely a place, not person
  if (c.start > 0) {
    const before = text[c.start - 1];
    if (before === "在" || before === "去" || before === "到" || before === "从") {
      score -= 0.3;
    }
  }

  // Check if preceded by 跟/和/与/同 (person context)
  if (c.start >= 2) {
    const before2 = text.slice(Math.max(0, c.start - 2), c.start);
    if (/[跟和与同见找问请叫派让]/.test(before2)) {
      score += 0.2;
    }
  }

  // Check if followed by verbs (person-as-subject context)
  if (c.end < text.length) {
    const after2 = text.slice(c.end, Math.min(text.length, c.end + 4));
    if (/[说说聊聊讲讲谈谈来去给发做搞弄想能会要].*/.test(after2)) {
      score += 0.15;
    }
  }

  // Check: is it at sentence start? (likely subject → person)
  if (c.start === 0 || (c.start >= 1 && /[.。!！?？]/.test(text[c.start - 1]))) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}
```

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/nameDetector.ts
git commit -m "feat(nameDetector): Stage 2 — context scorer with 4 dimensions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Add Stage 3 — filter/dedup + main entry point

**Files:**
- Modify: `src/lib/nameDetector.ts`

- [ ] **Step 1: Add filter/dedup and export detectNames**

Append to `nameDetector.ts`:

```typescript
// ─── Stage 3: Filter & Dedup ──────────────────

function filterAndDedup(scored: ScoredCandidate[]): DetectedEntity[] {
  // 1. Filter by threshold
  const aboveThreshold = scored.filter(c => c.score >= PERSON_SCORE_THRESHOLD);

  // 2. Sort by score descending (higher confidence first)
  aboveThreshold.sort((a, b) => b.score - a.score);

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
```

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/nameDetector.ts
git commit -m "feat(nameDetector): Stage 3 filter/dedup + detectNames public API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Integrate NameDetector into pseudonymizer.ts

**Files:**
- Modify: `src/lib/pseudonymizer.ts:26-145` (extractEntities function)

- [ ] **Step 1: Replace extractEntities**

Read the current `extractEntities` function. Replace its entire body. The new version uses `detectNames()` for persons and keeps jieba for `ns`/`nt`:

```typescript
import { detectNames, type DetectedEntity } from "./nameDetector";

/** Extract named entities from Chinese text.
 *  Person names: detected by NameDetector (custom scanner, no jieba nr).
 *  Places/orgs: detected by jieba ns/nt tags (these are reliable). */
function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // ── Person names: use NameDetector ──
  const personEntities = detectNames(text);
  for (const pe of personEntities) {
    entities.push({
      text: pe.text,
      type: "person",
      start: pe.start,
      end: pe.end,
    });
  }

  // ── Places and orgs: use jieba ns/nt (these are reliable) ──
  const jieba = getJieba();
  const tagged = jieba.tag(text) as Array<{ word: string; tag: string }>;
  let pos = 0;
  for (const item of tagged) {
    const start = text.indexOf(item.word, pos);
    const end = start + item.word.length;

    if (item.tag === "ns") {
      // Only add if it doesn't overlap with an existing person entity
      const overlaps = entities.some(e => start < e.end && end > e.start);
      if (!overlaps) {
        entities.push({ text: item.word, type: "place", start, end });
      }
    } else if (item.tag === "nt") {
      const overlaps = entities.some(e => start < e.end && end > e.start);
      if (!overlaps) {
        entities.push({ text: item.word, type: "org", start, end });
      }
    }
    pos = end;
  }

  // Sort by position
  entities.sort((a, b) => a.start - b.start);

  return entities;
}
```

Also remove the now-unused imports and constants at the top of the file:
- Remove `CHINESE_SURNAMES` (now in nameData.ts)
- Remove `KNOWN_NON_PERSON` (now in nameData.ts)
- Remove `CHINESE_TITLES` (now in nameData.ts)
- Remove the old `CHINESE_SURNAMES` set and `KNOWN_NON_PERSON` set and `CHINESE_TITLES` set

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pseudonymizer.ts
git commit -m "refactor(pseudonymizer): replace jieba nr with NameDetector, keep ns/nt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Integrate NameDetector into resolve/route.ts

**Files:**
- Modify: `src/app/api/persons/resolve/route.ts:12-41` (extractNames function)

- [ ] **Step 1: Replace extractNames**

Replace the entire `extractNames` function body. Also remove the now-duplicated `CHINESE_SURNAMES` and `KNOWN_NON_PERSON` constants at the top of the file:

```typescript
import { detectNames } from "@/lib/nameDetector";

/**
 * Extracts person names from Chinese text using NameDetector.
 * No regex guessing, no jieba nr — uses the same engine as pseudonymizer.
 */
function extractNames(text: string): string[] {
  try {
    const entities = detectNames(text);
    return [...new Set(entities.map(e => e.text))];
  } catch {
    return [];
  }
}
```

Remove the now-unused `CHINESE_SURNAMES` set and `KNOWN_NON_PERSON` set that were previously defined in this file.

- [ ] **Step 2: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/persons/resolve/route.ts
git commit -m "refactor(resolve): use NameDetector for extractNames instead of own jieba logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Create comprehensive test suite (Part 1 — Chinese names)

**Files:**
- Create: `src/test/nameDetector.test.ts`

- [ ] **Step 1: Create test file with Chinese name tests**

```typescript
// src/test/nameDetector.test.ts
// Comprehensive test suite for the NameDetector.
// Run: npx tsx --env-file=.env src/test/nameDetector.test.ts

import { detectNames } from "../lib/nameDetector";

function test(description: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${description}`); }
  catch (e) { console.log(`  ✗ ${description}\n    ${e}`); process.exitCode = 1; }
}

function assert(condition: boolean, msg?: string) {
  if (!condition) throw new Error(msg || "assertion failed");
}

function assertNames(text: string, expectedNames: string[], msg?: string) {
  const result = detectNames(text);
  const names = result.map(e => e.text);
  for (const expected of expectedNames) {
    assert(names.includes(expected), msg || `Expected "${expected}" in [${names.join(", ")}]`);
  }
}

function assertNoNames(text: string, msg?: string) {
  const result = detectNames(text);
  assert(result.length === 0, msg || `Expected no names, got [${result.map(e => e.text).join(", ")}]`);
}

// ═══════════════════════════════════════════════
console.log("=== Basic Chinese Names ===");
test("2-char name", () => assertNames("跟王磊在聊天", ["王磊"]));
test("3-char name", () => assertNames("和李明华开了会", ["李明华"]));
test("compound surname", () => assertNames("欧阳修的文章", ["欧阳修"]));
test("name in middle of sentence", () => assertNames("我今天见了一个叫王磊的人", ["王磊"]));
test("name at sentence start", () => assertNames("王磊今天来了", ["王磊"]));

console.log("\n=== Prefix Patterns ===");
test("老X pattern", () => assertNames("老周打了一个小时电话", ["老周"]));
test("小X pattern", () => assertNames("小王今天来了", ["小王"]));
test("阿X pattern", () => assertNames("阿强来做客", ["阿强"]));
test("大X pattern", () => assertNames("大刘请客", ["大刘"]));

console.log("\n=== Suffix / Title Patterns ===");
test("X总", () => assertNames("今天见了张总", ["张总"]));
test("X教授", () => assertNames("在清华大学见了周教授", ["周教授"]));
test("X老师", () => assertNames("李老师今天没来", ["李老师"]));
test("X工", () => assertNames("找王工确认一下", ["王工"]));
test("X经理", () => assertNames("刘经理在开会", ["刘经理"]));

console.log("\n=== Nickname Patterns ===");
test("AA nickname", () => assertNames("玲玲来了", ["玲玲"]));
test("quoted nickname 1", () => assertNames('人称"铁军"的王磊', ["铁军", "王磊"]));
test("quoted nickname 2", () => assertNames('大家都叫他"胖子"', ["胖子"]));

console.log("\n=== Non-names (should NOT be detected) ===");
test("vague reference", () => assertNoNames("今天见了一个做区块链的技术大佬"));
test("pronoun only", () => assertNoNames("跟他约了下周的咖啡"));
test("某人", () => assertNoNames("某人和我去了北京"));
test("brand — 星巴克", () => assertNoNames("跟王磊在星巴克聊天"));
test("tech term — 区块链", () => assertNoNames("他在做区块链"));
test("common word — 黎明", () => assertNoNames("天快黎明了"));
test("common word — 高峰", () => assertNoNames("现在是下班高峰"));
```

- [ ] **Step 2: Run tests (will fail for unimplemented edge cases)**

```bash
cd d:/Epstein.AI && npx tsx --env-file=.env src/test/nameDetector.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/test/nameDetector.test.ts
git commit -m "test(nameDetector): Chinese name test suite — basic, prefix, suffix, nickname, non-names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Extend test suite (Part 2 — English names, separators, edge cases)

**Files:**
- Modify: `src/test/nameDetector.test.ts`

- [ ] **Step 1: Add English name, separator, and edge case tests**

Append to the test file:

```typescript
console.log("\n=== English Names ===");
test("single English name", () => assertNames("今天跟John聊了项目", ["John"]));
test("English first+last (Michael Chen)", () => assertNames("Michael Chen来公司了", ["Michael Chen"]));
test("two English names", () => assertNames("见了Sarah和Tom", ["Sarah", "Tom"]));
test("English+Chinese mixed", () => assertNames("跟James还有李总吃饭", ["James", "李总"]));
test("English name with period (J.P.)", () => assertNames("J.P. Morgan来了", ["J.P. Morgan"]));
test("English with apostrophe", () => assertNames("O'Brien今天来", ["O'Brien"]));
test("Dr. prefix", () => assertNames("Dr. Smith is here", ["Smith"]));

console.log("\n=== English Non-names ===");
test("all-caps (AI)", () => assertNoNames("他在做AI创业"));
test("tech term (React)", () => assertNoNames("他喜欢用React"));
test("common English word (the)", () => assertNoNames("the project is done"));

console.log("\n=== Separators ===");
test("comma separated names", () => assertNames("王磊,张三,李四", ["王磊", "张三", "李四"]));
test("Chinese comma (，)", () => assertNames("王磊，张三", ["王磊", "张三"]));
test("enumeration comma (、)", () => assertNames("王磊、张三", ["王磊", "张三"]));
test("和 conjunction", () => assertNames("王磊和张三一起", ["王磊", "张三"]));
test("跟 conjunction", () => assertNames("跟王磊聊了聊", ["王磊"]));
test("newline in name", () => assertNames("王\n磊今天来了", ["王磊"]));

console.log("\n=== Edge Cases ===");
test("parentheses excluded", () => assertNames("王磊(微信:wanglei001)", ["王磊"]));
test("@ stripped", () => assertNames("@王磊 今天见到你了", ["王磊"]));
test("phone number not name", () => assertNames("王磊 13800138000", ["王磊"]));
test("name with double quotes", () => assertNames('"王磊"是个人才', ["王磊"]));
test("full-width punctuation mixed", () => assertNames("王磊，张三、李四", ["王磊", "张三", "李四"]));
test("mixed full/half-width", () => assertNames("王磊, 张三，李四、John", ["王磊", "张三", "李四", "John"]));
test("sentence boundary preserved", () => assertNames("见了王磊。张三没来", ["王磊", "张三"]));

console.log("\n=== Real-world Scenarios ===");
test("scenario: dinner meeting", () => assertNames(
  "晚上跟张总还有他的CTO一起吃饭，聊到他们公司最近在融B轮",
  ["张总"]
));
test("scenario: blockchain guy", () => assertNames(
  "我今天见了一个做区块链的技术大佬，跟他约了下周的咖啡",
  []
));
test("scenario: AI entrepreneur", () => assertNames(
  "今天跟王磊在星巴克聊了AI创业，他想拉我一起做一个企业级RAG产品，约了下周三给他发BP。",
  ["王磊"]
));
test("scenario: old Zhou call", () => assertNames(
  "跟老周打了一个小时电话，他在看一个医疗SaaS的标的",
  ["老周"]
));
```

- [ ] **Step 2: Run full test suite**

```bash
cd d:/Epstein.AI && npx tsx --env-file=.env src/test/nameDetector.test.ts
```

Fix any failing tests by adjusting scoring weights or candidate generation logic.

- [ ] **Step 3: Commit**

```bash
git add src/test/nameDetector.test.ts
git commit -m "test(nameDetector): English names, separators, edge cases, real-world scenarios

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Build and final verification

- [ ] **Step 1: Typecheck**

```bash
cd d:/Epstein.AI && npx tsc --noEmit --pretty 2>&1
```
Expected: zero errors.

- [ ] **Step 2: Build**

```bash
cd d:/Epstein.AI && taskkill //F //IM node.exe 2>/dev/null; sleep 1 && npm run build 2>&1 | tail -10
```
Expected: build successful.

- [ ] **Step 3: Start server and manual smoke test**

```bash
npm start
```

Test with curl:
```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text":"今天跟王磊在星巴克聊了AI创业，他想拉我一起做一个企业级RAG产品。"}'
```

Expected: SSE response with correctly pseudonymized "王磊" (not split into two single-char pseudonyms).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final verification — typecheck, build, manual smoke test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Implementation Order

```
Task 1 (nameData) → Task 2 (Stage 0+1a) → Task 3 (Stage 1b) → Task 4 (Stage 2)
                                                                      ↓
                                                              Task 5 (Stage 3 + API)
                                                                      ↓
                                        Task 6 (pseudonymizer) + Task 7 (resolve)
                                                                      ↓
                                              Task 8 (tests part 1) → Task 9 (tests part 2)
                                                                      ↓
                                                              Task 10 (final verification)
```

Tasks 1-5 are serial (building nameDetector incrementally). Tasks 6-7 can run in parallel after Task 5. Tasks 8-9 expand tests. Task 10 is the final gate.
