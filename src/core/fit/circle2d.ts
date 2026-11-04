// SPDX-License-Identifier: AGPL-3.0-only
// The 2D circle kernel: the best circle through points given in plane
// coordinates. Every circle this tool fits comes through here — the picked
// circle element after projecting onto its total-least-squares plane, and the
// cylinder pipeline in the plane across its axis. It stands alone so that a
// fit working in a plane from the start (a flatbed scan, a section through a
// mesh) can use it without inventing a third dimension first.

import { solveLinear } from './linalg'

export interface Circle2d {
  cu: number
  cv: number
  r: number
}

/**
 * Best-fit circle through 2D points — algebraic (Coope) start, exactly
 * determined for three points and least squares beyond, then damped
 * Gauss–Newton to the orthogonal-distance minimum (a no-op for three points).
 * Null when the points do not determine a circle.
 */
export function fitCircle2d(pu0: ArrayLike<number>, pv0: ArrayLike<number>): Circle2d | null {
  const n = pu0.length
  if (n < 3) return null

  // Work about the centroid. The normal equations carry fourth powers of the
  // coordinates, and a short arc a few thousand units from the origin (image
  // pixels on a scan) cancels them to round-off — the fit would come back
  // null for points that define a circle perfectly well.
  let mu = 0, mv = 0
  for (let i = 0; i < n; i++) {
    mu += pu0[i]
    mv += pv0[i]
  }
  mu /= n
  mv /= n
  const pu = new Float64Array(n)
  const pv = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    pu[i] = pu0[i] - mu
    pv[i] = pv0[i] - mv
  }

  // Algebraic (Coope) circle, solved directly — the 3×3 normal equations.
  let suu = 0, suv = 0, svv = 0, su = 0, sv = 0, sub = 0, svb = 0, sb = 0
  for (let i = 0; i < n; i++) {
    const b = pu[i] * pu[i] + pv[i] * pv[i]
    suu += pu[i] * pu[i]
    suv += pu[i] * pv[i]
    svv += pv[i] * pv[i]
    su += pu[i]
    sv += pv[i]
    sub += pu[i] * b
    svb += pv[i] * b
    sb += b
  }
  const a = new Float64Array([
    4 * suu, 4 * suv, 2 * su,
    4 * suv, 4 * svv, 2 * sv,
    2 * su, 2 * sv, n,
  ])
  const sol = solveLinear(3, a, new Float64Array([2 * sub, 2 * svb, sb]))
  if (!sol) return null
  let cu = sol[0]
  let cv = sol[1]
  const r2 = sol[2] + cu * cu + cv * cv
  if (!(r2 > 0) || !Number.isFinite(r2)) return null
  let r = Math.sqrt(r2)

  // Orthogonal-distance refinement: damped Gauss–Newton on Σ(|p − c| − r)²
  // over the centre and the radius together. Not the fixed-point iteration
  // c ← p̄ − r·ū, which converges at a rate that goes to 1 as the arc gets
  // shorter: on 30° of a noisy arc it stopped, iteration cap reached, with
  // the radius several noise widths off the least-squares one.
  const refined = refineCircle2d(pu, pv, { cu, cv, r })
  cu = refined.cu
  cv = refined.cv
  r = refined.r
  if (!Number.isFinite(cu) || !Number.isFinite(cv) || !Number.isFinite(r) || !(r > 0)) return null

  return { cu: cu + mu, cv: cv + mv, r }
}

/** Sum of squared orthogonal residuals of a circle, points at its centre
 *  left out. */
function circleCost(pu: Float64Array, pv: Float64Array, c: Circle2d): number {
  let ss = 0
  for (let i = 0; i < pu.length; i++) {
    const d = Math.hypot(pu[i] - c.cu, pv[i] - c.cv)
    if (d < 1e-12) continue
    ss += (d - c.r) ** 2
  }
  return ss
}

/** Levenberg–Marquardt on the three circle parameters: each step solves the
 *  damped normal equations, is kept only when it lowers the cost, and the
 *  damping eases off after a kept step and stiffens after a refused one.
 *  Gauss–Newton converges quadratically near the minimum however short the
 *  arc, where the fixed-point iteration crawls. */
function refineCircle2d(pu: Float64Array, pv: Float64Array, init: Circle2d): Circle2d {
  let c = init
  let cost = circleCost(pu, pv, c)
  if (!Number.isFinite(cost)) return init
  let lambda = 1e-6
  for (let iter = 0; iter < 100 && cost > 0; iter++) {
    const jtj = new Float64Array(9)
    const jte = new Float64Array(3)
    for (let i = 0; i < pu.length; i++) {
      const du = pu[i] - c.cu
      const dv = pv[i] - c.cv
      const d = Math.hypot(du, dv)
      if (d < 1e-12) continue
      // The residual's gradient is (−du/d, −dv/d, −1); spelled out rather
      // than held in an array, as this runs per point per step and the
      // cylinder, cone and torus seeds all come through here.
      const e = d - c.r
      const gu = -du / d, gv = -dv / d
      jte[0] += gu * e; jte[1] += gv * e; jte[2] -= e
      jtj[0] += gu * gu; jtj[1] += gu * gv; jtj[2] -= gu
      jtj[4] += gv * gv; jtj[5] -= gv
      jtj[8] += 1
    }
    jtj[3] = jtj[1]; jtj[6] = jtj[2]; jtj[7] = jtj[5] // symmetric: the lower half from the upper
    let kept = false
    let done = false
    for (let attempt = 0; attempt < 8; attempt++) {
      const mat = jtj.slice()
      for (let a = 0; a < 3; a++) mat[a * 3 + a] *= 1 + lambda
      const step = solveLinear(3, mat, Float64Array.from(jte, (x) => -x))
      if (!step) {
        lambda *= 10
        continue
      }
      const cand = { cu: c.cu + step[0], cv: c.cv + step[1], r: c.r + step[2] }
      const candCost = cand.r > 0 ? circleCost(pu, pv, cand) : Infinity
      if (Number.isFinite(candCost) && candCost <= cost) {
        done = cost - candCost <= 1e-15 * cost || Math.hypot(step[0], step[1], step[2]) < 1e-13 * Math.max(1, cand.r)
        c = cand
        cost = candCost
        lambda = Math.max(lambda * 0.3, 1e-12)
        kept = true
        break
      }
      lambda *= 10
    }
    if (!kept || done) break
  }
  return c
}
