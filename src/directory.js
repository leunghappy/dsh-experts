import { buildCatalog, emptyOrganization, updateOrganization, validateOrganization } from './catalog.js'
import { chinese } from './i18n.js'

export function createDirectory({ readPresets, readOrganization, saveOrganization, subscribeOrganization, t = chinese, ...options }) {
  const catalogOf = (presets, organization) => buildCatalog(presets, organization, { ...options, t })
  let presets = []
  let organization = emptyOrganization()
  let state = { status: 'idle', error: '', organizationError: '', catalog: catalogOf(presets, organization) }
  const listeners = new Set()
  let readSequence = 0
  let disposed = false

  function publish(patch) {
    if (disposed) return
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  function installOrganization(next) {
    organization = next
    publish({ organizationError: '', catalog: catalogOf(presets, organization) })
  }

  function loadOrganization() {
    try {
      installOrganization(readOrganization())
    } catch (error) {
      publish({ organizationError: error.message })
    }
  }

  loadOrganization()
  const stop = subscribeOrganization(loadOrganization)

  async function refresh() {
    const sequence = ++readSequence
    publish({ status: 'loading', error: '' })
    try {
      const fetched = await readPresets()
      if (disposed || sequence !== readSequence) return
      presets = fetched
      publish({ status: 'ready', catalog: catalogOf(presets, organization) })
    } catch (error) {
      if (sequence === readSequence) publish({ status: 'error', error: error.message })
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refresh,
    relocalize() {
      publish({ catalog: catalogOf(presets, organization) })
    },
    async edit(operation) {
      if (disposed) throw new Error(t('closedDirectory'))
      const next = await saveOrganization(latest => updateOrganization(latest, operation, t))
      installOrganization(next)
    },
    dispose() {
      disposed = true
      stop()
      listeners.clear()
    },
  }
}

// A namespace per DSH application mount, shared by windows of that origin.
export function browserOrganization(window, t = chinese) {
  const base = new URL(window.document.baseURI)
  const key = `dsh-experts:organization:v1:${base.pathname}`

  function readOrganization() {
    const value = window.localStorage.getItem(key)
    return value === null ? emptyOrganization() : validateOrganization(JSON.parse(value), t)
  }

  return {
    readOrganization,
    subscribeOrganization(listener) {
      const onStorage = event => { if (event.key === key || event.key === null) listener() }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
    async saveOrganization(update) {
      const save = () => {
        const next = update(readOrganization())
        window.localStorage.setItem(key, JSON.stringify(next))
        return next
      }
      // Web Locks serialize the read-modify-write across same-origin windows.
      return window.navigator.locks ? window.navigator.locks.request(key, save) : save()
    },
  }
}
