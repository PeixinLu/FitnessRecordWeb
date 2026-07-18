import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-card-stack-tests')
  const outfile = path.join(outdir, `cardStack-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/utils/cardStack.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('four stacked cards use the specified offsets and block page content', async () => {
  const { createCardStackState, getCardVisualState } = await loadModule()
  const state = { ...createCardStackState(), isStacked: true }
  const cards = Array.from({ length: 4 }, (_, index) => getCardVisualState(index, 4, state))

  assert.deepEqual(cards.map(card => card.style.transform), [
    'translate3d(0, 10px, -12px) rotateX(-1deg)',
    'translate3d(0, 25.00%, -11px) rotateX(-1deg)',
    'translate3d(0, 50.00%, -10px) rotateX(-1deg)',
    'translate3d(0, 75.00%, -9px) rotateX(-1deg)',
  ])
  assert.deepEqual(cards.map(card => card.contentInteractive), [false, false, false, false])
  assert.deepEqual(cards.map(card => card.recallInteractive), [true, true, true, true])
  assert.ok(cards.every(card => card.style.borderRadius === '20px'))
  assert.ok(cards.every(card => !card.style.transition.includes('z-index')))
})

test('foreground mode only exposes the active page', async () => {
  const { getCardVisualState } = await loadModule()
  const state = { activeIndex: 2, isStacked: false }
  const cards = Array.from({ length: 4 }, (_, index) => getCardVisualState(index, 4, state))

  assert.equal(cards[2].style.transform, 'translate3d(0, 0, 0)')
  assert.equal(cards[2].style.borderRadius, '0')
  assert.equal(cards[2].contentInteractive, true)
  assert.equal(cards[2].recallInteractive, false)
  assert.match(cards[0].style.transform, /-100%/)
  assert.match(cards[1].style.transform, /-100%/)
  assert.match(cards[3].style.transform, /100%/)
  assert.deepEqual(cards.map(card => card.contentInteractive), [false, false, true, false])
})

test('FAB preserves the active page and card recall clamps the selected index', async () => {
  const { activateCard, toggleStack } = await loadModule()
  const foreground = { activeIndex: 2, isStacked: false }
  const stacked = toggleStack(foreground)

  assert.deepEqual(stacked, { activeIndex: 2, isStacked: true })
  assert.deepEqual(toggleStack(stacked), foreground)
  assert.deepEqual(activateCard(stacked, 99, 4), { activeIndex: 3, isStacked: false })
})
