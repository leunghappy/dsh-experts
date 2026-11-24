import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalog, emptyOrganization, searchExperts, updateOrganization } from '../src/catalog.js'
import { createDirectory } from '../src/directory.js'

test('tags group experts without duplicating results; untagged built-ins stay in Other', () => {
  const options = { builtInIds: ['standard'] }
  const presets = [{ id: 'standard', name: '通用' }]
  let state = emptyOrganization()
  const catalog = () => buildCatalog(presets, state, options)
  assert.equal(catalog().experts[0].categories[0].name, '通用专家')
  state = updateOrganization(state, { kind: 'add-category', id: 'a', name: '数仓' })
  state = updateOrganization(state, { kind: 'add-category', id: 'b', name: '分析' })
  state = updateOrganization(state, { kind: 'set-tags', presetId: 'standard', previousTags: ['builtin:general'], tags: ['a', 'b'] })
  assert.equal(searchExperts(catalog(), { query: '通用' }).length, 1)
  assert.equal(searchExperts(catalog(), { categoryId: 'a' }).length, 1)
  assert.equal(searchExperts(catalog(), { categoryId: 'b' }).length, 1)
  state = updateOrganization(state, { kind: 'set-tags', presetId: 'standard', previousTags: ['a', 'b'], tags: [] })
  state = JSON.parse(JSON.stringify(state))
  assert.equal(catalog().experts[0].categories[0].name, '其他专家')
})

test('aliases match normalized text and duplicate names keep distinct preset IDs', () => {
  const catalog = buildCatalog([
    { id: 'default', name: '建模专家' },
    { id: 'commercial', name: '建模专家' },
    { id: 'retired', name: 'ADS 旧专家', broken: '加载失败' },
  ], emptyOrganization(), { metadata: { commercial: { aliases: ['ADS'] } } })
  assert.deepEqual(searchExperts(catalog, { query: 'ａｄｓ', selectableOnly: true }).map(item => item.id), ['commercial'])
  assert.deepEqual(searchExperts(catalog, { query: '建模' }).map(item => [item.id, item.disambiguate]), [
    ['default', true], ['commercial', true],
  ])
})

test('an edit from a stale tag panel preserves changes added elsewhere', () => {
  const state = { version: 1, categories: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }], tagsByPreset: { x: ['a', 'b'] } }
  const next = updateOrganization(state, { kind: 'set-tags', presetId: 'x', previousTags: ['a'], tags: [] })
  assert.deepEqual(next.tagsByPreset.x, ['b'])
})

test('refresh retains a successful catalog after failure and rejects stale responses', async () => {
  const resolvers = []
  const responses = Array.from({ length: 2 }, () => new Promise(resolve => resolvers.push(resolve)))
  const directory = createDirectory({
    readPresets: () => responses.shift() ?? Promise.reject(new Error('连接中断')),
    readOrganization: emptyOrganization,
    subscribeOrganization: () => () => {},
  })
  const pendingOlder = directory.refresh()
  const pendingLater = directory.refresh()
  resolvers[1]([{ id: 'new' }])
  await pendingLater
  resolvers[0]([{ id: 'old' }])
  await pendingOlder
  await directory.refresh()
  assert.equal(directory.getSnapshot().status, 'error')
  assert.equal(directory.getSnapshot().catalog.experts[0].id, 'new')
  directory.dispose()
})
