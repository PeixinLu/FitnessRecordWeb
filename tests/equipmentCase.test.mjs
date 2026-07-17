import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-equipment-case-tests')
  const outfile = path.join(outdir, `equipmentCase-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/data/equipmentCases.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('normalizeEquipmentName removes whitespace and ignores case', async () => {
  const { normalizeEquipmentName } = await loadModule()

  assert.equal(normalizeEquipmentName(' 龙 门 架 '), '龙门架')
  assert.equal(normalizeEquipmentName('Cable Machine'), 'cablemachine')
})

test('equipment case library contains the approved first-phase cases', async () => {
  const { EQUIPMENT_CASES } = await loadModule()
  const butterfly = EQUIPMENT_CASES.find(item => item.name === '蝴蝶机')
  const pulldown = EQUIPMENT_CASES.find(item => item.name === '高位下拉机')

  assert.deepEqual(butterfly.actions.map(action => action.name), ['夹胸', '反向飞鸟'])
  assert.deepEqual(pulldown.actions.map(action => action.name), ['宽距高位下拉', '窄距高位下拉', '颈后下拉'])
})
