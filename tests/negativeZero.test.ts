// SPDX-License-Identifier: AGPL-3.0-only
// Readouts that printed a negative zero. A length goes through units.fmtLen,
// which turns the "-0.000" a tiny negative rounds to into "0.000"; the
// unit-less directions of the summary, the normals in a construction's
// description and the degrees of a verdict were written with a bare
// toFixed, so a plane normal fitted at (2e-6, -3e-6, 1) read
// "(0.0000, -0.0000, 1.0000)" and an angle 0.002° under its nominal
// "Δ -0.00°" — a sign on a figure that shows nothing to carry it.
import { describe, expect, it } from 'vitest'
import { judgeLimit } from '../src/core/dimensions'
import { describeConstruction } from '../src/core/elements/construct'
import { buildSummary } from '../src/core/summary'
import type { PlaneFit } from '../src/core/types'

describe('no negative zero in the readouts', () => {
  it('in a verdict in degrees', () => {
    const v = judgeLimit(29.998, { kind: 'band', nominal: 30, plus: 0.5, minus: 0.5 }, '°')
    expect(v.delta).toBe('Δ 0.00°')
    expect(judgeLimit(30.004, { kind: 'max', max: 30 }, '°').delta).toBe('Δ +0.00°')
  })

  it('in a direction of the summary', () => {
    const fit: PlaneFit = {
      kind: 'plane',
      center: [0, 0, 0],
      normal: [2e-6, -3e-6, 1],
      basisU: [1, 0, 0],
      basisV: [0, 1, 0],
      extentU: 5,
      extentV: 5,
      sigma: 0.01,
      usedPoints: 100,
      regionSize: 100,
    }
    const text = buildSummary('part.stl', [{ id: 1, name: 'Plane 1', kind: 'plane', source: { type: 'picked' }, fit }], [])
    expect(text).toContain('normal: (0.0000, 0.0000, 1.0000)')
    expect(text).not.toMatch(/-0\.0000/)
  })

  it('in the normal a construction is described with', () => {
    expect(describeConstruction('plane-coords', [], [-1e-5, 0, 1, 0, 0, 0])).toBe(
      'normal (0.000, 0.000, 1.000) through (0.000, 0.000, 0.000)',
    )
  })
})
