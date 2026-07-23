import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('sync schema stores outbox, cursor state, and cross-tab lease', async () => {
  const source = await readFile(path.resolve('src/db/database.ts'), 'utf8')
  assert.match(source, /this\.version\(6\)\.stores\(/)
  assert.match(source, /syncOutbox: 'key, mutationId, nextAttemptAt, createdAt'/)
  assert.match(source, /syncState: 'id, userId'/)
  assert.match(source, /syncLease: 'id, expiresAt'/)
})

test('business writes are routed through the sync-aware repository', async () => {
  const [exerciseStore, recordStore, repository] = await Promise.all([
    readFile(path.resolve('src/stores/exercise.ts'), 'utf8'),
    readFile(path.resolve('src/stores/record.ts'), 'utf8'),
    readFile(path.resolve('src/repositories/fitnessRepository.ts'), 'utf8'),
  ])

  for (const operation of [
    'addEquipmentWithSync',
    'updateEquipmentWithSync',
    'deleteEquipmentWithSync',
    'addExerciseWithSync',
    'updateExerciseWithSync',
    'deleteExerciseWithSync',
    'addCaseEntitiesWithSync',
    'resetAllDataWithSync',
    'replaceEquipmentOrderWithSync',
    'replaceExerciseOrderWithSync',
  ]) {
    assert.match(exerciseStore, new RegExp(operation))
  }
  for (const operation of [
    'addRecordWithSync',
    'updateRecordWithSync',
    'deleteRecordWithSync',
  ]) {
    assert.match(recordStore, new RegExp(operation))
  }
  assert.match(repository, /db\.transaction\('rw', db\.records, db\.syncOutbox/)
  assert.match(repository, /db\.syncOutbox\.put\(deleteMutation\('equipment', id\)\)/)
  assert.match(repository, /deleteMutation\('exercise', exercise\.id\)/)
})

test('sync ACK and remote changes use mutation-safe transactions', async () => {
  const source = await readFile(path.resolve('src/sync/storage.ts'), 'utf8')
  assert.match(source, /current\?\.mutationId === mutation\.mutationId/)
  assert.match(source, /pending\.mutationId === change\.mutationId/)
  assert.match(source, /for \(const change of response\.changes\) await applyRemoteChange\(change\)/)
  assert.match(source, /cursor: response\.cursor/)
  assert.match(source, /preserveOutbox \? await db\.syncOutbox\.toArray\(\) : \[\]/)
})

test('login lifecycle exposes first-sync decisions and manual sync', async () => {
  const [app, syncStore, accountPopup, decisionSheet] = await Promise.all([
    readFile(path.resolve('src/App.vue'), 'utf8'),
    readFile(path.resolve('src/stores/sync.ts'), 'utf8'),
    readFile(path.resolve('src/components/AccountPopup.vue'), 'utf8'),
    readFile(path.resolve('src/components/SyncDecisionSheet.vue'), 'utf8'),
  ])
  assert.match(app, /syncStore\.handleAuthenticated\(userId\)/)
  assert.match(syncStore, /localCount > 0 && cloudStatus\.hasCloudData/)
  assert.match(syncStore, /phase\.value = 'decision-required'/)
  assert.match(accountPopup, /立即同步/)
  assert.match(decisionSheet, /使用云端数据/)
  assert.match(decisionSheet, /合并本机数据/)
})
