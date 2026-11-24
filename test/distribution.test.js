import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createDirectory } from '../src/directory.js'
import { searchExperts } from '../src/catalog.js'
import { dictionaries } from '../src/i18n.js'

const run = promisify(execFile)
const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

test('Chinese and English dictionaries provide the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort())
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
  for (const key of Object.keys(dictionaries.zh)) {
    assert.deepEqual(placeholders(dictionaries.zh[key]), placeholders(dictionaries.en[key]), key)
  }
})

test('switching languages keeps category IDs and finds both expert names and aliases', async () => {
  const sample = await readJson('../examples/expert-metadata.json')
  let language = 'zh'
  const directory = createDirectory({
    readPresets: async () => [{ id: 'your-preset-id', name: 'Original', description: 'Original description' }],
    subscribeOrganization: () => () => {},
    readOrganization: () => ({ version: 1, categories: [{ id: 'sql', name: 'SQL' }], tagsByPreset: { 'your-preset-id': ['sql'] } }),
    metadata: sample,
    resolveText: labels => labels[language],
    t: key => dictionaries[language][key],
  })
  await directory.refresh()
  const before = directory.getSnapshot().catalog
  assert.equal(before.experts[0].name, 'SQL 审查专家')

  language = 'en'
  directory.relocalize()
  const after = directory.getSnapshot().catalog
  assert.equal(after.experts[0].name, 'SQL review expert')
  assert.match(after.experts[0].description, /^Reviews query logic/u)
  assert.equal(after.categories[0].name, 'General experts')
  assert.deepEqual(after.experts[0].categoryIds, before.experts[0].categoryIds)
  for (const query of ['SQL 审查专家', '查SQL', 'SQL review', 'Original']) {
    assert.equal(searchExperts(after, { query, categoryId: 'sql' })[0]?.id, 'your-preset-id')
  }
  directory.dispose()
})

test('the Market index names both locales and pins the bundle version and Git commit', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-experts-index-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const output = join(directory, 'index.json')
  const script = fileURLToPath(new URL('../scripts/market-index.mjs', import.meta.url))
  const commit = 'a'.repeat(40)
  const repository = 'https://github.com/sample/dsh-experts'
  const options = ['--repository', repository, '--commit', commit, '--published-at', '2026-11-23T10:00:00Z', '--output', output]
  await run(process.execPath, [script, ...options])
  const index = JSON.parse(await readFile(output, 'utf8'))
  const [item] = index.plugins
  const pkg = await readJson('../package.json')
  assert.equal(index.format, 1)
  assert.equal(item.name, pkg.name)
  assert.deepEqual(item.title, { zh: '专家', en: 'Experts' })
  assert.ok(item.description.zh && item.description.en)
  assert.deepEqual(item.versions[0], {
    version: pkg.version, publishTimestamp: Date.parse('2026-11-23T10:00:00Z') / 1000,
    source: { type: 'git', url: repository, commit }, engines: pkg.engines,
  })

  await run(process.execPath, [script, ...options, '--package-path', 'plugins/dsh-experts'])
  const [subdirectoryItem] = JSON.parse(await readFile(output, 'utf8')).plugins
  assert.equal(subdirectoryItem.versions[0].source.path, 'plugins/dsh-experts')
  assert.equal(subdirectoryItem.repository.directory, 'plugins/dsh-experts')
  await assert.rejects(run(process.execPath, [script, '--repository', repository, '--commit', 'main']), /40 位/u)
})
