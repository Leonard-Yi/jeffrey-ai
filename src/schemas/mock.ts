/**
 * Mock data — "老王做投行和木工" example
 * Demonstrates a Person node + the Interaction that created it.
 */

import type { Person, Interaction } from "./core";

export const mockLaoWang: Person = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  name: "老王",
  careers: [
    { name: "投行", weight: 0.9 },
    { name: "木工", weight: 0.1 },
  ],
  interests: [
    { name: "手作木工", weight: 0.6 },
    { name: "金融市场", weight: 0.4 },
  ],
  vibeTags: ["务实", "压力大", "有工匠气质"],
  relationshipScore: 62,
  lastContactDate: "2026-03-30T14:30:00+08:00",
};

export const mockInteraction: Interaction = {
  id: "a0eebc99-9c0b-4ef8-bb6b-6bb9bd380a11",
  personIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
  date: "2026-03-30T14:30:00+08:00",
  location: "国贸星巴克",
  contextType: "咖啡",
  sentiment: "轻松，老王话不多但聊得真诚",
  actionItems: [
    {
      description: "把那本《木工基础》的链接发给老王",
      ownedBy: "me",
      resolved: false,
    },
    {
      description: "老王说下次可以介绍他在高盛的朋友认识",
      ownedBy: "them",
      resolved: false,
    },
  ],
  coreMemories: [
    "他最近转型做投行 MD，但内心更享受周末刨木头",
    "他提到做木工是因为父亲是木匠，有点情怀在里面",
    "他觉得金融圈太虚，木工让他感觉脚踏实地",
  ],
};
