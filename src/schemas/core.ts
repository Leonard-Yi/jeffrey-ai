import { z } from "zod";

// ─────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────

/**
 * A tag with a salience weight (0.0 – 1.0).
 * Use this wherever a plain string[] would lose relative importance.
 */
export const WeightedTagSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
});

export type WeightedTag = z.infer<typeof WeightedTagSchema>;

// ─────────────────────────────────────────────
// Entity 1 — Person (graph node)
// ─────────────────────────────────────────────

export const PersonSchema = z.object({
  /** UUID — stable primary key */
  id: z.string().uuid(),

  /** Display name */
  name: z.string().min(1),

  /** Professional roles / hard skills, ordered by salience */
  careers: z.array(WeightedTagSchema),

  /** Hobbies, topics, lifestyle — weighted to distinguish deep vs passing interests */
  interests: z.array(WeightedTagSchema),

  /**
   * Qualitative vibe / personality labels.
   * These are prose-like and resist quantification, so plain strings are fine.
   * Examples: ["务实", "焦虑", "喜欢抛观点"]
   */
  vibeTags: z.array(z.string()),

  /**
   * Rolling intimacy / activity score with the current user (0 – 100).
   * Updated after each interaction; drives node-size in the graph.
   */
  relationshipScore: z.number().min(0).max(100),

  /** ISO-8601 date string of the most recent interaction */
  lastContactDate: z.string().datetime({ offset: true }),
});

export type Person = z.infer<typeof PersonSchema>;

// ─────────────────────────────────────────────
// Entity 2 — Interaction (relationship pulse)
// ─────────────────────────────────────────────

export const ActionItemSchema = z.object({
  /** Short description of the commitment */
  description: z.string().min(1),
  /** Who owes whom — "me" means the current user */
  ownedBy: z.enum(["me", "them", "both"]),
  resolved: z.boolean().default(false),
});

export type ActionItem = z.infer<typeof ActionItemSchema>;

export const InteractionSchema = z.object({
  /** UUID — stable primary key */
  id: z.string().uuid(),

  /**
   * All Person.id values present in this interaction.
   * Array because a coffee can involve three people.
   */
  personIds: z.array(z.string().uuid()).min(1),

  /** When it happened (ISO-8601) */
  date: z.string().datetime({ offset: true }),

  /** Physical or virtual location — optional */
  location: z.string().optional(),

  /**
   * Medium / format of the interaction.
   * Open string so LLM can infer naturally ("咖啡", "微信语音", "饭局", "LinkedIn DM").
   */
  contextType: z.string().min(1),

  /**
   * Overall emotional tone of the exchange.
   * Open string: "轻松愉快", "有点尴尬", "高能量", etc.
   */
  sentiment: z.string(),

  /**
   * Unfinished commitments or social debts created during this interaction.
   * Drives a future "follow-up reminder" feature.
   */
  actionItems: z.array(ActionItemSchema),

  /**
   * Specific details only the people present would know.
   * These are the raw material for personalised icebreaker suggestions.
   * Examples: ["他老婆刚生了二胎", "他在考虑离职去美国", "聊到了《三体》结局"]
   */
  coreMemories: z.array(z.string()),
});

export type Interaction = z.infer<typeof InteractionSchema>;