// SPDX-License-Identifier: AGPL-3.0-only
// A binary STL corner written as -0.0 in one triangle and +0.0 in the next is
// the same point: IEEE 754 says -0 === 0, and a mirror or a negation in the
// program that wrote the file is all it takes to produce one. The soup weld
// matched corners on raw float bits, so the two were kept as two vertices —
// a crack through a closed part, every edge across it reported open, region
// growing stopped at it, the part read as not closed. closedShells and the
// 3MF writer already read -0 as 0; the weld every scan goes through must
// agree with them. A tetrahedron's four corners must weld to four vertices
// with no open edge, however the zeros are signed.

import { describe, expect, it } from 'vitest'
import { weldTriangleSoup } from '../src/core/geometry/weld'
import { closedShells } from '../src/core/geometry/closedShells'
import { openEdgeCount } from './helpers'

const A = [0, 0, 0]
const B = [10, 0, 0]
const C = [0, 10, 0]
const D = [0, 0, 10]

/** A closed tetrahedron, outward wound, as a triangle soup — every zero in
 *  the second and fourth triangles written as -0. */
function tetraSoup(): Float32Array {
  const neg = (p: number[]) => p.map((x) => (x === 0 ? -0 : x))
  const tris = [
    [A, C, B],
    [neg(A), neg(B), neg(D)],
    [A, D, C],
    [neg(B), neg(C), neg(D)],
  ]
  return Float32Array.from(tris.flat(2))
}

describe('the soup weld reads -0 as 0', () => {
  it('welds a tetrahedron with signed zeros to four vertices and no open edge', () => {
    const soup = tetraSoup()
    // The fixture really does carry both signs of zero.
    expect(Object.is(soup[9], -0)).toBe(true)
    expect(Object.is(soup[0], 0)).toBe(true)
    const { positions, indices } = weldTriangleSoup(soup)
    expect(positions.length / 3).toBe(4)
    expect(openEdgeCount(indices)).toBe(0)
    // And the weld agrees with closedShells, which already read the soup as closed.
    expect(closedShells(soup, null).count).toBe(4)
  })
})
