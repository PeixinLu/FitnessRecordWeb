import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-equipment-icon-tests')
  const outfile = path.join(outdir, `equipmentIcon-${Date.now()}.mjs`)
  const source = await readFile(path.resolve('src/utils/equipmentIcon.ts'), 'utf8')
  const testableSource = source.replace(
    /import (\w+) from ['"][^'"]+\.svg['"]\n/g,
    "const $1 = '/assets/$1.svg'\n",
  )
  const output = ts.transpileModule(testableSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })

  await mkdir(outdir, { recursive: true })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('recognizes all first-phase equipment icon slugs', async () => {
  const { EQUIPMENT_ICON_SLUGS, hasEquipmentIcon } = await loadModule()
  const expectedSlugs = [
    'butterfly-machine',
    'bodyweight',
    'barbell',
    'hip-adductor',
    'lat-pulldown',
    'cable-machine',
    'rowing-machine',
  ]

  assert.deepEqual(Object.keys(EQUIPMENT_ICON_SLUGS), expectedSlugs)
  for (const slug of expectedSlugs) assert.equal(hasEquipmentIcon(slug), true)
  assert.equal(hasEquipmentIcon('unknown'), false)
  assert.equal(hasEquipmentIcon(), false)
})

test('treats inherited prototype keys as unmapped equipment icons', async () => {
  const { getEquipmentIcon, hasEquipmentIcon } = await loadModule()

  for (const slug of ['toString', 'constructor', '__proto__']) {
    assert.equal(hasEquipmentIcon(slug), false)
    assert.equal(getEquipmentIcon(slug), undefined)
  }
})
