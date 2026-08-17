export async function mapConcurrent<T>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<void>,
) {
  if (items.length === 0) return
  let cursor = 0
  const errors: unknown[] = []
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      try {
        await run(items[index]!, index)
      } catch (error) {
        errors[index] = error
      }
    }
  })
  await Promise.all(workers)
  const first = errors.find((error) => error !== undefined)
  if (first !== undefined) throw first
}
