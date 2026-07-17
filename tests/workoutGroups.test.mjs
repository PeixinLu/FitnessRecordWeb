import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-workout-group-tests')
  const outfile = path.join(outdir, `workoutGroups-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/utils/workoutGroups.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('groupRecordsByExercise combines same-day sets by exercise', async () => {
  const { groupRecordsByExercise } = await loadModule()
  const groups = groupRecordsByExercise([
    { id: 'a', date: '2026-07-17', exerciseId: 'row', exerciseName: '划船', sets: 1, reps: 12, createdAt: 2 },
    { id: 'b', date: '2026-07-17', exerciseId: 'press', exerciseName: '卧推', sets: 1, reps: 8, createdAt: 3 },
    { id: 'c', date: '2026-07-17', exerciseId: 'row', exerciseName: '划船', sets: 1, reps: 10, createdAt: 1 },
  ])

  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].records.map(record => record.id), ['a', 'c'])
  assert.equal(groups[0].exerciseName, '划船')
})

test('summarizeWorkoutSets combines sets with identical training data', async () => {
  const { summarizeWorkoutSets } = await loadModule()

  assert.equal(
    summarizeWorkoutSets([
      { id: 'a', date: '2026-07-17', exerciseId: 'press', exerciseName: '卧推', sets: 1, reps: 12, weight: 12, createdAt: 3 },
      { id: 'b', date: '2026-07-17', exerciseId: 'press', exerciseName: '卧推', sets: 1, reps: 12, weight: 12, createdAt: 2 },
      { id: 'c', date: '2026-07-17', exerciseId: 'press', exerciseName: '卧推', sets: 1, reps: 10, weight: 10, createdAt: 1 },
    ]),
    '2组*12次*12kg / 1组*10次*10kg'
  )
})
