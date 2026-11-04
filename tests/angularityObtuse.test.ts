// SPDX-License-Identifier: AGPL-3.0-only
// Angularity with an obtuse basic angle. A drawing may dimension a chamfer
// or a flank at 120° or 135° to its datum; two planes (or a line and a
// plane) at 120° stand to each other exactly as they do at 60°, since a
// plane has no front or back for an orientation tolerance. The feature's
// direction is folded onto the datum's side before the ideal direction is
// built, so the basic angle has to be folded the same way — it was not, and
// a face lying exactly at the basic 120° read 60° off it, its zone the full
// spread of the patch (17 mm on a 20 mm patch) instead of zero.
import { describe, expect, it } from 'vitest'
import { evaluateTolerance } from '../src/core/tolerances'
import type { CylinderFit, PlaneFit, Vec3 } from '../src/core/types'

const DEG = Math.PI / 180
const stats = { sigma: 0.002, usedPoints: 1234, regionSize: 1300, formError: 0.01 }

/** A plane through the origin whose normal is +Z turned about Y by `tilt`°. */
function plane(tilt: number): PlaneFit {
  const t = tilt * DEG
  return {
    kind: 'plane',
    center: [0, 0, 0],
    normal: [Math.sin(t), 0, Math.cos(t)],
    basisU: [Math.cos(t), 0, -Math.sin(t)],
    basisV: [0, 1, 0],
    extentU: 10,
    extentV: 10,
    ...stats,
  }
}

function cylinder(axis: Vec3): CylinderFit {
  return { kind: 'cylinder', center: [0, 0, 0], axis, radius: 4, length: 20, coverage: 360, ...stats }
}

describe('angularity at an obtuse basic angle', () => {
  it('reads zero on a face that lies at the basic angle', () => {
    const datum = plane(0)
    for (const [tilt, basic] of [
      [120, 120],
      [60, 120],
      [135, 135],
      [-135, 135],
    ]) {
      const r = evaluateTolerance('orient-angularity', [plane(tilt), datum], { basic })
      expect(r.raw, `face at ${tilt}°, basic ${basic}°`).toBeLessThan(1e-9)
    }
  })

  it('reads the excess tilt of a face half a degree past an obtuse basic angle', () => {
    const r = evaluateTolerance('orient-angularity', [plane(120.5), plane(0)], { basic: 120 })
    // The patch's 20 mm across the tilt, turned 0.5° out of the zone.
    expect(r.raw).toBeCloseTo(20 * Math.sin(0.5 * DEG), 9)
  })

  it('takes an axis at an obtuse basic angle to a plane', () => {
    // An axis 45° off the plane, dimensioned as 135°.
    const t = 45 * DEG
    const r = evaluateTolerance('orient-angularity', [cylinder([Math.sin(t), 0, Math.cos(t)]), plane(0)], {
      basic: 135,
    })
    expect(r.raw).toBeLessThan(1e-9)
  })
})
