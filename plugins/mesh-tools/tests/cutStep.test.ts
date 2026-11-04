// SPDX-License-Identifier: AGPL-3.0-only
// Cut: a face of the part lying in the cut plane was always kept, whichever
// side it bounds. Cut a stepped part along the level of its step, keeping what
// is above: the step's top faces up into the side that stays, but it is the
// top of the block below — which goes — and was left hanging off the part as
// a sheet, doubled by the cap laid across the same place (6 edges shared by
// more than two triangles). The same for an overhang's underside cut along
// its own level, keeping what is below.
//
// What is right: a face in the plane bounds the material on the side it faces
// away from, so it stays exactly when that side does. The part cut is then a
// closed solid again — every edge shared by exactly two triangles walking it
// opposite ways — whose volume is the box-sum of what lies on the kept side.

import { beforeAll, describe, expect, it } from 'vitest'
import Module, { type ManifoldToplevel } from 'manifold-3d'
import { buildMeshGraph } from '../../../src/core/geometry/buildGraph'
import { booleanMesh, closedness } from '../core/boolean'
import { cutMesh, cutPreview } from '../core/cut'
import { signedVolume } from '../core/hollow'
import { boxMesh } from '../../../tests/helpers'
import type { Vec3 } from '../../../src/core/types'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await Module()
  wasm.setup()
})

/** A block [-5, 5]³ with a tower [-7.5, 2.5] × [-5, 5] × [0, 10] on it: a
 *  step's top at z = 5 for x in [2.5, 5], facing up, and an overhang's
 *  underside at z = 0 for x in [-7.5, -5], facing down. 1625 mm³. */
function stepped() {
  const block = buildMeshGraph({ kind: 'soup', positions: boxMesh(10, 4) })
  const t = boxMesh(10, 4)
  for (let i = 0; i < t.length; i += 3) {
    t[i] -= 2.5
    t[i + 2] += 5
  }
  const tower = buildMeshGraph({ kind: 'soup', positions: t })
  const u = booleanMesh(wasm, block, [{ positions: tower.positions, indices: tower.indices }], 'add')
  return { positions: u.positions, indices: u.indices, vertexCount: u.positions.length / 3 }
}

describe('a cut along the level of a face of the part', () => {
  const cases: { z: number; normal: Vec3; volume: number; what: string }[] = [
    // Keep above the step: the tower's upper half, 10 × 10 × 5.
    { z: 5, normal: [0, 0, -1], volume: 500, what: "the step's top, keeping above" },
    // Keep below the step: the block and the overhang under z = 5.
    { z: 5, normal: [0, 0, 1], volume: 1000 + 2.5 * 10 * 5, what: "the step's top, keeping below" },
    // Keep below the overhang: the block's lower half.
    { z: 0, normal: [0, 0, 1], volume: 500, what: "the overhang's underside, keeping below" },
    // Keep above the overhang: everything but the block's lower half.
    { z: 0, normal: [0, 0, -1], volume: 1625 - 500, what: "the overhang's underside, keeping above" },
  ]
  for (const { z, normal, volume, what } of cases) {
    it(`leaves a closed solid of the right volume: ${what}`, () => {
      const g = stepped()
      expect(signedVolume(g.positions, g.indices)).toBeCloseTo(1625, 6)
      const cut = cutMesh(g.positions, g.indices, g.vertexCount, [0, 0, z], normal, true)
      expect(closedness(cut.indices, cut.positions.length / 3)).toEqual({ open: 0, bad: 0 })
      expect(signedVolume(cut.positions, cut.indices)).toBeCloseTo(volume, 3)
      // Nothing on the side that goes.
      for (let v = 0; v < cut.positions.length / 3; v++) expect((cut.positions[v * 3 + 2] - z) * normal[2]).toBeLessThanOrEqual(1e-6)
      // The preview closes the same faces.
      const preview = cutPreview(g.positions, g.indices, g.vertexCount, [0, 0, z], normal)
      expect(preview.openStretches).toBe(0)
      expect(preview.cap.length / 9).toBe(cut.report.capTriangles)
    })
  }
})
