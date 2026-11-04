// SPDX-License-Identifier: AGPL-3.0-only
// The fit tolerance typed key by key, as a hand types it (issue 81). The field
// took each key as it came and showed back what the sketch held, so the "0"
// that starts 0.05 — not above zero, so "auto" — emptied it under the hand and
// the 5 landed alone: 0.05 became 5. Each value is typed from an empty field,
// one key at a time, and the sketch has to hold exactly it; a blank field is
// auto again.
//
//   npm run e2e:fit-tolerance   (the dev server running; uses the bundled sample scan)
import { check, click, finish, launchApp, pickOption, sleep } from '../../../scripts/e2e-lib.mjs'

const { browser, page, consoleErrors } = await launchApp({ width: 1600, height: 1000, protocolTimeout: 600_000 })
try {
  await page.waitForSelector('[data-test=start-sample]', { timeout: 120_000 })
  await click(page, '[data-test=start-sample]')
  await page.waitForFunction(() => /288,582 triangles/.test(document.querySelector('.file-info')?.textContent ?? ''), { timeout: 300_000 })
  await page.click('[data-test=workspace-reverse]')
  await page.waitForFunction(() => /ready/.test(document.querySelector('[data-test=kernel-status]')?.textContent ?? ''), { timeout: 300_000 })
  await pickOption(page, '[data-test=sketch-plane-select]', 'XY plane through the centre')
  await page.waitForSelector('[data-test=sketch-editor]', { timeout: 120_000 })
  await page.waitForFunction(() => /slice chain/.test(document.querySelector('[data-test=sketch-plane]')?.textContent ?? ''), { timeout: 120_000 })
  await click(page, '[data-test=sketch-fit-options]')
  const sel = '[data-test=sketch-tolerance]'
  await page.waitForSelector(sel)
  const held = () => page.evaluate(() => window.__re.store.getState().sketchDraft?.tolerance ?? null)
  const clear = async () => {
    await page.click(sel)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
  }

  for (const typed of ['0.05', '0.005', '0.1', '1.5']) {
    await clear()
    const shown = []
    for (const key of typed) {
      await page.keyboard.type(key)
      await sleep(100)
      shown.push(await page.$eval(sel, (el) => el.value))
    }
    // A number field reports a half-typed "0." as "0", so the text is not
    // compared key for key; what the old field did is what is ruled out — it
    // emptied ("" after the 0 of 0.05) and ended on a figure never typed (5).
    check(
      shown.every((text) => text !== '') && shown.at(-1) === typed,
      `typing ${typed}, the field is never emptied under the hand and ends on it: ${JSON.stringify(shown)}`,
    )
    await page.keyboard.press('Enter')
    await sleep(500)
    check((await held()) === Number(typed), `and the sketch holds ${typed} (${await held()})`)
    check((await page.$eval(sel, (el) => el.value)) === typed, 'and the field shows it once left')
  }

  await clear()
  await page.keyboard.press('Enter')
  await sleep(500)
  check((await held()) === null, 'a blank field is auto again')
  check((await page.$eval(sel, (el) => el.placeholder)) === 'auto', 'and says so')
} catch (e) {
  check(false, `threw: ${e instanceof Error ? e.stack : String(e)}`)
} finally {
  await finish(browser, consoleErrors)
}
