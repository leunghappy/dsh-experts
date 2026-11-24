import { chinese } from './i18n.js'

const unavailableCodes = new Set(['agent-preset/not-found', 'agent-preset/invalid'])

function draftKind(input) {
  // Quote chips are expanded to Markdown in the public clipboard projection.
  if (input.attachmentIds.length || input.occurrences.length || /(^|\n)[\t ]*>/u.test(input.draft)) return 'retained'
  return input.draft.length ? 'text' : 'empty'
}

function waitForProjection(projection, presetId, signal) {
  if (projection.getSnapshot() === presetId) return Promise.resolve(true)
  if (signal.aborted) return Promise.resolve(false)
  return new Promise(resolve => {
    const finish = confirmed => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      unsubscribe()
      resolve(confirmed)
    }
    const onAbort = () => finish(false)
    const check = () => { if (projection.getSnapshot() === presetId) finish(true) }
    const timer = setTimeout(() => finish(false), 2500)
    const unsubscribe = projection.subscribe(check)
    signal.addEventListener('abort', onAbort, { once: true })
    check()
  })
}

export function createExpertSwitcher({ ctx, directory, signal, handoff, t = chinese }) {
  const blocks = ctx.conversation.blocks

  function workspaceFor(sessionId) {
    const workspaceList = ctx.workspaces.list.getSnapshot()
    if (workspaceList.phase !== 'ready' || workspaceList.archivedSessionIds.includes(sessionId)) return undefined
    const matches = workspaceList.items.filter(workspace => workspace.sessionIds.includes(sessionId))
    return matches.length === 1 ? matches[0].workspaceId : undefined
  }

  function unavailable() {
    void directory.refresh()
    return { kind: 'error', message: t('expertUnavailable') }
  }

  async function applyInPlace(sessionId, expertId, projection, operationSignal) {
    let result
    try {
      result = await ctx.remote.agentPresets.select(sessionId, expertId)
    } catch (error) {
      if (await waitForProjection(projection, expertId, operationSignal)) return { kind: 'applied' }
      return { kind: 'error', message: [t('unconfirmedSwitch'), error.message].filter(Boolean).join(' ') }
    }
    if (!result.ok) {
      if (result.error.code === 'agent-preset/locked') return { kind: 'locked' }
      if (unavailableCodes.has(result.error.code)) return unavailable()
      if (projection.getSnapshot() === expertId) return { kind: 'applied' }
      return { kind: 'error', message: result.error.message }
    }
    if (result.value !== expertId) return { kind: 'error', message: t('differentPreset') }
    return await waitForProjection(projection, expertId, operationSignal)
      ? { kind: 'applied' }
      : { kind: 'error', message: t('syncingPreset') }
  }

  async function openTarget({ source, sessionId, expertId, input, kind, persistDraft, operationSignal }) {
    const workspaceId = workspaceFor(sessionId)
    if (!workspaceId) throw new Error(t('missingWorkspace'))

    persistDraft()
    const targetId = await ctx.uiWorkspace.connectWorkspace(workspaceId, { agentPreset: expertId })
    operationSignal.throwIfAborted()
    if (targetId === sessionId) throw new Error(t('sameTarget'))

    await ctx.sessions.using(targetId, { source: 'dsh-experts', signal: operationSignal }, async reference => {
      const target = await reference.ready
      operationSignal.throwIfAborted()
      if (ctx.sessions.binding(sessionId) !== source || workspaceFor(sessionId) !== workspaceId) {
        throw new Error(t('sourceChanged'))
      }
      const state = target.session.getSnapshot()
      if (state.openState !== 'open' || !state.blank || state.awaitingFirstTurn || state.pendingSubmissions.length
        || target.session.projections.faceOf('agentPreset').getSnapshot() !== expertId) {
        throw new Error(t('unconfirmedTarget'))
      }

      let feedback
      if (kind === 'retained') {
        feedback = { sourceId: sessionId, targetId, notice: 'draftRetained' }
      } else if (kind === 'text') {
        const outcome = ctx.conversation.input.requestDraftInitialization(target, {
          prompt: input.draft, whenDraftExists: 'keep',
        })
        if (outcome === 'preserved') {
          feedback = {
            sourceId: sessionId, targetId, text: input.draft,
            notice: 'draftConflict',
          }
        } else if (outcome !== 'applied') {
          throw new Error(t('draftBlocked'))
        }
      }
      // The binding is still retained and navigation is current. No async gap between draft prep and open.
      ctx.uiWorkspace.openSession(targetId)
      handoff.set(feedback ?? null)
    })
    return { kind: 'opened' }
  }

  return async function switchExpert({ sessionId, expertId, confirmation, persistDraft }) {
    if (signal.aborted) return { kind: 'cancelled' }
    const source = ctx.sessions.binding(sessionId)
    if (!source) return { kind: 'error', message: t('noSession') }
    const projection = source.session.projections.faceOf('agentPreset')
    if (projection.getSnapshot() === expertId) return { kind: 'unchanged' }
    const expert = directory.getSnapshot().catalog.experts.find(expert => expert.id === expertId)
    if (!expert || expert.unavailable) return unavailable()
    const state = source.session.getSnapshot()
    if (state.openState !== 'open' || state.removed || state.subagent) {
      return { kind: 'error', message: t('unsupportedSession') }
    }
    const input = ctx.conversation.input.for(source.ctx).state.getSnapshot()
    const blockStore = blocks.storeFor(sessionId)
    if (input.phase !== 'plain' || blockStore.getSnapshot() || state.awaitingFirstTurn || state.pendingSubmissions.length) {
      return { kind: 'error', message: t('busyInput') }
    }
    const kind = draftKind(input)
    const inPlace = state.blank && !confirmation?.locked
    if (!inPlace && kind === 'retained' && confirmation?.draftKind !== kind) {
      return { kind: 'confirm', draftKind: kind, locked: Boolean(confirmation?.locked) }
    }

    const operationSignal = inPlace ? signal : AbortSignal.any([signal, ctx.layout.beginNavigation()])
    const block = { reason: t('switching', { name: expert.name }) }
    const release = () => { if (blockStore.getSnapshot() === block) blocks.set(sessionId, undefined) }
    blocks.set(sessionId, block)
    operationSignal.addEventListener('abort', release, { once: true })
    try {
      if (inPlace) {
        const result = await applyInPlace(sessionId, expertId, projection, operationSignal)
        return result.kind === 'locked' ? { kind: 'confirm', draftKind: kind, locked: true } : result
      }
      return await openTarget({ source, sessionId, expertId, input, kind, persistDraft, operationSignal })
    } catch (error) {
      if (operationSignal.aborted) return { kind: 'cancelled' }
      if (unavailableCodes.has(error.code) || unavailableCodes.has(error.rpcError?.code)) return unavailable()
      return { kind: 'error', message: error.message || t('retry') }
    } finally {
      operationSignal.removeEventListener('abort', release)
      release()
    }
  }
}
