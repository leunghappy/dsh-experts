import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: {
  repository: { type: 'string' },
  commit: { type: 'string' },
  'package-path': { type: 'string' },
  'published-at': { type: 'string' },
  output: { type: 'string', default: 'dist/market/index.json' },
} })

const repository = values.repository?.replace(/\/$/, '').replace(/\.git$/, '')
if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i.test(repository ?? '')) {
  throw new Error('--repository 需要 GitHub HTTPS 仓库地址 / Expected a GitHub HTTPS repository URL.')
}
if (!/^[a-f\d]{40}$/i.test(values.commit ?? '')) {
  throw new Error('--commit 需要完整的 40 位 Git SHA / Expected a full 40-character Git SHA.')
}

const path = values['package-path']
if (path !== undefined && (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(path) || path.split('/').some(part => part === '.' || part === '..'))) {
  throw new Error('--package-path 需要仓库内相对目录 / Expected a repository-relative package directory.')
}

const published = values['published-at'] === undefined ? Date.now() : Date.parse(values['published-at'])
if (!Number.isFinite(published) || published < 0) {
  throw new Error('--published-at 需要有效日期 / Expected a valid publication date.')
}

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const [pkg, zh, en] = await Promise.all([
  readJson('../package.json'), readJson('../locale/zh.json'), readJson('../locale/en.json'),
])
const commit = values.commit.toLowerCase()
const source = { type: 'git', url: repository, commit, ...(path ? { path } : {}) }
const index = {
  format: 1,
  title: { zh: '专家插件索引', en: 'Experts plugin index' },
  plugins: [{
    name: pkg.name,
    title: { zh: zh.meta.title, en: en.meta.title },
    description: { zh: zh.meta.description, en: en.meta.description },
    homepage: `${repository}/blob/${commit}/${path ? `${path}/` : ''}README.md`,
    repository: { url: repository, ...(path ? { directory: path } : {}) },
    versions: [{ version: pkg.version, publishTimestamp: Math.floor(published / 1000), source, engines: { dsh: pkg.engines.dsh } }],
  }],
}

const output = resolve(values.output)
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(index, null, 2)}\n`)
console.log(output)
