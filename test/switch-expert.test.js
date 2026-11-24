import assert from 'node:assert/strict'
import test from 'node:test'
import { createExpertSwitcher } from '../src/switch-expert.js'

function snapshot(value) {
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    set(next) {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function fixture({ blank = false, draft = '  请检查宽表\n', attachments = [], references = [], targetPreset = 'modeling' } = {}) {
  const calls = []
  const sourcePreset = snapshot('standard')
  const sourceInput = snapshot({ phase: 'plain', draft, attachmentIds: attachments, occurrences: references })
  const block = snapshot(undefined)
  const feedback = snapshot(null)
  const targetDraft = snapshot('')
  const sourceState = { openState: 'open', awaitingFirstTurn: false, pendingSubmissions: [] }
  const bindings = {
    current: {
      ctx: {},
      session: { getSnapshot: () => ({ ...sourceState, blank }), projections: { faceOf: () => sourcePreset } },
    },
    target: {
      session: {
        getSnapshot: () => ({ ...sourceState, blank: true }),
        projections: { faceOf: () => snapshot(targetPreset) },
      },
    },
  }
  let navigation = new AbortController()
  const ctx = {
    remote: { agentPresets: {
      async select(id, presetId) {
        calls.push(['select', id, presetId])
        assert.ok(block.getSnapshot())
        sourcePreset.set(presetId)
        return { ok: true, value: presetId }
      },
    } },
    conversation: {
      blocks: { storeFor: () => block, set: (id, next) => block.set(next) },
      input: {
        for: () => ({ state: sourceInput }),
        requestDraftInitialization(binding, options) {
          assert.equal(binding, bindings.target)
          assert.equal(options.whenDraftExists, 'keep')
          calls.push(['prepare', options.prompt])
          if (targetDraft.getSnapshot()) return 'preserved'
          targetDraft.set(options.prompt)
          return 'applied'
        },
      },
    },
    sessions: {
      binding: id => bindings[id],
      using: (id, options, callback) => callback({ ready: Promise.resolve(bindings[id]) }),
    },
    workspaces: { list: snapshot({ phase: 'ready', archivedSessionIds: [], items: [
      { workspaceId: 'wrong', title: '同名', sessionIds: ['another'] },
      { workspaceId: 'workspace', title: '同名', sessionIds: ['current'] },
    ] }) },
    layout: {
      beginNavigation() {
        navigation.abort()
        navigation = new AbortController()
        return navigation.signal
      },
    },
    uiWorkspace: {
      async connectWorkspace(id, options) { calls.push(['connect', id, options.agentPreset]); return 'target' },
      openSession(id) { calls.push(['open', id]); ctx.layout.beginNavigation() },
    },
  }
  const directory = {
    getSnapshot: () => ({ catalog: { experts: [{ id: 'modeling', name: '数仓建模专家' }] } }),
    async refresh() { calls.push(['refresh']) },
  }
  const task = createExpertSwitcher({ ctx, directory, signal: new AbortController().signal, handoff: feedback })
  const choose = (options = {}) => task({ sessionId: 'current', expertId: 'modeling', persistDraft: () => calls.push(['persist']), ...options })
  return { ctx, choose, calls, block, sourceInput, sourcePreset, targetDraft, feedback }
}

test('selects the preset in the same blank session, holds sending until confirmed, and keeps all draft data', async () => {
  const f = fixture({ blank: true, attachments: ['attachment'], references: ['reference'] })
  const original = f.sourceInput.getSnapshot()
  let respond
  f.ctx.remote.agentPresets.select = (id, presetId) => {
    f.calls.push(['select', id, presetId])
    return new Promise(resolve => { respond = resolve })
  }
  const change = f.choose()
  assert.ok(f.block.getSnapshot())
  assert.equal((await f.choose()).kind, 'error')
  respond({ ok: true, value: 'modeling' })
  assert.equal(f.sourcePreset.getSnapshot(), 'standard')
  f.sourcePreset.set('modeling')
  assert.equal((await change).kind, 'applied')
  assert.equal((await f.choose()).kind, 'unchanged')
  assert.deepEqual(f.calls, [['select', 'current', 'modeling']])
  assert.equal(f.sourcePreset.getSnapshot(), 'modeling')
  assert.strictEqual(f.sourceInput.getSnapshot(), original)
  assert.equal(f.block.getSnapshot(), undefined)
})

test('retains the source on a rejected preset and refreshes the directory', async () => {
  const f = fixture({ blank: true })
  f.ctx.remote.agentPresets.select = async () => ({ ok: false, error: { code: 'agent-preset/invalid' } })
  assert.match((await f.choose()).message, /专家已不可用/u)
  assert.deepEqual(f.calls, [['refresh']])
  assert.equal(f.sourcePreset.getSnapshot(), 'standard')
  assert.equal(f.block.getSnapshot(), undefined)
})

test('requires fresh confirmation when the Host reports that the blank session has started', async () => {
  const f = fixture({ blank: true })
  f.ctx.remote.agentPresets.select = async () => ({ ok: false, error: { code: 'agent-preset/locked' } })
  const confirmation = await f.choose()
  assert.deepEqual(confirmation, { kind: 'confirm', draftKind: 'text', locked: true })
  assert.deepEqual(f.calls, [])
  assert.equal((await f.choose({ confirmation })).kind, 'opened')
  assert.equal(f.targetDraft.getSnapshot(), f.sourceInput.getSnapshot().draft)
})

test('prepares plain text in the exact blank target in the same workspace, with a source copy', async () => {
  const f = fixture()
  const original = f.sourceInput.getSnapshot()
  assert.equal((await f.choose()).kind, 'opened')
  assert.deepEqual(f.calls, [['persist'], ['connect', 'workspace', 'modeling'], ['prepare', original.draft], ['open', 'target']])
  assert.equal(f.targetDraft.getSnapshot(), original.draft)
  assert.strictEqual(f.sourceInput.getSnapshot(), original)
  assert.equal(f.feedback.getSnapshot(), null)
  assert.equal(f.block.getSnapshot(), undefined)
})

test('keeps the pre-existing target draft and exposes return and copy context', async () => {
  const f = fixture()
  f.targetDraft.set('目标已有草稿')
  assert.equal((await f.choose()).kind, 'opened')
  assert.equal(f.targetDraft.getSnapshot(), '目标已有草稿')
  assert.equal(f.feedback.getSnapshot().sourceId, 'current')
  assert.equal(f.feedback.getSnapshot().targetId, 'target')
  assert.equal(f.feedback.getSnapshot().text, f.sourceInput.getSnapshot().draft)
})

test('keeps the original selected when the target composer refuses draft initialization', async () => {
  const f = fixture()
  f.ctx.conversation.input.requestDraftInitialization = () => 'blocked'
  const original = f.sourceInput.getSnapshot()
  assert.match((await f.choose()).message, /草稿仍在原会话/u)
  assert.deepEqual(f.calls, [['persist'], ['connect', 'workspace', 'modeling']])
  assert.strictEqual(f.sourceInput.getSnapshot(), original)
  assert.equal(f.feedback.getSnapshot(), null)
  assert.equal(f.block.getSnapshot(), undefined)
})

test('confirms attachment, reference, and quote drafts and leaves each whole in the source', async () => {
  for (const options of [{ attachments: ['attachment'] }, { references: ['reference'] }, { draft: '> 原文\n\n我的问题' }]) {
    const f = fixture(options)
    const original = f.sourceInput.getSnapshot()
    const confirmation = await f.choose()
    assert.equal(confirmation.kind, 'confirm')
    assert.deepEqual(f.calls, [])
    assert.equal((await f.choose({ confirmation })).kind, 'opened')
    assert.deepEqual(f.calls, [['persist'], ['connect', 'workspace', 'modeling'], ['open', 'target']])
    assert.strictEqual(f.sourceInput.getSnapshot(), original)
    assert.equal(f.feedback.getSnapshot().text, undefined)
  }
})

test('refuses mismatched presets and skips draft changes when a later navigation supersedes the operation', async () => {
  const mismatch = fixture({ targetPreset: 'standard' })
  assert.equal((await mismatch.choose()).kind, 'error')
  assert.deepEqual(mismatch.calls, [['persist'], ['connect', 'workspace', 'modeling']])
  assert.equal(mismatch.targetDraft.getSnapshot(), '')

  const f = fixture()
  let resolveTarget
  f.ctx.uiWorkspace.connectWorkspace = () => new Promise(resolve => { resolveTarget = resolve })
  const change = f.choose()
  assert.ok(f.block.getSnapshot())
  f.ctx.layout.beginNavigation()
  assert.equal(f.block.getSnapshot(), undefined)
  resolveTarget('target')
  assert.equal((await change).kind, 'cancelled')
  assert.deepEqual(f.calls, [['persist']])
  assert.equal(f.targetDraft.getSnapshot(), '')
})
