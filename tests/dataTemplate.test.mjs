import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-data-template-tests')
  const outfile = path.join(outdir, `dataTemplate-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/utils/dataTemplate.ts'), 'utf8')
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

test('getTemplateFields returns the expected wheels for each template', async () => {
  const { getTemplateFields } = await loadModule()

  assert.deepEqual(getTemplateFields('reps').map(field => field.key), ['reps', 'sets'])
  assert.deepEqual(getTemplateFields('duration').map(field => field.unit), ['分钟', '组'])
  assert.deepEqual(
    getTemplateFields('distance-duration').map(field => field.key),
    ['distance', 'duration', 'sets'],
  )
  assert.deepEqual(getTemplateFields('weight-reps').map(field => field.unit), ['次', '组', 'kg'])
})

test('formatRecordDetail omits fields that are not recorded', async () => {
  const { formatRecordDetail } = await loadModule()

  assert.equal(formatRecordDetail({ sets: 1, reps: 12 }), '1组 × 12次')
  assert.equal(formatRecordDetail({ sets: 1, duration: 30 }), '1组 × 30分钟')
  assert.equal(formatRecordDetail({ sets: 1, distance: 3, duration: 20 }), '1组 × 3公里 × 20分钟')
})
