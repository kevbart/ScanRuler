// SPDX-License-Identifier: AGPL-3.0-only
// What a number field may take from the text in it, as it is typed.
//
// A field that hands every keystroke to the store, and shows back what the
// store made of it, cannot be typed into once the store clamps or refuses: the
// "0" that starts 0.05 is not above zero, the "1" that starts 12 is under a
// minimum of 2, and the field is rewritten under the hand — 0.05 became 5
// (issue 81), 12 sides became 6 then 62. So the text stays the hand's, and only
// a value the rule takes as it stands is passed on; anything else waits for
// more keys, and the field shows the held value again once it is left
// (TypedNumberInput, in NumberField.tsx).

export interface TypedRule {
  /** The least value taken. */
  min?: number
  /** Values must be greater than this, not equal to it. */
  above?: number
  /** The greatest value taken. */
  max?: number
  /** Whole numbers only. */
  integer?: boolean
  /** An empty field means "none" (null) — "auto", say — rather than nothing
   *  yet. */
  emptyIsNone?: boolean
}

export type Typed = { ok: true; value: number | null } | { ok: false }

/** The value `text` stands for under `rule`, or `{ ok: false }` while it is
 *  not one the field takes — half typed, out of range — and is left as it is. */
export function readTyped(text: string, rule: TypedRule = {}): Typed {
  const t = text.trim()
  if (t === '') return rule.emptyIsNone ? { ok: true, value: null } : { ok: false }
  const v = Number(t)
  if (!Number.isFinite(v)) return { ok: false }
  if (rule.integer && !Number.isInteger(v)) return { ok: false }
  if (rule.min !== undefined && v < rule.min) return { ok: false }
  if (rule.above !== undefined && !(v > rule.above)) return { ok: false }
  if (rule.max !== undefined && v > rule.max) return { ok: false }
  return { ok: true, value: v }
}
