// src/lib/sse-utils.ts
// Server-Sent Events 工具 — 服务端序列化 + 客户端解析

const encoder = new TextEncoder();

/** SSE 事件类型 */
export type SSEEvent =
  | { type: "progress"; step: string; message: string; detail?: string }
  | { type: "result"; data: Record<string, unknown> }
  | { type: "error"; message: string };

/** 服务端：将 SSEEvent 编码为 SSE 格式的 Uint8Array */
export function encodeSSE(event: SSEEvent): Uint8Array {
  const eventLine = `event: ${event.type}\n`;
  const dataLine = `data: ${JSON.stringify(
    event.type === "result" ? event.data :
    event.type === "error" ? { message: event.message } :
    { step: event.step, message: event.message, detail: event.detail }
  )}\n\n`;
  return encoder.encode(eventLine + dataLine);
}

/** 客户端：从 ReadableStream 中迭代 SSE 事件 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent, void, undefined> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6);
      } else if (line === "" && currentEvent && currentData) {
        try {
          const parsed = JSON.parse(currentData);
          if (currentEvent === "progress") {
            yield { type: "progress", ...parsed } as SSEEvent;
          } else if (currentEvent === "result") {
            yield { type: "result", data: parsed };
          } else if (currentEvent === "error") {
            yield { type: "error", message: parsed.message || "未知错误" };
          }
        } catch {
          // 跳过无法解析的事件
        }
        currentEvent = "";
        currentData = "";
      }
    }
  }
}
