// SPDX-License-Identifier: AGPL-3.0-only
// Issue 83: a project saved twice into the same folder comes back from the
// browser with its copy number after the extension — `MyProject.scanruler-2`
// on macOS — and was then refused as an unsupported file, though it is the
// same archive. A project is a project whatever copy marker the browser or the
// operating system appended; other names keep their kinds.
import { describe, expect, it } from 'vitest'
import { isProjectFile } from '../src/app/useProject'

describe('which file names are projects', () => {
  it('the plain name, in any case', () => {
    expect(isProjectFile('MyProject.scanruler')).toBe(true)
    expect(isProjectFile('MyProject.SCANRULER')).toBe(true)
  })

  it('the copies a browser or the system name after the extension (issue 83)', () => {
    expect(isProjectFile('MyProject.scanruler-2')).toBe(true)
    expect(isProjectFile('MyProject.scanruler-17')).toBe(true)
    expect(isProjectFile('MyProject.scanruler (1)')).toBe(true)
    expect(isProjectFile('MyProject.scanruler(3)')).toBe(true)
  })

  it('the copies named before the extension, as Chrome on Windows does', () => {
    expect(isProjectFile('MyProject (1).scanruler')).toBe(true)
  })

  it('nothing else', () => {
    expect(isProjectFile('MyProject.stl')).toBe(false)
    expect(isProjectFile('MyProject.scanruler.zip')).toBe(false)
    expect(isProjectFile('MyProject.scanruler-backup')).toBe(false)
    expect(isProjectFile('MyProject.scanrulerx')).toBe(false)
    expect(isProjectFile('scanruler')).toBe(false)
    expect(isProjectFile('MyProject.scanruler-')).toBe(false)
  })
})
