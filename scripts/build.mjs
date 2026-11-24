import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = new URL('../dist/', import.meta.url)
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/client.jsx'],
  platform: 'browser',
  target: 'es2022',
  format: 'cjs',
  bundle: true,
  write: false,
  loader: { '.css': 'text' },
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-store'],
})

await mkdir(output, { recursive: true })
await writeFile(new URL('client.js', output), [
  'window.__ModuleLoader__.load({ id: "dsh-experts", factory(require) {',
  'const module = { exports: {} };',
  result.outputFiles[0].text,
  'return module.exports.default;',
  '} });',
].join('\n'))
