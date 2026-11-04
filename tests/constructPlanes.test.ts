// SPDX-License-Identifier: AGPL-3.0-only
// Two plane constructions that gave wrong geometry or wrong figures.
//
// 1. Midplane of two planes that are not exactly parallel. The symmetry
//    plane of two planes is their bisector: every point of it lies as far
//    from the one as from the other. The construction put it through the
//    midpoint of the two patch centres with the averaged normal, which is the
//    bisector only when the planes are exactly parallel (or the centres lie
//    straight across from each other). Two faces 2° apart with patches 50 mm
//    apart along them gave a midplane whose own centre sat 0.44 mm nearer to
//    one face than to the other.
//
// 2. An offset plane is constructed, so it has no measured surface — but it
//    was built by spreading the source plane, form error and residual extremes
//    included, so a Flatness on it reported the source face's flatness ("over
//    0 points") and a Point – Plane distance to it a "measured surface" range.
//    The documented contract (FitBase) is that constructed geometry carries
//    none of them.
import { describe, expect, it } from 'vitest'
import { evaluateConstruction } from '../src/core/elements/construct'
import { evaluateDimension } from '../src/core/dimensions'
import type { PlaneFit, PointFit, Vec3 } from '../src/core/types'
import { addScaled, dot, normalize, sub } from '../src/core/vec'

function plane(center: Vec3, normal: Vec3, extra: Partial<PlaneFit> = {}): PlaneFit {
  const n = normalize(normal)!
  const helper: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = normalize([
    n[1] * helper[2] - n[2] * helper[1],
    n[2] * helper[0] - n[0] * helper[2],
    n[0] * helper[1] - n[1] * helper[0],
  ])!
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]
  return {
    kind: 'plane', center, normal: n, basisU: u, basisV: v, extentU: 20, extentV: 20,
    sigma: 0.01, usedPoints: 1000, regionSize: 1000, ...extra,
  }
}

const dist = (p: Vec3, pl: PlaneFit) => Math.abs(dot(sub(p, pl.center), pl.normal))

describe('midplane of two planes a little off parallel', () => {
  const tilt = (2 * Math.PI) / 180
  // Bottom face z = 0, facing down; top face about 10 mm up, leaning 2°
  // about Y, facing up, its patch 50 mm along X from the bottom one's.
  const bottom = plane([0, 0, 0], [0, 0, -1])
  const topNormal: Vec3 = [Math.sin(tilt), 0, Math.cos(tilt)]
  const top = plane([50, 0, 10], topNormal)
  const mid = evaluateConstruction('plane-midplane', [bottom, top], [], 100) as PlaneFit

  it('lies as far from the one as from the other, at its centre and across it', () => {
    for (const p of [
      mid.center,
      addScaled(mid.center, mid.basisU, 15),
      addScaled(mid.center, mid.basisV, -15),
      addScaled(addScaled(mid.center, mid.basisU, -10), mid.basisV, 12),
    ]) {
      expect(Math.abs(dist(p, bottom) - dist(p, top))).toBeLessThan(1e-9)
    }
  })

  it('still sits halfway between exactly parallel faces, at the middle of the two centres', () => {
    const a = plane([0, 0, 0], [0, 0, -1])
    const b = plane([3, 4, 10], [0, 0, 1])
    const m = evaluateConstruction('plane-midplane', [a, b], [], 100) as PlaneFit
    expect(m.center[0]).toBeCloseTo(1.5, 12)
    expect(m.center[1]).toBeCloseTo(2, 12)
    expect(m.center[2]).toBeCloseTo(5, 12)
  })
})

describe('offset plane', () => {
  const measured = plane([0, 0, 0], [0, 0, 1], { formError: 0.08, residualMin: -0.03, residualMax: 0.05 })
  const offset = evaluateConstruction('plane-offset', [measured], [5], 100) as PlaneFit

  it('carries no form error of its own', () => {
    expect(offset.center[2]).toBeCloseTo(5, 12)
    expect(offset.formError).toBeUndefined()
    expect(offset.residualMin).toBeUndefined()
    expect(offset.residualMax).toBeUndefined()
    expect(evaluateDimension('form-flatness', [offset]).invalid).toBeDefined()
  })

  it('gives a point–plane distance no measured-surface range', () => {
    const p: PointFit = { kind: 'point', center: [0, 0, 12], sigma: 0, usedPoints: 0, regionSize: 0 }
    const v = evaluateDimension('dist-point-plane', [p, offset])
    expect(v.raw).toBeCloseTo(7, 12)
    expect(v.range).toBeUndefined()
  })
})
