const EMBEDDING_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding";
const EMBEDDING_MODEL = "text-embedding-v4";

function getApiKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("Missing env var: DASHSCOPE_API_KEY");
  return apiKey;
}

export type WeightedTag = { name: string; weight: number };

/**
 * Builds a searchable text representation of a person for embedding.
 */
export function buildPersonSearchText(person: {
  name: string;
  careers: WeightedTag[];
  interests: WeightedTag[];
  vibeTags: string[];
}): string {
  const careerStr = person.careers
    .map((c) => `${c.name}(${Math.round(c.weight * 100)}%)`)
    .join(", ");
  const interestStr = person.interests
    .map((i) => `${i.name}(${Math.round(i.weight * 100)}%)`)
    .join(", ");
  const vibeStr = person.vibeTags.join(", ");

  return [
    `姓名: ${person.name}`,
    careerStr ? `职业: ${careerStr}` : null,
    interestStr ? `兴趣: ${interestStr}` : null,
    vibeStr ? `性格: ${vibeStr}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Calls DashScope embedding API and returns the float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();

  const response = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: {
        texts: [text],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.code && data.message) {
    throw new Error(`DashScope embedding error: ${data.code} - ${data.message}`);
  }

  const embedding = data.output?.embeddings?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error(`Invalid embedding response: ${JSON.stringify(data)}`);
  }

  return embedding;
}
