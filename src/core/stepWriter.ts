// SPDX-License-Identifier: AGPL-3.0-only
// The Part 21 primitives both STEP writers are built from: number and string
// formatting to the letter of ISO 10303-21, an entity table that hands out its
// own instance names, and the placements every piece of geometry is hung on.
// All coordinates are millimetres, angles radians.

import type { Vec3 } from './types'

/** A STEP real: always carries a decimal point, exponent uppercased. */
export function num(v: number): string {
  if (!Number.isFinite(v) || Object.is(v, -0)) v = 0
  let s = v.toPrecision(12)
  if (s.includes('e') || s.includes('E')) {
    const [mantRaw, expRaw] = s.toLowerCase().split('e')
    let mant = trimZeros(mantRaw)
    if (!mant.includes('.')) mant += '.'
    return `${mant}E${expRaw}`
  }
  s = trimZeros(s)
  if (!s.includes('.')) s += '.'
  return s
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '')
}

export function vec(v: Vec3): string {
  return `${num(v[0])},${num(v[1])},${num(v[2])}`
}

/** STEP string literal payload, to ISO 10303-21 §6.4.3: quotes and
 *  backslashes doubled, and every character outside printable ASCII — all an
 *  exchange structure may hold — written with the \X2\ (UTF-16) or, past the
 *  basic plane, \X4\ (UTF-32) directive, closed by \X0\. Replacing them with
 *  '?' instead lost the user's names: "Fläche Ø12" reached CAD as
 *  "Fl?che ?12", and two names that differed only there became one. */
export function esc(s: string): string {
  let out = ''
  let run: string[] = []
  let runKind = ''
  const close = () => {
    if (run.length > 0) out += `\\${runKind}\\${run.join('')}\\X0\\`
    run = []
  }
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code >= 0x20 && code <= 0x7e) {
      close()
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch
      continue
    }
    const kind = code > 0xffff ? 'X4' : 'X2'
    if (kind !== runKind) close()
    runKind = kind
    // A lone surrogate names no character; U+FFFD says so.
    const unit = code >= 0xd800 && code <= 0xdfff ? 0xfffd : code
    run.push(unit.toString(16).toUpperCase().padStart(kind === 'X4' ? 8 : 4, '0'))
  }
  close()
  return out
}

export class StepWriter {
  lines: string[] = []
  private id = 0

  add(entity: string): number {
    const id = ++this.id
    this.lines.push(`#${id}=${entity};`)
    return id
  }
}

export function point(w: StepWriter, p: Vec3): number {
  return w.add(`CARTESIAN_POINT('',(${vec(p)}))`)
}

export function direction(w: StepWriter, d: Vec3): number {
  return w.add(`DIRECTION('',(${vec(d)}))`)
}

/** Location + z axis + x reference direction. */
export function placement(w: StepWriter, origin: Vec3, z: Vec3, x: Vec3): number {
  const o = point(w, origin)
  const az = direction(w, z)
  const ax = direction(w, x)
  return w.add(`AXIS2_PLACEMENT_3D('',#${o},#${az},#${ax})`)
}
