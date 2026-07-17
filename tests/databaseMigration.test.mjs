import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('v2 migration only fills a missing data template', async () => {
  const source = await readFile(path.resolve('src/db/database.ts'), 'utf8')

  assert.match(
    source,
    /modify\(exercise => \{\s*if \(!exercise\.dataTemplate\) \{\s*exercise\.dataTemplate = 'weight-reps'/,
  )
})
