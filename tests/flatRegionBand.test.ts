// SPDX-License-Identifier: AGPL-3.0-only
// Audit (flat): the "from edge region" fits vote strays out with an inlier
// band whose floor was a fixed 0.35 in document units. The floor is there to
// keep subpixel scatter (a fraction of an image pixel) from being culled, so
// it is a pixel quantity — but the fits run in millimetres once a scale is
// set, where 0.35 is 0.35 mm: eight pixels at 600 dpi. A neighbouring edge a
// few pixels away then passes as inliers and drags the fit across. The same
// picks must give the same geometry whatever the scale (a scale only maps
// px -> mm), so the expected answer is the pixel fit divided by px/mm.

import { describe, expect, it } from 'vitest'
import { evaluateFlatSource } from '../src/core/flat/elements'
import type { FlatCircleFit, FlatLineFit, Vec2 } from '../src/core/flat/types'
import { mulberry32 } from '../src/core/fit/ransac'

const PX_PER_MM = 600 / 25.4 // a 600 dpi scan

describe('region fits are scale-invariant', () => {
  it('a line region votes out a second edge 6 px away whether or not a scale is set', () => {
    const rand = mulberry32(11)
    const picks: Vec2[] = []
    // The measured edge: y = 50 px with subpixel scatter…
    for (let i = 0; i < 200; i++) picks.push([i * 0.5, 50 + (rand() - 0.5) * 0.1])
    // …and a neighbouring edge 6 px (0.25 mm) away caught by the drag.
    for (let i = 0; i < 60; i++) picks.push([i * 1.5, 56 + (rand() - 0.5) * 0.1])
    const source = { type: 'picks' as const, method: 'flat-line-edge', picks }

    const px = evaluateFlatSource(source, null, () => null) as FlatLineFit
    expect(Math.abs(px.center[1] - 50)).toBeLessThan(0.1)

    const mm = evaluateFlatSource(source, { x: PX_PER_MM, y: PX_PER_MM }, () => null) as FlatLineFit
    // The same edge in millimetres: 50 px / 23.62 px/mm, to the same 0.1 px.
    expect(Math.abs(mm.center[1] - 50 / PX_PER_MM)).toBeLessThan(0.1 / PX_PER_MM)
    expect(mm.usedPoints).toBe(px.usedPoints)
  })

  it('a circle region votes out a nearby straight edge whether or not a scale is set', () => {
    const rand = mulberry32(5)
    const picks: Vec2[] = []
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * 2 * Math.PI
      picks.push([100 + 40 * Math.cos(a) + (rand() - 0.5) * 0.1, 80 + 40 * Math.sin(a) + (rand() - 0.5) * 0.1])
    }
    // A concentric ring 5 px outside the bore (a chamfer's outer edge),
    // caught over a third of the way round.
    for (let i = 0; i < 40; i++) {
      const a = (i / 120) * 2 * Math.PI
      picks.push([100 + 45 * Math.cos(a) + (rand() - 0.5) * 0.1, 80 + 45 * Math.sin(a) + (rand() - 0.5) * 0.1])
    }
    const source = { type: 'picks' as const, method: 'flat-circle-edge', picks }
    const px = evaluateFlatSource(source, null, () => null) as FlatCircleFit
    expect(Math.abs(px.radius - 40)).toBeLessThan(0.05)
    const mm = evaluateFlatSource(source, { x: PX_PER_MM, y: PX_PER_MM }, () => null) as FlatCircleFit
    expect(Math.abs(mm.radius - 40 / PX_PER_MM)).toBeLessThan(0.05 / PX_PER_MM)
    expect(mm.usedPoints).toBe(px.usedPoints)
  })
})
