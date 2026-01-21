import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('variable', () => {
  let collectionId: string
  let variableId: string

  beforeAll(async () => {
    await setupTestPage('variable')
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('collection list returns collections', async () => {
    const result = (await run('collection list --json')) as any[]
    expect(Array.isArray(result)).toBe(true)
  })

  test('collection create creates new collection', async () => {
    const result = (await run('collection create "TestCollection" --json')) as any
    collectionId = result.id
    expect(result.name).toBe('TestCollection')
  })

  test('list returns variables', async () => {
    const result = (await run('variable list --json')) as any[]
    expect(Array.isArray(result)).toBe(true)
  })

  test('list filters by type', async () => {
    const result = (await run('variable list --type COLOR --json')) as any[]
    expect(Array.isArray(result)).toBe(true)
  })

  test('create creates new variable', async () => {
    const result = (await run(
      `variable create "testColor" --collection "${collectionId}" --type COLOR --value "#FF0000" --json`
    )) as any
    variableId = result.id
    expect(result.name).toBe('testColor')
  })

  test('get returns variable by id', async () => {
    const result = (await run(`variable get "${variableId}" --json`)) as any
    expect(result.id).toBe(variableId)
  })

  test('delete removes variable', async () => {
    const result = (await run(`variable delete "${variableId}" --json`)) as any
    expect(result.deleted).toBe(true)
  })

  test('collection delete removes collection', async () => {
    const result = (await run(`collection delete "${collectionId}" --json`)) as any
    expect(result.deleted).toBe(true)
  })
})
