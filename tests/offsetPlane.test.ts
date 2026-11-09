// SPDX-License-Identifier: AGPL-3.0-only
// An offset plane is constructed, so it has no measured surface — but it was
// built by spreading the source plane, form error and residual extremes
// included, so a Flatness on it reported the source face's flatness ("over
// 0 points") and a Point – Plane distance to it a "measured surface" range.
// The documented contract (FitBase) is that constructed geometry carries
// none of them.
import { describe, expect, it } from 'vitest'
import { evaluateConstruction } from '../src/core/elements/construct'
import { evaluateDimension } from '../src/core/dimensions'
import type { PlaneFit, PointFit, Vec3 } from '../src/core/types'
import { normalize } from '../src/core/vec'

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
