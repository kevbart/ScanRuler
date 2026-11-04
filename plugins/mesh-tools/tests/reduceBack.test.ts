// SPDX-License-Identifier: AGPL-3.0-only
// Reduce mesh: the reduced surface measured back against the scan only at its
// vertices and the middle of each triangle, so the furthest the reduced mesh
// stands off the scan ("Mesh off the scan — Furthest", `backMax`) was read
// low. A triangle fanned out from a pinned vertex — a spike the forward
// measure pinned, a corner of the scan — rises along its edges, and neither
// its corners (on the scan) nor its middle (a third of the way up) see the
// top of the rise. On the scan-like bracket at 0.05 mm the report said the
// furthest was 0.056 mm when the surface stands 0.09 mm off the scan.
//
// The expected value is the definition: the largest distance from any point
// of the reduced surface to the scan, found here by sampling every reduced
// triangle on a grid ten times finer (0.03 mm) than the scan's 0.3 mm points.
// Distance to a surface is 1-Lipschitz, so that grid's maximum is within its
// covering radius (≈ 0.017 mm) of the true one; the report must reach it to
// within that and a tenth of the tolerance for its own sampling, and may not
// exceed it by more than the same. Before the fix the report said 0.056 mm
// against a reference of 0.091 mm.

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NominalSurface, emptyHit } from '../../../src/core/deviation/surface'
import { loadSimplifier, reduceMesh } from '../core/reduce'
import { lBracket } from './scanLike'

vi.setConfig({ testTimeout: 300_000 })

let simplifier: Awaited<ReturnType<typeof loadSimplifier>>
beforeAll(async () => {
  simplifier = await loadSimplifier()
})

/** The furthest any point of the triangles lies from `scan`, sampled at
 *  sub-triangle middles and corners no further apart than `spacing`. */
function furthestBack(scan: NominalSurface, P: Float32Array, I: Uint32Array, spacing: number): number {
  const hit = emptyHit()
  let max = 0
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3
    const longest = Math.max(
      Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]),
      Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]),
      Math.hypot(P[a] - P[c], P[a + 1] - P[c + 1], P[a + 2] - P[c + 2]),
    )
    const n = Math.max(1, Math.ceil(longest / spacing))
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        const u = i / n, w = j / n, s = 1 - u - w
        scan.closest(
          s * P[a] + u * P[b] + w * P[c],
          s * P[a + 1] + u * P[b + 1] + w * P[c + 1],
          s * P[a + 2] + u * P[b + 2] + w * P[c + 2],
          hit,
        )
        if (hit.distance > max) max = hit.distance
      }
    }
  }
  return max
}

describe('the reduced mesh measured back against the scan', () => {
  const cases = [{ name: 'a scan-like bracket at 0.05 mm', make: () => lBracket(), tolerance: 0.05, spacing: 0.03 }]
  for (const { name, make, tolerance, spacing } of cases) {
    it(`reports the furthest the reduced surface stands off ${name}`, () => {
      const scan = make()
      const surface = new NominalSurface(scan.positions, scan.indices)
      const { positions, indices, report } = reduceMesh(simplifier, scan, { tolerance, maxTriangles: 1e9 }, () => surface)
      const truth = furthestBack(surface, positions, indices, spacing)
      // Covering radius of the reference grid, and a tenth of the tolerance
      // for the report's own, coarser sampling.
      const slack = spacing / Math.sqrt(3) + 0.1 * tolerance
      expect(report.backMax).toBeGreaterThanOrEqual(truth - slack)
      expect(report.backMax).toBeLessThanOrEqual(truth + slack)
    })
  }
})
