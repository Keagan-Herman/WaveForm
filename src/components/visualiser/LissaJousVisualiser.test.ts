import { describe, it, expect } from 'vitest'

// Copy of the types & functions under test (extracted for testability)
interface TrailBuffer {
  data: Float32Array
  head: number
  count: number
  capacity: number
}

function createTrailBuffer(capacity: number): TrailBuffer {
  return { data: new Float32Array(capacity * 2), head: 0, count: 0, capacity }
}

function writePointDirect(buf: TrailBuffer, x: number, y: number): void {
  buf.data[buf.head * 2] = x
  buf.data[buf.head * 2 + 1] = y
  buf.head = (buf.head + 1) % buf.capacity
  if (buf.count < buf.capacity) buf.count++
}

function iteratePoints(
  buf: TrailBuffer,
  cb: (x: number, y: number, i: number, total: number) => void
): void {
  const start = buf.count < buf.capacity ? 0 : buf.head
  for (let i = 0; i < buf.count; i++) {
    const idx = (start + i) % buf.capacity
    cb(buf.data[idx * 2], buf.data[idx * 2 + 1], i, buf.count)
  }
}

describe('TrailBuffer', () => {
  it('stores and iterates points in insertion order', () => {
    const buf = createTrailBuffer(3)
    writePointDirect(buf, 1, 2)
    writePointDirect(buf, 3, 4)
    writePointDirect(buf, 5, 6)

    const points: [number, number][] = []
    iteratePoints(buf, (x, y) => points.push([x, y]))

    expect(points).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ])
  })

  it('wraps around when capacity is exceeded, oldest point evicted', () => {
    const buf = createTrailBuffer(2)
    writePointDirect(buf, 1, 2)
    writePointDirect(buf, 3, 4)
    writePointDirect(buf, 5, 6) // evicts [1,2]

    const points: [number, number][] = []
    iteratePoints(buf, (x, y) => points.push([x, y]))

    expect(points).toEqual([
      [3, 4],
      [5, 6],
    ])
    expect(buf.count).toBe(2)
  })

  it('provides correct i and total to callback', () => {
    const buf = createTrailBuffer(5)
    writePointDirect(buf, 10, 20)
    writePointDirect(buf, 30, 40)

    const calls: [number, number][] = []
    iteratePoints(buf, (_, _2, i, total) => calls.push([i, total]))

    expect(calls).toEqual([
      [0, 2],
      [1, 2],
    ])
  })
})
