// SPDX-License-Identifier: AGPL-3.0-only
// The circle and sphere fits claim to be the Gaussian (least-squares,
// orthogonal-distance) best fit, but polished the algebraic start with the
// fixed-point iteration c <- mean(p) - r * mean(u), which converges linearly
// at a rate that tends to 1 as the arc or cap shrinks. It stopped at its
// iteration cap (100 for the circle, 150 for the sphere) far from the
// minimum: on a 30° arc of a Ø 20 circle with 0.02 noise it reported
// r = 9.616 where the least-squares circle has r = 9.946, on a 15° cap of a
// Ø 20 ball r = 9.643 against 10.051 — a diameter 0.7 mm off on a scan
// whose noise is 0.02.
//
// What is checked is the definition itself, not a reference number: at the
// least-squares minimum the gradient of sum(e²) vanishes — sum(e) = 0 (the
// radius) and sum(e·û) = 0 (the centre) — and no model, the generating one
// included, has a smaller RMS. The radius is then held within a tolerance
// derived from the minimum the probe found (|r - 10| < 0.1 here).
import { describe, expect, it } from 'vitest'
import { fitCircle2d } from '../src/core/fit/circle2d'
import { circleFromPoints } from '../src/core/fit/circle'
import { fitSphereClipped } from '../src/core/fit/sphere'
import { mulberry32 } from '../src/core/fit/ransac'
import type { Vec3 } from '../src/core/types'
import { gaussian, sampleSphere } from './helpers'

function arc(arcDeg: number, noise: number, n = 500, seed = 3): { u: Float64Array; v: Float64Array } {
  const rand = mulberry32(seed)
  const u = new Float64Array(n)
  const v = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = ((rand() - 0.5) * arcDeg * Math.PI) / 180
    const r = 10 + gaussian(rand) * noise
    u[i] = 50 + r * Math.cos(a)
    v[i] = -20 + r * Math.sin(a)
  }
  return { u, v }
}

/** RMS residual and the normalised gradient of sum(e²) of a 2D circle. */
function circleStats(u: Float64Array, v: Float64Array, cu: number, cv: number, r: number) {
  let ss = 0, ge = 0, gu = 0, gv = 0
  for (let i = 0; i < u.length; i++) {
    const du = u[i] - cu, dv = v[i] - cv
    const d = Math.hypot(du, dv)
    const e = d - r
    ss += e * e
    ge += e
    gu += (e * du) / d
    gv += (e * dv) / d
  }
  const n = u.length
  return { rms: Math.sqrt(ss / n), grad: Math.hypot(ge, gu, gv) / n }
}

function sphereStats(p: Float32Array, c: Vec3, r: number) {
  let ss = 0, ge = 0, gx = 0, gy = 0, gz = 0
  const n = p.length / 3
  for (let i = 0; i < n; i++) {
    const dx = p[3 * i] - c[0], dy = p[3 * i + 1] - c[1], dz = p[3 * i + 2] - c[2]
    const d = Math.hypot(dx, dy, dz)
    const e = d - r
    ss += e * e
    ge += e
    gx += (e * dx) / d
    gy += (e * dy) / d
    gz += (e * dz) / d
  }
  return { rms: Math.sqrt(ss / n), grad: Math.hypot(ge, gx, gy, gz) / n }
}

describe('circle fit on a short arc is the least-squares circle', () => {
  for (const arcDeg of [20, 30, 45]) {
    it(`${arcDeg}° arc, noise 0.02`, () => {
      const { u, v } = arc(arcDeg, 0.02)
      const f = fitCircle2d(u, v)!
      const at = circleStats(u, v, f.cu, f.cv, f.r)
      const truth = circleStats(u, v, 50, -20, 10)
      // The minimum's gradient is zero to round-off; the fixed point left
      // it at 1e-4 and more.
      expect(at.grad).toBeLessThan(1e-8)
      expect(at.rms).toBeLessThanOrEqual(truth.rms)
      expect(Math.abs(f.r - 10)).toBeLessThan(0.15)
    })
  }

  it('a picked circle along 30° of arc in 3D', () => {
    const rand = mulberry32(5)
    const pts: Vec3[] = []
    for (let i = 0; i < 400; i++) {
      const a = ((rand() - 0.5) * 30 * Math.PI) / 180
      const r = 10 + gaussian(rand) * 0.02
      pts.push([5 + r * Math.cos(a), 7, -3 + r * Math.sin(a)])
    }
    const f = circleFromPoints(pts)
    expect(Math.abs(f.radius - 10)).toBeLessThan(0.15)
  })
})

describe('sphere fit on a small cap is the least-squares sphere', () => {
  for (const capDeg of [15, 20]) {
    it(`${capDeg}° cap, noise 0.02`, () => {
      const pts = sampleSphere(4000, [100, 200, 300], 10, 0.02, 7, (capDeg * Math.PI) / 180)
      const idx = Uint32Array.from({ length: 4000 }, (_, i) => i)
      const f = fitSphereClipped(pts, idx, 0)!
      const s = f.sphere
      const at = sphereStats(pts, [s.cx, s.cy, s.cz], s.r)
      const truth = sphereStats(pts, [100, 200, 300], 10)
      expect(at.grad).toBeLessThan(1e-8)
      expect(at.rms).toBeLessThanOrEqual(truth.rms)
      expect(Math.abs(s.r - 10)).toBeLessThan(0.1)
    })
  }

  it('the free diameter reported beside a held one is the least-squares one too', () => {
    const pts = sampleSphere(4000, [0, 0, 0], 10, 0.02, 7, (15 * Math.PI) / 180)
    const idx = Uint32Array.from({ length: 4000 }, (_, i) => i)
    const f = fitSphereClipped(pts, idx, 0, 10)!
    expect(f.sphere.r).toBe(10)
    const free = f.free!
    expect(sphereStats(pts, [free.cx, free.cy, free.cz], free.r).grad).toBeLessThan(1e-8)
    expect(Math.abs(free.r - 10)).toBeLessThan(0.1)
  })
})
