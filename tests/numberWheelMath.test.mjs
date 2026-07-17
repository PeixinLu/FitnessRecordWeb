import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-number-wheel-tests')
  const outfile = path.join(outdir, `numberWheelMath-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/utils/numberWheelMath.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('buildWheelValues expands inclusive integer ranges', async () => {
  const { buildWheelValues } = await loadModule()

  assert.deepEqual(buildWheelValues([1, 4]), [1, 2, 3, 4])
  assert.deepEqual(buildWheelValues([0, 0]), [0])
})

test('normalizeWheelModel returns one clamped value per wheel', async () => {
  const { normalizeWheelModel } = await loadModule()

  assert.deepEqual(
    normalizeWheelModel({
      count: 3,
      ranges: [[1, 10], [30, 40], [0, 100]],
      modelValue: [12, 35],
    }),
    [10, 35, 0],
  )
})

test('getNearestIndex clamps offset to range boundaries', async () => {
  const { getNearestIndex } = await loadModule()

  assert.equal(getNearestIndex(-999, 40, 5), 4)
  assert.equal(getNearestIndex(999, 40, 5), 0)
  assert.equal(getNearestIndex(-79, 40, 5), 2)
})

test('getOffsetForIndex returns the snapped offset for a value index', async () => {
  const { getOffsetForIndex } = await loadModule()

  assert.equal(getOffsetForIndex(0, 40), 0)
  assert.equal(getOffsetForIndex(3, 40), -120)
})
