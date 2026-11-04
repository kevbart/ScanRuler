// SPDX-License-Identifier: AGPL-3.0-only
// Audit (reverse): a sketch region's area — what the readout hands an agent
// (regionsOut, reverse.sketch.* answers) and what the refusals name — was
// the area of the polygon the region's arcs are sampled into for drawing,
// 72 chords a turn: a circle of radius 10 read 313.761 mm² for its
// πr² = 314.159, low by (1 − sin(2π/72)/(2π/72)) ≈ 0.13 %, while the body
// extruded from it has the exact volume. A region bounded by lines and arcs
// has an exact area (Green's theorem: each chord's shoelace term plus, on an
// arc of sweep φ, the circular segment r²/2 · (φ − sin φ)), and that is what
// these known shapes are held to, to a millionth.

import { describe, expect, it } from 'vitest'
import { findRegions, mergeRegions } from '../core/regions'
import { addEntity, addRectangle, emptySketch, type Sketch } from '../core/sketch'

const areas = (s: Sketch) => findRegions(s).map((r) => r.area).sort((a, b) => a - b)
const close = (got: number[], want: number[]) => {
  expect(got).toHaveLength(want.length)
  const w = [...want].sort((a, b) => a - b)
  got.forEach((g, i) => expect(Math.abs(g - w[i]) / w[i]).toBeLessThan(1e-6))
}

describe('a sketch region reads its exact area', () => {
  it('a circle is πr²', () => {
    const s = emptySketch()
    addEntity(s, { kind: 'circle', c: [3, -2], r: 10 })
    close(areas(s), [Math.PI * 100])
  })

  it('a square with a round hole is the square less the circle, the hole πr²', () => {
    const s = emptySketch()
    addRectangle(s, [-20, -20], [20, 20])
    addEntity(s, { kind: 'circle', c: [0, 0], r: 10 })
    close(areas(s), [1600 - Math.PI * 100, Math.PI * 100])
  })

  it('a slot is its rectangle and two half discs', () => {
    const s = emptySketch()
    addEntity(s, { kind: 'line', a: [0, -5], b: [20, -5] })
    addEntity(s, { kind: 'arc', c: [20, 0], r: 5, start: -Math.PI / 2, sweep: Math.PI })
    addEntity(s, { kind: 'line', a: [20, 5], b: [0, 5] })
    addEntity(s, { kind: 'arc', c: [0, 0], r: 5, start: Math.PI / 2, sweep: Math.PI })
    close(areas(s), [200 + 25 * Math.PI])
  })

  it('two circles crossing: the lens 2r²·acos(d/2r) − (d/2)·√(4r² − d²) and the two moons', () => {
    const s = emptySketch()
    addEntity(s, { kind: 'circle', c: [0, 0], r: 10 })
    addEntity(s, { kind: 'circle', c: [10, 0], r: 10 })
    const lens = 2 * 100 * Math.acos(0.5) - 5 * Math.sqrt(300)
    close(areas(s), [lens, Math.PI * 100 - lens, Math.PI * 100 - lens])
  })

  it('a circle inscribed in a square leaves four corners of (4 − π)r²/4 each', () => {
    const s = emptySketch()
    addRectangle(s, [-10, -10], [10, 10])
    addEntity(s, { kind: 'circle', c: [0, 0], r: 10 })
    const corner = (400 - 100 * Math.PI) / 4
    close(areas(s), [corner, corner, corner, corner, 100 * Math.PI])
  })

  it('regions merged across a shared piece add up to the exact whole', () => {
    const s = emptySketch()
    addEntity(s, { kind: 'circle', c: [0, 0], r: 10 })
    addEntity(s, { kind: 'line', a: [-20, 0], b: [20, 0] })
    const halves = findRegions(s)
    close(halves.map((r) => r.area), [50 * Math.PI, 50 * Math.PI])
    const merged = mergeRegions(halves, s)
    close(merged.map((r) => r.area), [100 * Math.PI])
  })
})
