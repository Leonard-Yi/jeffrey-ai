import type { WeightedTag } from "@/schemas/core";

const RECENCY_BIAS = 0.3; // weight given to the incoming value

/**
 * Merges weighted tags with recency bias.
 * When a person already exists, we don't blindly overwrite their tags.
 * new_weight = prev_weight * 0.7 + incoming_weight * 0.3
 */
export function mergeTags(existing: WeightedTag[], incoming: WeightedTag[]): WeightedTag[] {
  const map = new Map<string, number>(existing.map((t) => [t.name, t.weight]));

  for (const tag of incoming) {
    const prev = map.get(tag.name);
    if (prev !== undefined) {
      map.set(tag.name, prev * (1 - RECENCY_BIAS) + tag.weight * RECENCY_BIAS);
    } else {
      map.set(tag.name, tag.weight);
    }
  }

  return Array.from(map.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);
}