export const IO_CONCURRENCY = 8
export const CPU_CONCURRENCY = 4

export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let cursor = 0
  const errors: unknown[] = []
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = await run(items[index]!, index)
      } catch (error) {
        errors[index] = error
      }
    }
  })
  await Promise.all(workers)
  const first = errors.find((error) => error !== undefined)
  if (first !== undefined) throw first
  return results
}
