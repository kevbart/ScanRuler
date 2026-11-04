// SPDX-License-Identifier: AGPL-3.0-only
// Every check CI runs, in CI's order, run locally with one command — and the
// count of checks each one ran, compared with the last green run on this
// machine. A suite that stops running checks still exits 0: a test skipped by
// a stray condition, a browser check whose script was dropped from ci.json, a
// describe that no longer matches. Only its count shows it, so a count that
// falls fails this run, and a step that cannot say how many checks it ran
// fails too (a silent pass is not a pass).
//
// It also checks what is shipped, not only the sources: the production build
// in dist/ through the e2e production smoke test, and the headless engine
// scanruler-mcp --engine loads, built and started (scripts/engine-smoke.mjs).
//
//   npm run check                  # everything
//   npm run check -- --fast        # no builds and no browser: boundary, units, unit tests, agent server
//   npm run check -- --only vitest,mcp
//   npm run check -- --update-baseline   # after a green run whose new counts you can explain
//
// Logs and the baseline go to e2e-out/check-all/ (git-ignored, per machine:
// the acceptance tests run only where their scan files are, so counts differ
// between machines and are compared on the same one). Exit code 1 on any
// failure, missing count or fallen count.
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = join(root, 'e2e-out', 'check-all')
const baselineFile = join(out, 'baseline.json')
const node = process.execPath
const bin = (...p) => join(root, 'node_modules', ...p)

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const only = (() => {
  const i = argv.indexOf('--only')
  return i >= 0 ? new Set((argv[i + 1] ?? '').split(',').filter(Boolean)) : null
})()
const fast = flag('--fast')
const updateBaseline = flag('--update-baseline')
if (flag('--help') || flag('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
  process.exit(0)
}

/** Counts read off a step's output: how many checks ran, failed and were
 *  skipped. null when the output says nothing countable. */
const sentence = (pattern) => (log) => (pattern.test(log) ? { checks: 1, failed: 0, skipped: 0 } : null)
function vitestCounts(_log, step) {
  if (!existsSync(step.json)) return null
  const r = JSON.parse(readFileSync(step.json, 'utf8'))
  return { checks: r.numTotalTests - r.numPendingTests - r.numTodoTests, failed: r.numFailedTests, skipped: r.numPendingTests + r.numTodoTests, files: r.numTotalTestSuites }
}
function tapCounts(log) {
  const n = (k) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(log)?.[1] ?? NaN)
  const tests = n('tests')
  if (!Number.isFinite(tests)) return null
  return { checks: tests - (n('skipped') || 0) - (n('todo') || 0), failed: n('fail') || 0, skipped: (n('skipped') || 0) + (n('todo') || 0) }
}
/** PASS:/FAIL:/SKIPPED lines, from the step's own output or, for the browser
 *  checks, from every run.log e2e-ci.mjs wrote. */
function passLines(text) {
  const count = (re) => (text.match(re) ?? []).length
  const checks = count(/^PASS\b/gm) + count(/^FAIL\b/gm)
  return checks === 0 && count(/SKIPPED/g) === 0 ? null : { checks, failed: count(/^FAIL\b/gm), skipped: count(/SKIPPED/g) }
}
function e2eCounts() {
  const dir = join(root, 'e2e-out', 'ci')
  if (!existsSync(dir)) return null
  const suites = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'run.log')))
  const r = passLines(suites.map((d) => readFileSync(join(dir, d.name, 'run.log'), 'utf8')).join('\n'))
  return r && { ...r, files: suites.length }
}

const STEPS = [
  { id: 'boundary', title: 'Plugin boundary', cmd: [node, 'scripts/check-plugin-boundary.mjs'], counts: sentence(/^Plugin boundary holds/m) },
  { id: 'units', title: 'Lengths through the display units', cmd: [node, 'scripts/check-units.mjs'], counts: sentence(/^Units hold/m) },
  {
    id: 'vitest', title: 'Unit and acceptance tests (npm test)',
    cmd: (s) => [node, bin('vitest', 'vitest.mjs'), 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${s.json}`],
    json: join(out, 'vitest.json'), counts: vitestCounts,
  },
  { id: 'mcp', title: 'The agent server (mcp/)', cmd: [node, '--test'], cwd: join(root, 'mcp'), counts: tapCounts, needs: () => existsSync(join(root, 'mcp', 'node_modules')) || 'mcp/node_modules is missing — run npm --prefix mcp ci' },
  { id: 'build', title: 'Type check and production build (npm run build)', cmd: [node, bin('typescript', 'bin', 'tsc'), '--noEmit'], then: [node, bin('vite', 'bin', 'vite.js'), 'build'], counts: (log) => (/✓ built in/.test(log) ? { checks: 1, failed: 0, skipped: 0 } : null), heavy: true },
  { id: 'engine', title: 'Headless engine, built and started', cmd: [node, 'scripts/build-engine.mjs'], then: [node, 'scripts/engine-smoke.mjs'], counts: passLines, heavy: true },
  { id: 'e2e', title: 'Browser checks and production smoke test (npm run e2e:ci)', cmd: [node, 'scripts/e2e-ci.mjs'], counts: e2eCounts, heavy: true, clean: join(root, 'e2e-out', 'ci') },
]

function run(cmd, cwd, log) {
  return new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), { cwd, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, windowsHide: true })
    let text = ''
    const take = (d) => {
      text += d
      log.write(d)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('error', (e) => resolve({ code: 1, text: `${text}\n${e.stack}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, text }))
  })
}

mkdirSync(out, { recursive: true })
const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {}
const results = []
for (const step of STEPS) {
  if (only ? !only.has(step.id) : fast && step.heavy) continue
  const started = Date.now()
  const ready = step.needs?.() ?? true
  if (ready !== true) {
    results.push({ step, ok: false, why: ready, ms: 0 })
    continue
  }
  if (step.clean) rmSync(step.clean, { recursive: true, force: true })
  if (step.json) rmSync(step.json, { force: true })
  const logPath = join(out, `${step.id}.log`)
  const log = createWriteStream(logPath)
  process.stdout.write(`${step.title} … `)
  let { code, text } = await run(typeof step.cmd === 'function' ? step.cmd(step) : step.cmd, step.cwd ?? root, log)
  if (code === 0 && step.then) ({ code, text } = await run(step.then, step.cwd ?? root, log).then((r) => ({ code: r.code, text: text + r.text })))
  await new Promise((r) => log.end(r))
  const counts = step.counts(text, step)
  const before = baseline[step.id]?.checks
  let why = ''
  if (code !== 0) why = `exited ${code}`
  else if (!counts || !(counts.checks > 0)) why = 'ran no checks it could count — a silent pass is not a pass'
  else if (counts.failed > 0) why = `${counts.failed} failed`
  else if (before !== undefined && counts.checks < before) why = `ran ${counts.checks} checks, ${before - counts.checks} fewer than the baseline's ${before}`
  const ok = why === ''
  const ms = Date.now() - started
  results.push({ step, ok, why, counts, before, ms, logPath })
  console.log(`${ok ? 'ok' : 'FAILED'} (${(ms / 1000).toFixed(0)} s)`)
}

console.log('\n step        checks   skipped  baseline  result')
for (const r of results) {
  const c = r.counts
  const delta = c && r.before !== undefined ? (c.checks === r.before ? '=' : `${c.checks > r.before ? '+' : ''}${c.checks - r.before}`) : 'new'
  console.log(` ${r.step.id.padEnd(10)} ${String(c?.checks ?? '-').padStart(7)} ${String(c?.skipped ?? '-').padStart(9)} ${String(r.before ?? '-').padStart(9)} ${delta.padStart(4)}  ${r.ok ? 'ok' : `FAILED: ${r.why}${r.logPath ? ` — ${r.logPath}` : ''}`}`)
}
const failed = results.filter((r) => !r.ok)
if (updateBaseline) {
  if (failed.length) console.log('\nBaseline not written: the run was not green.')
  else {
    for (const r of results) baseline[r.step.id] = { checks: r.counts.checks, skipped: r.counts.skipped, at: new Date().toISOString() }
    writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`)
    console.log(`\nBaseline written: ${baselineFile}`)
  }
} else if (!failed.length && results.some((r) => r.before === undefined)) {
  console.log('\nSome steps have no baseline yet: run again with --update-baseline to keep these counts.')
}
console.log(failed.length ? `\n${failed.length} of ${results.length} steps FAILED` : `\nAll ${results.length} steps passed.`)
process.exit(failed.length ? 1 : 0)
