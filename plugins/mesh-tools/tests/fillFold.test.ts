// SPDX-License-Identifier: AGPL-3.0-only
// Fill holes, Curved: on a mesh of long thin triangles — a CAD tessellation,
// here a 10 mm cylinder whose wall is a quad from end to end — a hole of a
// few wall quads was closed with a patch that ballooned out to a radius of
// 11.7–12.9 mm and turned triangles over to face into the part. Curved fairs
// the rim's own vertices against the scan one ring out, and that ring reaches
// the cap's centre 10 mm away and the far end of the wall 20 mm away: the
// bi-Laplacian asks for a bend the surface does not have and pushes the
// patch out to make it up.
//
// What is right, from the geometry: a patch across a hole in a cylinder's
// wall lies between the chord across the hole and the cylinder itself — no
// point of it further out than the radius (to float precision), none further
// in than the chord's sagitta over the hole's angle — and every one of its
// triangles faces out of the part as the wall round it does. And the mesh is
// closed again: every edge shared by two triangles walking it opposite ways.

import { describe, expect, it } from 'vitest'
import { buildMeshGraph } from '../../../src/core/geometry/buildGraph'
import { closedness } from '../core/boolean'
import { fillHoles, type FillMode } from '../core/fillHoles'
import { elementSolid, segmentsFor } from '../core/primitiveMesh'
import { withoutTriangles } from '../core/pieces'
import type { FitData } from '../../../src/core/types'

const R = 10

/** A cylinder meshed as CAD meshes it, welded: r 10, 20 long along Z. */
function cadCylinder() {
  const fit = { kind: 'cylinder', center: [0, 0, 0], axis: [0, 0, 1], radius: R, length: 20 } as unknown as FitData
  const t = elementSolid(fit, 0.01)!
  const soup = new Float32Array(t.indices.length * 3)
  for (let i = 0; i < t.indices.length; i++) for (let k = 0; k < 3; k++) soup[i * 3 + k] = t.positions[t.indices[i] * 3 + k]
  return buildMeshGraph({ kind: 'soup', positions: soup })
}

describe('a curved patch on a mesh of long thin triangles', () => {
  for (const half of [0.1, 0.2]) {
    for (const mode of ['curved', 'flat'] as FillMode[]) {
      it(`closes a hole ${half * 2} rad wide in a CAD cylinder's wall (${mode}) between the chord and the wall, facing out`, () => {
        const g = cadCylinder()
        const drop = new Uint8Array(g.indices.length / 3)
        for (let t = 0; t < drop.length; t++) {
          let cx = 0, cy = 0, cz = 0
          for (let k = 0; k < 3; k++) {
            const v = g.indices[t * 3 + k] * 3
            cx += g.positions[v] / 3
            cy += g.positions[v + 1] / 3
            cz += g.positions[v + 2] / 3
          }
          if (Math.hypot(cx, cy) > R * 0.9 && Math.abs(cz) < 9.99 && Math.abs(Math.atan2(cy, cx)) < half) drop[t] = 1
        }
        const holed = withoutTriangles(g.positions, g.indices, g.vertexCount, drop)
        const before = holed.indices.length
        expect(closedness(holed.indices, holed.positions.length / 3).open).toBeGreaterThan(0)

        const f = fillHoles(holed.positions, holed.indices, holed.positions.length / 3, 30, mode)
        expect(f.report.filled).toBe(1)
        expect(closedness(f.indices, f.positions.length / 3)).toEqual({ open: 0, bad: 0 })

        // The hole's rim runs along wall vertices at most one segment past
        // the dropped angle; the chord across it sags no more than this.
        const segment = (2 * Math.PI) / segmentsFor(R, 0.01)
        const sagitta = R * (1 - Math.cos(half + segment))
        let inward = 0
        let rMin = Infinity
        let rMax = 0
        const P = f.positions
        for (let t = before; t < f.indices.length; t += 3) {
          const a = f.indices[t] * 3, b = f.indices[t + 1] * 3, c = f.indices[t + 2] * 3
          const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2]
          const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]
          const nx = uy * vz - uz * vy
          const ny = uz * vx - ux * vz
          const mx = (P[a] + P[b] + P[c]) / 3
          const my = (P[a + 1] + P[b + 1] + P[c + 1]) / 3
          if (nx * mx + ny * my <= 0) inward++
          for (const q of [a, b, c]) {
            const r = Math.hypot(P[q], P[q + 1])
            rMin = Math.min(rMin, r)
            rMax = Math.max(rMax, r)
          }
        }
        expect(inward).toBe(0)
        expect(rMax).toBeLessThanOrEqual(R + 1e-4)
        expect(rMin).toBeGreaterThanOrEqual(R - sagitta - 1e-4)
      })
    }
  }
})
