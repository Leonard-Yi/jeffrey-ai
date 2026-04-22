/**
 * 带并发上限的 embedding 刷新队列。
 * 最多同时进行 MAX_CONCURRENT 个刷新任务，防止大量并发 DashScope API 调用耗尽内存。
 */

const MAX_CONCURRENT = 2; // 最多同时进行 2 个后台刷新
const activeIds = new Set<string>(); // 当前正在刷新的 personId
let activeCount = 0;

/**
 * 将一个 embedding 刷新任务加入队列。
 * 如果 personId 已在队列中，或当前并发数已达上限，本次调用会被静默跳过。
 */
export function enqueueEmbeddingRefresh(
  personId: string,
  label: string,
  fn: () => Promise<void>
): void {
  if (activeIds.has(personId)) {
    console.log(`[EmbeddingQueue] "${label}" already in queue, skipping`);
    return;
  }
  if (activeCount >= MAX_CONCURRENT) {
    console.log(`[EmbeddingQueue] Queue full (${activeCount}/${MAX_CONCURRENT}), skipping "${label}"`);
    return;
  }

  activeIds.add(personId);
  activeCount++;
  console.log(`[EmbeddingQueue] Enqueued "${label}" (active: ${activeCount}/${MAX_CONCURRENT})`);

  fn()
    .catch((err) => {
      console.error(`[EmbeddingQueue] Refresh failed for "${label}":`, err);
    })
    .finally(() => {
      activeIds.delete(personId);
      activeCount--;
      console.log(`[EmbeddingQueue] Done "${label}" (active: ${activeCount}/${MAX_CONCURRENT})`);
    });
}
