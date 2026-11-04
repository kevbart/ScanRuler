// SPDX-License-Identifier: AGPL-3.0-only
// Audit (reverse): reverse.body.describe gives every cylindrical face a
// `length` along its axis, read off its area as area / (2πr) — the length
// of a FULL round face. A fillet's face is a quarter of a cylinder, and its
// area is (π/2)·r·L, so that reading gave a quarter of its length: a 2 mm
// round along a 20 mm edge was described as 5 mm long. A round face that
// does not go the whole way round is measured along its axis instead (the
// span of its own triangles there); a full one keeps area / (2πr), exact
// for a plain bore or boss.

import { describe, expect, it, vi } from 'vitest'
import { Builder } from '../core/build'
import { ReKernel } from '../core/kernel'
import { addEntity, emptySketch } from '../core/sketch'
import type { SketchFeature } from '../core/features'
import { faceOut } from '../app/reReadout'
import { build, extrudeAll, rectangleSketch, XY } from './reKit'

vi.setConfig({ testTimeout: 180_000 })
const kernelPromise = ReKernel.load()

describe('a round face described with its length along its axis', () => {
  it('a fillet’s quarter round reads the edge’s length, a full boss its height', async () => {
    const builder = new Builder(await kernelPromise)
    const s = rectangleSketch(1, 10, 20)
    const first = await build(builder, [s, extrudeAll(2, s, 0, 5)])
    const edge = first.bodies[0].topology.edges.find((e) => Math.abs(e.fingerprint.length - 20) < 1e-6 && e.fingerprint.mid[2] > 4)!.fingerprint
    const rounded = await build(builder, [s, extrudeAll(2, s, 0, 5), { id: 3, kind: 'fillet', name: 'Fillet 1', body: 2, edges: [edge], radius: 2, chain: false, visible: true }])
    const body = rounded.bodies[0]
    const i = body.topology.faces.findIndex((f) => f.fingerprint.kind === 'cylinder')
    expect(i).toBeGreaterThanOrEqual(0)
    const round = faceOut(body.topology.faces[i], i, body.mesh)
    expect(round.radius).toBeCloseTo(2, 6)
    expect(round.length).toBeCloseTo(20, 3)

    const cs = emptySketch()
    addEntity(cs, { kind: 'circle', c: [0, 0], r: 3 })
    const circle: SketchFeature = { id: 1, kind: 'sketch', name: 'Sketch 1', plane: { kind: 'world', axis: 'z', offset: 0 }, frame: XY, sketch: cs, visible: true }
    const boss = (await build(builder, [circle, extrudeAll(2, circle, 0, 10)])).bodies[0]
    const j = boss.topology.faces.findIndex((f) => f.fingerprint.kind === 'cylinder')
    expect(faceOut(boss.topology.faces[j], j, boss.mesh).length).toBeCloseTo(10, 6)
    // With no mesh to measure on, a partial round says no length rather
    // than a wrong one.
    expect(faceOut(body.topology.faces[i], i, undefined).length).toBeUndefined()
    builder.dispose()
  })
})
