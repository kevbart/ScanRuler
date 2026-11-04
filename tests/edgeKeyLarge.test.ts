// SPDX-License-Identifier: AGPL-3.0-only
// Open edges on a scan of more than 2²¹ (2,097,152) vertices. The edge a–b
// was keyed as lo·2³² + hi in a double, which holds integers exactly only up
// to 2⁵³ — so from vertex 2²¹ on the key loses hi's low bits: two different
// edges share a key and count as one edge used twice (an open edge read as
// closed), and an open edge decodes to the wrong far vertex. A scan of a few
// million vertices is ordinary. Expected: a flat grid sheet of 6 × 4 squares
// numbered from vertex 3,000,000 has exactly its 20 boundary edges open, in
// one closed rim of 20 vertices whose length is the perimeter, 20 mm.

import { describe, expect, it } from 'vitest'
import { meshGaps, rimLoops } from '../src/core/geometry/openEdges'

const OFF = 3_000_000
const NX = 6
const NY = 4

/** A unit grid of NX × NY squares, two triangles each, its vertices
 *  numbered from OFF — positions for every number below them too. */
function sheet(): { positions: Float32Array; indices: Uint32Array } {
  const id = (i: number, j: number) => OFF + j * (NX + 1) + i
  const positions = new Float32Array((OFF + (NX + 1) * (NY + 1)) * 3)
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      positions[id(i, j) * 3] = i
      positions[id(i, j) * 3 + 1] = j
    }
  }
  const tris: number[] = []
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      tris.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1))
    }
  }
  return { positions, indices: Uint32Array.from(tris) }
}

describe('open edges past 2^21 vertices', () => {
  const { positions, indices } = sheet()
  const boundary = 2 * (NX + NY)

  it('walks the one rim, every boundary edge once', () => {
    const loops = rimLoops(indices)
    expect(loops.length).toBe(1)
    expect(loops[0].closed).toBe(true)
    expect(loops[0].vertices.length).toBe(boundary)
    expect(loops[0].triangles.length).toBe(boundary)
  })

  it('measures the gap: 20 edges, 20 mm of rim, centred on the sheet', () => {
    const gaps = meshGaps(positions, indices)
    expect(gaps.length).toBe(1)
    expect(gaps[0].edges).toBe(boundary)
    expect(gaps[0].length).toBeCloseTo(boundary, 9)
    expect(gaps[0].at[0]).toBeCloseTo(NX / 2, 9)
    expect(gaps[0].at[1]).toBeCloseTo(NY / 2, 9)
    expect(gaps[0].size).toBeCloseTo(Math.hypot(NX, NY), 9)
  })
})
