// SPDX-License-Identifier: AGPL-3.0-only
// A number with its unit, committed on blur or Enter so a half-typed "0."
// never re-scales a map mid-keystroke. Shared by every workspace that puts a
// figure in front of the user to change.
//
// A length (kind="length") is held in millimetres and shown and typed in the
// display units: the field converts both ways, writes the unit itself, and
// takes step and min in millimetres like the value.

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useUnits } from '../app/useUnits'
import { fromDisplay, lengthInputText, lengthStep, toDisplay, unitWord, type DisplayUnits } from '../core/units'
import { InfoDot } from './InfoDot'
import { readTyped, type TypedRule } from './typedNumber'

/**
 * A number input that changes its value live — every key, the spinner — and
 * can still be typed into when the value is clamped or refused: the text stays
 * the hand's while the field is in use, only a value `rule` takes as it stands
 * reaches `onValue` (in what was typed: display units for a length), and the
 * field shows `shown` again once it is left. `onDone` runs on leaving it
 * (blur, or Enter). See typedNumber.ts for why a plain controlled field cannot.
 */
export function TypedNumberInput({
  shown,
  rule,
  onValue,
  onDone,
  ...input
}: {
  shown: string
  rule: TypedRule
  onValue: (typed: number | null) => void
  onDone?: () => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...input}
      type="number"
      value={draft ?? shown}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        const typed = readTyped(text, rule)
        if (typed.ok) onValue(typed.value)
      }}
      onBlur={() => {
        setDraft(null)
        onDone?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        input.onKeyDown?.(e)
      }}
    />
  )
}

/** What a field shows and accepts, given what it holds: the conversion a
 *  length field makes, or none. */
export interface FieldUnits {
  text: (held: number) => string
  read: (typed: number) => number
  step: (step: number | 'any') => number | 'any'
  min: (min: number) => number
  word: string
}

const plain = (unit: string): FieldUnits => ({
  text: String,
  read: (v) => v,
  step: (s) => s,
  min: (m) => m,
  word: unit,
})

export function lengthField(units: DisplayUnits): FieldUnits {
  return {
    text: (mm) => lengthInputText(mm, units),
    read: (v) => fromDisplay(v, units),
    step: (s) => (s === 'any' ? s : lengthStep(s, units)),
    min: (m) => (Number.isFinite(m) ? toDisplay(m, units) : m),
    word: unitWord(units),
  }
}

/** The conversion for a field of `kind`, with the units read from the
 *  preference. Called on every render, in the same order, either way. */
export function useFieldUnits(kind: 'length' | undefined, unit: string | undefined): FieldUnits {
  const units = useUnits()
  return kind === 'length' ? lengthField(units) : plain(unit ?? '')
}

export function NumberField({
  label,
  value,
  step,
  min,
  unit,
  kind,
  disabled,
  onCommit,
  hint,
  testId,
}: {
  label: string
  value: number
  step: number | 'any'
  min: number
  /** The unit word for a figure that is not a length — a length's field
   *  writes its own. */
  unit?: string
  /** 'length': value, step and min are millimetres, shown in the display
   *  units. */
  kind?: 'length'
  disabled?: boolean
  onCommit: (v: number) => void
  /** What the number does, on the ⓘ key beside its label. */
  hint?: ReactNode
  testId?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const u = useFieldUnits(kind, unit)
  const shown = u.text(value)
  return (
    <label className="field">
      <span>
        {label}
        {hint !== undefined && <InfoDot title={label}>{hint}</InfoDot>}
      </span>
      <span className="unitfield">
        <input
          ref={ref}
          type="number"
          data-test={testId}
          step={u.step(step)}
          min={u.min(min)}
          disabled={disabled}
          defaultValue={shown}
          key={shown}
          onBlur={(e) => {
            // Text left as it was shown commits nothing: in inches the shown
            // figure is rounded, and committing it back would move the value.
            if (e.target.value !== shown) {
              const v = u.read(Number(e.target.value))
              if (Number.isFinite(v) && v >= min) onCommit(v)
            }
            // Rewrite the text either way: when the store clamps the commit
            // back to the value already held, nothing re-renders, and the
            // rejected text would otherwise stay on screen. A commit that
            // does change the value re-keys the input over this.
            e.target.value = shown
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ref.current?.blur()
          }}
        />
        <i>{u.word}</i>
      </span>
    </label>
  )
}
