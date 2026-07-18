import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('primary page stack mounts four fixed pages behind isolated recall buttons', async () => {
  const source = await readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8')

  for (const page of ['Home', 'Calendar', 'Statistics', 'Settings']) {
    assert.match(source, new RegExp(`import ${page} from '@\/views\/${page}\.vue'`))
  }
  assert.match(source, /class="card-page-content"/)
  assert.match(source, /:inert="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /class="card-recall"/)
  assert.match(source, /@click\.stop="activatePage\(index\)"/)
  assert.match(source, /:tabindex="cardStates\[index\]\.recallInteractive \? 0 : -1"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.recallInteractive"/)
  assert.match(source, /\.card-stage\s*\{[^}]*perspective:\s*80px/m)
  assert.match(source, /\.card-page-content\.blocked\s*\{[^}]*pointer-events:\s*none/m)
})
