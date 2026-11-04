// SPDX-License-Identifier: AGPL-3.0-only
// Audit (deviation): a zero-area triangle in a closed reference flips the sign
// of the deviation along every edge and vertex it touches.
//
// A CAD export often closes a T-junction with a sliver whose three distinct
// corners are collinear. buildMeshGraph only drops triangles with a repeated
// index, so the sliver reaches NominalSurface, whose face normal for it falls
// back to (0, 0, 1) and still enters the edge pseudonormals (plain sum) and the
// vertex pseudonormals (weighted by the corner angle — π at the middle corner
// of a collinear triangle). On the bottom face of a box (outward normal −z)
// that cancels the real normal: the seam's pseudonormal comes out +z and every
// point whose closest point lands on the seam is read on the wrong side.
//
// Expected values: the box is −5…5 on every axis and the queries lie 0.3 mm
// below or above its bottom face at z = −5, straight under the seam, so the
// exact signed distance is ±0.3 (outside positive, inside negative). The
// sliver has no area, adds no surface and changes nothing about the solid,
// so it must change nothing about the answer.

import { describe, expect, it } from 'vitest'
import { computeDeviation } from '../src/core/deviation/deviation'
import { identityRigid } from '../src/core/deviation/rigid'
import { NominalSurface, emptyHit } from '../src/core/deviation/surface'
import { buildMeshGraph } from '../src/core/geometry/buildGraph'

/** A closed 10 mm box wound outward, its bottom face split along the
 *  diagonal v0–v2 with a T-junction at its middle (vertex 8) closed by the
 *  zero-area triangle (v0, v8, v2). */
function boxWithSliver() {
  const P = [
    [-5, -5, -5], [5, -5, -5], [5, 5, -5], [-5, 5, -5],
    [-5, -5, 5], [5, -5, 5], [5, 5, 5], [-5, 5, 5],
    [0, 0, -5],
  ]
  const T = [
    [0, 2, 1], [0, 3, 8], [8, 3, 2], // bottom, −z, with the T-junction at 8
    [0, 8, 2], // the sliver: collinear, no area
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [3, 6, 2], [3, 7, 6],
    [1, 2, 6], [1, 6, 5],
    [0, 4, 7], [0, 7, 3],
  ]
  return buildMeshGraph({ kind: 'indexed', positions: Float32Array.from(P.flat()), indices: Uint32Array.from(T.flat()) })
}

const QUERIES: [number, number, number, number][] = [
  // x, y, z, exact signed distance
  [0, 0, -5.3, 0.3], // under the T-junction vertex
  [1, 1, -5.3, 0.3], // under the seam, between the junction and a corner
  [-2, -2, -5.3, 0.3],
  [0, 0, -4.7, -0.3], // just inside
  [1, 1, -4.7, -0.3],
]

describe('a zero-area triangle in the reference', () => {
  it('leaves the signed distance under the seam as it is', () => {
    const g = boxWithSliver()
    const surface = new NominalSurface(g.positions, g.indices)
    const hit = emptyHit()
    for (const [x, y, z, want] of QUERIES) {
      expect(surface.closest(x, y, z, hit)).toBe(true)
      expect(hit.signed).toBeCloseTo(want, 5)
    }
  })

  it('reads a scan point 0.3 mm outside the bottom face as +0.3 on the map', () => {
    const g = boxWithSliver()
    const surface = new NominalSurface(g.positions, g.indices)
    const scan = Float32Array.from(QUERIES.flatMap(([x, y, z]) => [x, y, z]))
    const values = computeDeviation(surface, scan, identityRigid())
    QUERIES.forEach(([, , , want], i) => expect(values[i]).toBeCloseTo(want, 5))
  })
})
