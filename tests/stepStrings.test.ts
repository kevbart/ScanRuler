// SPDX-License-Identifier: AGPL-3.0-only
// STEP strings outside printable ASCII. ISO 10303-21 allows only the
// characters 0x20–0x7E in an exchange structure; anything else in a string
// is written with the \X2\ (UTF-16) or \X4\ (UTF-32) directive, closed by
// \X0\ (ISO 10303-21:2002 §6.4.3.3). The writer replaced every such
// character with '?', so an element named "Fläche Ø12" reached CAD as
// "Fl?che ?12" — the user's name lost, and two names differing only there
// merged into one — and the product description carried a raw em dash, a
// byte the file's own '2;1' conformance level forbids. Expected: the file is
// pure printable ASCII and every name decodes back exactly.

import { describe, expect, it } from 'vitest'
import { parseStepHeader } from 'meshstep'
import { buildStepFile } from '../src/core/exportStep'
import { esc } from '../src/core/stepWriter'
import type { PointFit, SphereFit } from '../src/core/types'

const NO_STATS = { sigma: 0, usedPoints: 0, regionSize: 0 }
const point: PointFit = { kind: 'point', center: [1, 2, 3], ...NO_STATS }
const sphere: SphereFit = { kind: 'sphere', center: [0, 0, 0], radius: 5, ...NO_STATS }

/** A Part 21 string payload decoded by the standard's rules — written here
 *  from §6.4.3 rather than borrowed, so the writer is checked against the
 *  text and not against itself. */
function decode(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; ) {
    if (s.startsWith("''", i)) { out += "'"; i += 2; continue }
    if (s.startsWith('\\\\', i)) { out += '\\'; i += 2; continue }
    const wide = s.startsWith('\\X2\\', i) ? 4 : s.startsWith('\\X4\\', i) ? 8 : 0
    if (wide) {
      const end = s.indexOf('\\X0\\', i + 4)
      const hex = s.slice(i + 4, end)
      for (let k = 0; k < hex.length; k += wide) {
        const unit = parseInt(hex.slice(k, k + wide), 16)
        out += wide === 4 ? String.fromCharCode(unit) : String.fromCodePoint(unit)
      }
      i = end + 4
      continue
    }
    out += s[i++]
  }
  return out
}

const NAMES = ['Fläche Ø12', 'Bohrung ⌀ 8 – oben', "it's \\ odd", 'Ebene 😀 1', 'plain']

describe('STEP strings carry every character', () => {
  it('encodes non-ASCII with \\X2\\ / \\X4\\ and decodes back exactly', () => {
    for (const name of NAMES) {
      const e = esc(name)
      expect(e).toMatch(/^[\x20-\x7e]*$/)
      expect(decode(e)).toBe(name)
    }
  })

  it('writes a file that is printable ASCII only, names intact', () => {
    const text = buildStepFile(
      NAMES.map((name, i) => ({ name, fit: i % 2 ? sphere : point })),
      'Prüfteil Ø40.stl',
      '2026-08-16T12:00:00',
      'solids',
    )
    // Newlines separate records; every other byte must be 0x20–0x7E.
    for (const line of text.split('\n')) expect(line).toMatch(/^[\x20-\x7e]*$/)
    for (const name of NAMES) expect(text).toContain(`'${esc(name)}'`)
    // The header reads back through an independent Part 21 reader.
    expect(parseStepHeader(text).name).toBe('Prüfteil Ø40.stl')
  })

  it('keeps two names that differ only outside ASCII apart', () => {
    expect(esc('Ø10')).not.toBe(esc('⌀10'))
  })
})
