// SPDX-License-Identifier: AGPL-3.0-only
// The headless engine as it was BUILT (npm run build:engine → dist-engine/),
// not as the sources run under vitest: scanruler-mcp --engine loads this very
// file, so a build that compiles but cannot start, reports another version,
// or lost its plugins or commands on the way is caught here and not by the
// first agent that tries it. tests/headlessEngine.test.ts covers the same
// behaviour from the sources.
//
//   npm run build:engine && node scripts/engine-smoke.mjs
// Prints one PASS/FAIL line per check and exits 1 on any failure.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const built = new URL('dist-engine/engine.mjs', pathToFileURL(root))
let failed = 0
let passed = 0
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`)
  if (ok) passed++
  else failed++
}

if (!existsSync(built)) {
  console.log('FAIL: dist-engine/engine.mjs is missing — run npm run build:engine first')
  process.exit(1)
}
const { version } = JSON.parse(readFileSync(new URL('package.json', pathToFileURL(root)), 'utf8'))
let engine
try {
  const { startEngine } = await import(built.href)
  check(typeof startEngine === 'function', 'the built engine exports startEngine')
  engine = await startEngine()
  check(engine.app === 'ScanRuler', `it starts and names the app (${engine.app})`)
  check(engine.version === version, `its version is package.json's (${engine.version} / ${version})`)
  const plugins = readdirPlugins()
  check(plugins.every((id) => engine.plugins.includes(id)), `it carries every plugin in the tree (${engine.plugins.join(', ') || 'none'})`)
  const offered = engine.listCommands().map((c) => c.name)
  check(offered.includes('session.state') && offered.includes('history.undo'), `it offers the headless commands (${offered.length})`)
  check(!offered.includes('view.render'), 'and not the ones that need the page')
  const state = await engine.run('session.state', {})
  check(state?.app?.viewport === false && state.scan === null, 'session.state runs with no page and no scan')
  const refused = await engine.run('view.render', {}).then(() => null, (e) => e)
  check(refused?.code === 'unavailable', `a page command is refused as unavailable (${refused?.code})`)
} catch (e) {
  check(false, `the built engine threw: ${e instanceof Error ? e.stack : String(e)}`)
} finally {
  engine?.stop()
}
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)

/** The ids of the plugins the tree holds, as each plugins/<folder>/plugin.ts
 *  declares it — read, not assumed from the folder name (Mesh Tools' folder
 *  is mesh-tools, and so is its id, but nothing promises that). Beta plugins
 *  install only when asked for, so they are left out. */
function readdirPlugins() {
  const dir = join(root, 'plugins')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'plugin.ts')))
    .map((d) => readFileSync(join(dir, d.name, 'plugin.ts'), 'utf8'))
    .filter((source) => !/\bbeta:\s*true\b/.test(source))
    .map((source) => /\bid:\s*'([^']+)'/.exec(source)?.[1])
    .filter(Boolean)
}
