// SPDX-License-Identifier: AGPL-3.0-only
// Number fields that take a value as it is typed (issue 81): each prefix a
// person types on the way to a value has to be left alone rather than taken,
// refused into something else, or clamped — or the field is rewritten under
// the hand. readTyped decides which texts pass a value on; replaying a typed
// value key by key shows every field can be typed into from empty.
import { describe, expect, it } from 'vitest'
import { readTyped, type TypedRule } from '../src/ui/typedNumber'

/** What a field following readTyped holds after `text` is typed key by key
 *  from empty: the last value passed on, `start` if none was. */
function typeInto(text: string, rule: TypedRule, start: number | null): number | null {
  let held = start
  for (let i = 1; i <= text.length; i++) {
    const r = readTyped(text.slice(0, i), rule)
    if (r.ok) held = r.value
  }
  return held
}

describe('typing a number into a field that takes values as they come', () => {
  const tolerance: TypedRule = { above: 0, emptyIsNone: true }
  it('the fit tolerance takes 0.05 — and 0,05 typed as the field reports it (issue 81)', () => {
    expect(typeInto('0.05', tolerance, null)).toBe(0.05)
    expect(typeInto('0.005', tolerance, 0.2)).toBe(0.005)
    expect(typeInto('0.1', tolerance, null)).toBe(0.1)
    expect(typeInto('1.5', tolerance, 0.3)).toBe(1.5)
  })
  it('the half-typed prefixes pass nothing on', () => {
    for (const t of ['0', '0.', '0.0', '-', '.', 'e']) expect(readTyped(t, tolerance)).toEqual({ ok: false })
  })
  it('blank is auto where the field says so, and nothing yet elsewhere', () => {
    expect(readTyped('', tolerance)).toEqual({ ok: true, value: null })
    expect(readTyped('', { min: 1 })).toEqual({ ok: false })
  })
  it('a count with a least value takes the numbers that start under it', () => {
    const sides: TypedRule = { integer: true, min: 3, max: 64 }
    expect(typeInto('12', sides, 6)).toBe(12)
    expect(typeInto('10', sides, 6)).toBe(10)
    expect(typeInto('64', sides, 6)).toBe(64)
    expect(typeInto('65', sides, 6)).toBe(6) // 6 is too few to have started, 65 too many
    const spans: TypedRule = { integer: true, min: 2, max: 20 }
    expect(typeInto('12', spans, 4)).toBe(12)
    expect(typeInto('20', spans, 4)).toBe(20)
    expect(readTyped('2.5', spans)).toEqual({ ok: false })
  })
  it('a port is typed from empty', () => {
    expect(typeInto('8123', { integer: true, min: 1, max: 65535 }, 50005)).toBe(8123)
    expect(readTyped('70000', { integer: true, min: 1, max: 65535 })).toEqual({ ok: false })
  })
  it('degrees above zero take 0.5', () => {
    expect(typeInto('0.5', { above: 0 }, 5)).toBe(0.5)
  })
})
