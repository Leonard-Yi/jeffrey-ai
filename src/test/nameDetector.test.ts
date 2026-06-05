// src/test/nameDetector.test.ts
// Comprehensive test suite for the NameDetector.
// Run: npx tsx src/test/nameDetector.test.ts

import { detectNames } from "../lib/nameDetector";

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${description}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${description}\n    ${e.message}`); process.exitCode = 1; }
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

function assertExactNames(text: string, expectedNames: string[], msg?: string) {
  const result = detectNames(text);
  const names = result.map(e => e.text);
  assert(
    names.length === expectedNames.length && expectedNames.every(n => names.includes(n)),
    msg || `Expected exactly [${expectedNames.join(", ")}], got [${names.join(", ")}]`
  );
}

// ═══════════════════════════════════════════════
console.log("=== Basic Chinese Names ===");
test("2-char name (王磊)", () => assertNames("跟王磊在聊天", ["王磊"]));
test("3-char name (李明华)", () => assertNames("和李明华开了会", ["李明华"]));
test("compound surname (欧阳修)", () => assertNames("欧阳修的文章", ["欧阳修"]));
test("name in middle of sentence", () => assertNames("我今天见了一个叫王磊的人", ["王磊"]));
test("name at sentence start", () => assertNames("王磊今天来了", ["王磊"]));
test("2-char name (张三)", () => assertNames("张三来上班了", ["张三"]));

console.log("\n=== Prefix Patterns ===");
test("老X pattern (老周)", () => assertNames("老周打了一个小时电话", ["老周"]));
test("小X pattern (小王)", () => assertNames("小王今天来了", ["小王"]));
test("阿X pattern (阿强)", () => assertNames("阿强来做客", ["阿强"]));
test("大X pattern (大刘)", () => assertNames("大刘请客", ["大刘"]));

console.log("\n=== Suffix / Title Patterns ===");
test("X总 (张总)", () => assertNames("今天见了张总", ["张总"]));
test("X教授 (周教授)", () => assertNames("在清华大学见了周教授", ["周教授"]));
test("X老师 (李老师)", () => assertNames("李老师今天没来", ["李老师"]));
test("X工 (王工)", () => assertNames("找王工确认一下", ["王工"]));
test("X经理 (刘经理)", () => assertNames("刘经理在开会", ["刘经理"]));
test("X博士 (陈博士)", () => assertNames("陈博士发表了论文", ["陈博士"]));

console.log("\n=== Nickname Patterns ===");
test("AA nickname (玲玲)", () => assertNames("玲玲来了", ["玲玲"]));
test("AA nickname (欢欢)", () => assertNames("欢欢今天很开心", ["欢欢"]));
test("quoted nickname (\"铁军\")", () => assertNames('人称"铁军"的王磊', ["铁军", "王磊"]));
test("quoted nickname (「胖子」)", () => assertNames("大家都叫他「胖子」", ["胖子"]));

console.log("\n=== Non-names (should NOT be detected) ===");
test("vague reference", () => assertNoNames("今天见了一个做区块链的技术大佬"));
test("pronoun only", () => assertNoNames("跟他约了下周的咖啡"));
test("某人", () => assertNoNames("某人和我去了北京"));
test("brand — 星巴克", () => assertNoNames("在星巴克喝了杯咖啡"));
test("tech term — 区块链", () => assertNoNames("他在做区块链"));
test("dual word — 黎明 (dawn)", () => assertNoNames("天快黎明了"));
test("dual word — 高峰 (peak)", () => assertNoNames("现在是下班高峰"));
test("dual word — 方向 (direction)", () => assertNoNames("往这个方向走"));
test("all-caps (AI)", () => assertNoNames("他在做AI创业"));
test("tech term (React)", () => assertNoNames("他喜欢用React"));
test("common English word (the)", () => assertNoNames("the project is done"));

console.log("\n=== English Names ===");
test("single English name (John)", () => assertNames("今天跟John聊了项目", ["John"]));
test("English first+last (Michael Chen)", () => assertNames("Michael Chen来公司了", ["Michael Chen"]));
test("two English names", () => assertNames("见了Sarah和Tom", ["Sarah", "Tom"]));
test("English+Chinese mixed", () => assertNames("跟James还有李总吃饭", ["James", "李总"]));
test("Dr. prefix", () => assertNames("Dr. Smith is here", ["Smith"]));

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
test("full-width punctuation mixed", () => assertNames("王磊，张三、李四", ["王磊", "张三", "李四"]));
test("mixed full/half-width", () => assertNames("王磊, 张三，李四、John", ["王磊", "张三", "李四", "John"]));
test("sentence boundary preserved", () => assertNames("见了王磊。张三没来", ["王磊", "张三"]));

console.log("\n=== Real-world Scenarios ===");
test("scenario: dinner meeting", () => assertNames(
  "晚上跟张总还有他的CTO一起吃饭，聊到他们公司最近在融B轮",
  ["张总"]
));
test("scenario: blockchain guy", () => assertNoNames(
  "我今天见了一个做区块链的技术大佬，跟他约了下周的咖啡"
));
test("scenario: AI entrepreneur", () => assertNames(
  "今天跟王磊在星巴克聊了AI创业，他想拉我一起做一个企业级RAG产品，约了下周三给他发BP。",
  ["王磊"]
));
test("scenario: old Zhou call", () => assertNames(
  "跟老周打了一个小时电话，他在看一个医疗SaaS的标的",
  ["老周"]
));
test("scenario: multiple people meeting", () => assertNames(
  "晚上跟张总还有他的CTO还有小王一起吃饭",
  ["张总", "小王"]
));

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
