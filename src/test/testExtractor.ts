import { extractInteractionData } from "../services/llmExtractor";

const TEST_INPUT =
  "今天和老王喝了咖啡，他最近在做投行，但也迷上了做木工。" +
  "他说做木工是因为父亲是木匠，有情怀。" +
  "我答应下次把那本《木工基础》的链接发给他，他说可以介绍他在高盛的朋友给我认识。";

async function main() {
  console.log("输入文本：\n", TEST_INPUT, "\n");
  console.log("正在调用 LLM...\n");

  const payload = await extractInteractionData(TEST_INPUT);

  console.log("提取结果：\n", JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error("错误：", err.message);
  process.exit(1);
});
