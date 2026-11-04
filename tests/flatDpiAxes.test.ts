// SPDX-License-Identifier: AGPL-3.0-only
// Audit (flat): the report's and the CSV's traceability line said only the X
// resolution of a file whose metadata declares different X and Y resolutions
// (a PNG pHYs chunk or a JFIF header carries the two apart, and the sheet
// measures with both). A scan declared 600 × 300 dpi read "nominal 600 dpi",
// so a reader of the report could not tell that every Y length rests on 300.
// The line must name both, as the calibrated line already does.

import { describe, expect, it } from 'vitest'
import { buildFlatCsv, buildFlatReport, scaleLine, type FlatReportInput } from '../src/core/flat/report'

const base: FlatReportInput = {
  imageName: 'scan.png',
  imageWidth: 100,
  imageHeight: 100,
  calSource: 'metadata',
  pxPerMm: { x: 600 / 25.4, y: 300 / 25.4 },
  datum: null,
  frame: null,
  unit: 'mm',
  elements: [],
  dimensions: [],
}

describe('the nominal scale line', () => {
  it('names both resolutions when the file declares them apart', () => {
    const line = scaleLine(base)
    expect(line).toMatch(/600/)
    expect(line).toMatch(/300/)
    expect(buildFlatReport(base)).toMatch(/300/)
    expect(buildFlatCsv(base).split('\n')[0]).toMatch(/300/)
  })

  it('keeps the single figure for a square resolution', () => {
    expect(scaleLine({ ...base, pxPerMm: { x: 600 / 25.4, y: 600 / 25.4 } })).toBe(
      'Scale: UNCALIBRATED — nominal 600 dpi from file metadata',
    )
  })
})
