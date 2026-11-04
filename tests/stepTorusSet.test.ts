// SPDX-License-Identifier: AGPL-3.0-only
// A torus in the construction-surfaces STEP form. The writer chose between a
// GEOMETRIC_SET (surfaces allowed) and a GEOMETRIC_CURVE_SET (points and
// curves only) by a list of surface kinds that had no 'torus' in it — so a
// file whose only surfaces are tori (a fillet measured on its own, with a
// point or a line beside it) put a RECTANGULAR_TRIMMED_SURFACE inside a
// GEOMETRIC_CURVE_SET under a GEOMETRICALLY_BOUNDED_WIREFRAME_SHAPE_
// REPRESENTATION. ISO 10303-42's GEOMETRIC_CURVE_SET WHERE rule forbids a
// surface among its elements; a reader holding to it drops the torus or the
// file. Expected: the surface set and the surface representation, exactly as
// for a lone cylinder.

import { describe, expect, it } from 'vitest'
import { buildStepFile } from '../src/core/exportStep'
import type { PointFit, TorusFit } from '../src/core/types'

const NO_STATS = { sigma: 0, usedPoints: 0, regionSize: 0 }
const torus: TorusFit = { kind: 'torus', center: [0, 0, 0], axis: [0, 0, 1], majorRadius: 10, minorRadius: 2, tubeCoverage: 90, spineCoverage: 360, ...NO_STATS }
const point: PointFit = { kind: 'point', center: [1, 2, 3], ...NO_STATS }

describe('a torus in the construction-surfaces form', () => {
  for (const elements of [[{ name: 'Fillet', fit: torus }], [{ name: 'Fillet', fit: torus }, { name: 'Point', fit: point }]]) {
    it(`goes in a surface set (${elements.length} element${elements.length > 1 ? 's' : ''})`, () => {
      const text = buildStepFile(elements, 'scan.stl', '2026-08-16T12:00:00', 'surfaces')
      expect(text).toMatch(/RECTANGULAR_TRIMMED_SURFACE\('Fillet',#\d+,/)
      expect(text).toContain("GEOMETRIC_SET('elements'")
      expect(text).not.toContain('GEOMETRIC_CURVE_SET(')
      expect(text).toContain('GEOMETRICALLY_BOUNDED_SURFACE_SHAPE_REPRESENTATION')
      expect(text).not.toContain('GEOMETRICALLY_BOUNDED_WIREFRAME_SHAPE_REPRESENTATION')
    })
  }
})
