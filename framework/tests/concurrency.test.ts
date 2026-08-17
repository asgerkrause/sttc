import { describe, expect, test } from 'bun:test'
import { mapConcurrent } from '../build/concurrency'

describe('bounded build concurrency', () => {
  test('limits active work and visits every item', async () => {
    let active = 0
    let peak = 0
    const visited: number[] = []
    await mapConcurrent([0, 1, 2, 3, 4], 2, async (item) => {
      active++
      peak = Math.max(peak, active)
      await Bun.sleep(2)
      visited.push(item)
      active--
    })
    expect(peak).toBe(2)
    expect(visited.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })

  test('reports the lowest-index failure deterministically', async () => {
    await expect(mapConcurrent([0, 1, 2], 3, async (item) => {
      if (item === 2) throw new Error('later')
      if (item === 1) throw new Error('first')
    })).rejects.toThrow('first')
  })

  test('returns results aligned to input index', async () => {
    const values = await mapConcurrent([10, 20, 30], 2, async (item) => {
      await Bun.sleep(item === 10 ? 4 : 1)
      return item * 2
    })
    expect(values).toEqual([20, 40, 60])
  })
})
