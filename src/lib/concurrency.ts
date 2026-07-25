/** 同時実行数を制限しながら配列を処理する（Gmail API のレート制限対策） */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

const RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);

/** 一時的なエラー（レート制限・瞬断）を指数バックオフで再試行する */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 5, baseDelayMs = 500, label = "処理" }: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const status = (e as { code?: number; status?: number })?.code ?? (e as { status?: number })?.status;

      if (typeof status === "number" && !RETRYABLE_STATUS.has(status)) throw e;
      if (attempt === attempts - 1) break;

      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      console.warn(`${label}を再試行します (${attempt + 1}/${attempts}, ${Math.round(delay)}ms 待機)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
