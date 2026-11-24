import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { MenuSurface } from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { searchExperts } from './catalog.js'
import { browserOrganization, createDirectory } from './directory.js'
import { createExpertSwitcher } from './switch-expert.js'
import { dictionaries, localeNamespace } from './i18n.js'
import metadata from './expert-metadata.json'
import stylesheet from './styles.css'

const panelId = 'dsh-experts'
const builtInIds = ['standard', 'ptc', 'minimal', 'cordis']

function ExpertsIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="7" r="3" />
    <path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M18 5v6m-3-3h6" />
  </svg>
}

const iconPaths = {
  search: 'M16 16l4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  refresh: 'M20 6v5h-5m-10 4a7 7 0 0 0 12 3M4 18v-5h5m10-4A7 7 0 0 0 7 6',
  down: 'm6 9 6 6 6-6',
  right: 'm9 6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
}

function UiIcon({ name, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={iconPaths[name]} />
  </svg>
}

function Avatar({ expert }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [expert?.avatar])
  return <span className="dx-avatar" aria-hidden="true">
    {expert?.avatar && !broken
      ? <img alt="" src={expert.avatar} onError={() => setBroken(true)} />
      : <ExpertsIcon />}
  </span>
}

function CategoryTabs({ categories, selected, onSelect, t }) {
  return <div className="dx-categories" role="group" aria-label={t('categories')}>
    <button type="button" className="dx-tab" aria-pressed={selected === ''} onClick={() => onSelect('')}>{t('all')}</button>
    {categories.map(category => <button type="button" className="dx-tab" key={category.id}
      aria-pressed={category.id === selected} onClick={() => onSelect(category.id)}>{category.name}</button>)}
  </div>
}

function DirectoryStatus({ state, hasResults, hasExperts, t }) {
  return <>
    {state.status === 'loading' && <p className="dx-status" role="status">{t('loading')}</p>}
    {state.error && <p className="dx-message" role="alert">{t('refreshFailed', { reason: state.error })}</p>}
    {state.organizationError && <p className="dx-message" role="alert">{state.organizationError}</p>}
    {state.status === 'ready' && !hasResults && <p className="dx-status" role="status">
      {t(hasExperts ? 'noMatch' : 'noExperts')}
    </p>}
  </>
}

function expertLabel(expert, t) {
  return expert.disambiguate ? t('identifiedExpert', { name: expert.name, id: expert.id }) : expert.name
}

function ExpertIdentity({ expert }) {
  return <>
    <Avatar expert={expert} />
    <span className="dx-identity">
      <span className="dx-name">{expert.name}</span>
      {expert.disambiguate && <span className="dx-detail">{expert.id}</span>}
    </span>
  </>
}

function CategoryEditor({ categories, editDirectory, onSaved, t }) {
  const [id, setId] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectId = useId()

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const categoryId = id || crypto.getRandomValues(new Uint32Array(4)).join('-')
      await editDirectory({ kind: id ? 'rename-category' : 'add-category', id: categoryId, name: text })
      onSaved(t(id ? 'renameSuccess' : 'createSuccess', { name: text.trim() }))
      setId('')
      setText('')
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <form className="dx-editor" onSubmit={submit}>
    <label htmlFor={selectId}>{t('categoryEditor')}</label>
    <div className="dx-form-row">
      <select className="dx-input" id={selectId} value={id} disabled={busy} onChange={event => {
        const category = categories.find(category => category.id === event.target.value)
        setId(category?.id ?? '')
        setText(category?.name ?? '')
        setError('')
      }}>
        <option value="">{t('newCategory')}</option>
        {categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
      </select>
      <input className="dx-input" value={text} maxLength={60} placeholder={t('categoryName')} aria-label={t('categoryName')}
        disabled={busy} onChange={event => setText(event.target.value)} />
      <button className="dx-control" type="submit" disabled={busy || !text.trim()}>
        {t(busy ? 'saving' : id ? 'saveName' : 'create')}
      </button>
    </div>
    {error && <p className="dx-message" role="alert">{error}</p>}
  </form>
}

function TagEditor({ expert, categories, onClose, onSaved, editDirectory, t }) {
  const [previousTags] = useState(expert.categoryIds)
  const [selected, setSelected] = useState(previousTags)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await editDirectory({ kind: 'set-tags', presetId: expert.id, tags: selected, previousTags })
      onSaved()
    } catch (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return <form className="dx-editor dx-tag-editor" onSubmit={save}>
    <fieldset disabled={busy}>
      <legend>{t('selectTags', { name: expertLabel(expert, t) })}</legend>
      {categories.map(category => <label className="dx-option" key={category.id}>
        <input type="checkbox" checked={selected.includes(category.id)} onChange={event => {
          const checked = event.target.checked
          setSelected(previous => checked ? [...previous, category.id] : previous.filter(id => id !== category.id))
        }} />
        {category.name}
      </label>)}
    </fieldset>
    {error && <p className="dx-message" role="alert">{error}</p>}
    <div className="dx-form-row">
      <button className="dx-control" type="submit" disabled={busy}>{t(busy ? 'saving' : 'saveTags')}</button>
      <button className="dx-control" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button>
    </div>
  </form>
}

function ManagementPage({ useExpertDirectory, refreshDirectory, editDirectory, goBack, t }) {
  const state = useExpertDirectory(snapshot => snapshot)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState('')
  const [showCategories, setShowCategories] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const { categories, experts } = state.catalog
  const results = searchExperts(state.catalog, { query, categoryId: category })

  return <section className="dx-page" aria-label={t('management')}>
    <div className="dx-page-inner">
      <header className="dx-page-header">
        <h1>{t('management')}</h1>
        <button className="dx-control" type="button" onClick={goBack}>{t('returnToChat')}</button>
      </header>
      <div className="dx-toolbar">
        <div className="dx-search-box dx-management-search">
          <UiIcon name="search" />
          <input className="dx-input dx-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder={t('expertSearchFull')} aria-label={t('expertSearch')} />
        </div>
        <button className="dx-control" type="button" aria-expanded={showCategories}
          onClick={() => setShowCategories(value => !value)}>{t('manageCategories')}</button>
        <button className="dx-control" type="button" disabled={state.status === 'loading'}
          onClick={refreshDirectory}><UiIcon name="refresh" size={14} />{t('refresh')}</button>
      </div>
      {showCategories && <CategoryEditor categories={categories.slice(1, -1)} editDirectory={editDirectory}
        onSaved={setSavedMessage} t={t} />}
      <CategoryTabs categories={categories} selected={category} onSelect={setCategory} t={t} />
      {savedMessage && <p className="dx-status" role="status">{savedMessage}</p>}
      <DirectoryStatus t={t} state={state} hasResults={results.length > 0} hasExperts={experts.length > 0} />
      <div className="dx-card-grid">
        {results.map(expert => <article className="dx-card" key={expert.id} aria-label={expert.name}>
          <header className="dx-card-heading">
            <ExpertIdentity expert={expert} />
            {expert.unavailable && <span className="dx-tag" title={expert.unavailable}>{t('unavailable')}</span>}
          </header>
          <p className="dx-card-description">{expert.description || t('missingDescription')}</p>
          <footer className="dx-card-footer">
            <div className="dx-tags" aria-label={t('tags')}>
              {expert.categories.map(tag => <span className="dx-tag" key={tag.id}>{tag.name}</span>)}
            </div>
            <button className="dx-control dx-quiet" type="button" aria-expanded={editing === expert.id}
              aria-label={t('editExpertTags', { name: expertLabel(expert, t) })}
              onClick={() => {
                setSavedMessage('')
                setEditing(value => value === expert.id ? '' : expert.id)
              }}>
              {t('editTags')}
            </button>
          </footer>
          {editing === expert.id && <TagEditor t={t} expert={expert} categories={categories.slice(0, -1)} editDirectory={editDirectory}
            onClose={() => setEditing('')} onSaved={() => {
              setSavedMessage(t('tagsSaved', { name: expert.name }))
              setEditing('')
            }} />}
        </article>)}
      </div>
    </div>
  </section>
}

function HandoffNotice({ sessionId, useExpertHandoff, returnToSource, dismiss, t }) {
  const feedback = useExpertHandoff(value => value?.targetId === sessionId ? value : null)
  const [copyStatus, setCopyStatus] = useState('')
  if (!feedback) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedback.text)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('copyFailed')
    }
  }

  return <div className="dx-handoff">
    <p role="status">{t(copyStatus || feedback.notice)}</p>
    <div className="dx-form-row">
      <button className="dx-control dx-quiet" type="button" onClick={() => returnToSource(feedback.sourceId)}>{t('returnToSource')}</button>
      {feedback.text !== undefined && <button className="dx-control dx-quiet" type="button" onClick={copy}>{t('copyText')}</button>}
      <button className="dx-control dx-quiet dx-icon-button" type="button" aria-label={t('closeDraftNotice')}
        onClick={() => { setCopyStatus(''); dismiss() }}><UiIcon name="close" size={14} /></button>
    </div>
  </div>
}

function Picker({ useExpertDirectory, refreshDirectory, useProjection, openManagement, sessionId, inputActions, switchExpert, t }) {
  const preset = useProjection('agentPreset')
  const currentId = typeof preset === 'string' ? preset : null
  const state = useExpertDirectory(snapshot => snapshot)
  const current = state.catalog.experts.find(expert => expert.id === currentId)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const [query, setQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [category, setCategory] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const trigger = useRef(null)
  const overlay = useRef(null)
  const field = useRef(null)
  const categoryField = useRef(null)
  const cancelConfirmation = useRef(null)
  const instance = useId()
  const categories = [{ id: '', name: t('all') }, ...state.catalog.categories]
  const categorySearch = categoryQuery.normalize('NFKC').trim().toLowerCase()
  const shownCategories = categories.filter(item => item.name.normalize('NFKC').toLowerCase().includes(categorySearch))
  const categoryName = category ? categories.find(item => item.id === category)?.name : t('allExperts')
  const results = searchExperts(state.catalog, { query, categoryId: category })
  const currentName = current?.name ?? currentId ?? t(preset === null ? 'noPreset' : 'expert')
  const preview = results.find(expert => expert.id === previewId)

  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const bounds = trigger.current?.getBoundingClientRect()
      if (!bounds) return
      const edge = 12
      const gap = 8
      const topInset = Math.max(edge, parseFloat(getComputedStyle(document.body)
        .getPropertyValue('--dsh-frame-overlay-top')) || 0)
      const above = bounds.top - topInset - gap
      const below = window.innerHeight - bounds.bottom - edge - gap
      const opensUp = above >= 400 || above >= below
      const free = opensUp ? above : below
      const height = Math.min(400, free >= 230 ? free : window.innerHeight - topInset - edge)
      const top = free < 230 ? topInset : opensUp ? bounds.top - gap - height : bounds.bottom + gap
      setAnchor({ '--dx-picker-top': `${top}px`, '--dx-picker-left': `${bounds.left}px`, '--dx-picker-height': `${height}px` })
    }
    const onScroll = event => {
      if (!(event.target instanceof Node) || !overlay.current?.contains(event.target)) update()
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const displayed = open && anchor !== null
  useEffect(() => { if (displayed) field.current?.focus() }, [displayed])
  useEffect(() => { if (confirmation) cancelConfirmation.current?.focus() }, [confirmation])

  useEffect(() => {
    if (!open) return
    const closeOutside = event => {
      if (!pending.current && !overlay.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [open])

  function close() {
    if (pending.current) return
    setOpen(false)
    trigger.current?.focus()
  }

  function toggle() {
    if (pending.current) return
    if (open) return close()
    setQuery('')
    setCategoryQuery('')
    setCategory('')
    setPreviewId('')
    setNotice('')
    setConfirmation(null)
    setOpen(true)
  }

  async function choose(expert, confirmed = null) {
    if (pending.current || expert.unavailable) return
    if (expert.id === currentId) return close()
    pending.current = true
    setBusy(expert.name)
    setNotice('')
    setConfirmation(null)
    try {
      const result = await switchExpert({ sessionId, expertId: expert.id, confirmation: confirmed,
        persistDraft: () => inputActions.persistDraft() })
      if (!mounted.current) return
      pending.current = false
      if (result.kind === 'confirm') setConfirmation({ ...result, expert })
      else if (result.kind === 'opened' || result.kind === 'cancelled') setOpen(false)
      else if (result.kind === 'applied' || result.kind === 'unchanged') close()
      else setNotice(result.message)
    } catch (error) {
      if (mounted.current) setNotice(error.message || t('retry'))
    } finally {
      pending.current = false
      if (mounted.current) setBusy('')
    }
  }

  function selectCategory(id) {
    if (pending.current) return
    setCategory(id)
    setPreviewId('')
    setNotice('')
    setConfirmation(null)
  }

  function handleKeys(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (confirmation) {
        setConfirmation(null)
        field.current?.focus()
        return
      }
      close()
      return
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const pane = event.target.closest('[data-dx-pane]')
    if (!pane) return
    const option = event.target.closest('[data-dx-option]')
    if (option && event.key === 'ArrowRight' && pane.dataset.dxPane === 'categories') {
      event.preventDefault()
      field.current?.focus()
    } else if (option && event.key === 'ArrowLeft' && pane.dataset.dxPane === 'experts') {
      event.preventDefault()
      categoryField.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const options = [...pane.querySelectorAll('[data-dx-option]')]
      if (!options.length) return
      event.preventDefault()
      const index = options.indexOf(option)
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = index < 0 ? (step === 1 ? 0 : options.length - 1) : (index + step + options.length) % options.length
      options[next].focus()
    }
  }

  return <span className="dx-picker-anchor">
    <button className="dx-trigger" type="button" ref={trigger} onClick={toggle} aria-haspopup="dialog" aria-disabled={Boolean(busy)}
      aria-controls={displayed ? `${instance}-picker` : undefined} aria-expanded={displayed}
      aria-label={t('currentExpert', { name: currentName })} aria-describedby={`${instance}-about`}>
      <Avatar expert={current} /><span className="dx-trigger-name">{currentName}</span><UiIcon name="down" size={12} />
    </button>
    <span id={`${instance}-about`} className="dx-current-tip" role="tooltip">{current?.description || t('missingDescription')}</span>
    {displayed && createPortal(<div id={`${instance}-picker`} className="dx-popover" style={anchor} ref={overlay}
      role="dialog" aria-labelledby={`${instance}-title`} onKeyDown={handleKeys}>
      <MenuSurface>
        <div className="dx-picker-content">
          <header className="dx-picker-header">
            <h2 id={`${instance}-title`}>{t('chooseExpert')}</h2>
            <button className="dx-control dx-quiet dx-icon-button" type="button" onClick={close}
              disabled={Boolean(busy)} aria-label={t('closePicker')}>
              <UiIcon name="close" />
            </button>
          </header>
          <div className="dx-picker-split">
            <section className="dx-picker-pane dx-picker-categories" data-dx-pane="categories" aria-label={t('categories')}>
              <label className="dx-pane-title" htmlFor={`${instance}-categories`}>{t('category')}</label>
              <div className="dx-search-box">
                <UiIcon name="search" />
                <input className="dx-input dx-search" id={`${instance}-categories`} ref={categoryField}
                  type="search" value={categoryQuery} placeholder={t('categorySearch')} aria-label={t('categorySearch')}
                  readOnly={Boolean(busy)} onChange={event => setCategoryQuery(event.target.value)} />
              </div>
              <ul className="dx-picker-list" aria-label={t('categoryList')}>
                {shownCategories.map(item => <li key={item.id}>
                  <button className="dx-picker-category" data-dx-option type="button" aria-pressed={category === item.id}
                    aria-disabled={Boolean(busy)}
                    onClick={() => selectCategory(item.id)}>
                    <span>{item.name}</span><UiIcon name="right" size={14} />
                  </button>
                </li>)}
                {!shownCategories.length && <li className="dx-status" role="status">{t('noCategories')}</li>}
              </ul>
            </section>
            <section className="dx-picker-pane" data-dx-pane="experts" aria-label={t('expertsInCategory')}>
              <label className="dx-pane-title" htmlFor={`${instance}-experts`}>{categoryName}</label>
              <div className="dx-search-box">
                <UiIcon name="search" />
                <input className="dx-input dx-search" id={`${instance}-experts`} ref={field} value={query}
                  type="search" placeholder={t('searchNameAlias')} aria-label={t('expertSearch')}
                  readOnly={Boolean(busy)} onChange={event => {
                    setQuery(event.target.value); setPreviewId(''); setNotice(''); setConfirmation(null)
                  }} />
              </div>
              <div className="dx-picker-results">
                <DirectoryStatus t={t} state={state} hasResults={results.length > 0} hasExperts={state.catalog.experts.length > 0} />
                <ul className="dx-picker-list" aria-label={t('expertList')}>
                  {results.map(expert => <li key={expert.id}>
                    <button type="button" className="dx-picker-row" data-dx-option aria-current={expert.id === currentId}
                      aria-disabled={Boolean(expert.unavailable || busy)} onClick={() => choose(expert)}
                      onFocus={() => setPreviewId(expert.id)} onPointerEnter={event => {
                        if (event.pointerType === 'mouse') setPreviewId(expert.id)
                      }}>
                      <ExpertIdentity expert={expert} />
                      {expert.unavailable && <span className="dx-tag">{t('unavailable')}</span>}
                      {expert.id === currentId && <span className="dx-tag dx-current">{t('current')}</span>}
                    </button>
                  </li>)}
                </ul>
                {preview && <div className="dx-preview" role="status">
                  <strong>{preview.name}</strong>
                  <span>{preview.description || t('missingDescription')}</span>
                  <span className="dx-detail">{preview.categories.map(tag => tag.name).join(' · ')}</span>
                  {preview.unavailable && <span>{t('unavailable')} · {preview.unavailable}</span>}
                </div>}
              </div>
            </section>
          </div>
          {busy && <p className="dx-message" role="status">{t('switching', { name: busy })}</p>}
          {notice && <p className="dx-message" role="alert">{t('notice', { message: notice })}</p>}
          {confirmation && <div className="dx-message dx-confirm" role="group" aria-label={t('confirmOpen')}>
            <p role="status">{confirmation.locked && t('started')} {t('opening', { name: confirmation.expert.name })}
              {confirmation.draftKind === 'retained' && ` ${t('retainedHint')}`}</p>
            <div className="dx-form-row">
              <button className="dx-control" type="button" onClick={() => choose(confirmation.expert, confirmation)}>{t('openSession')}</button>
              <button className="dx-control dx-quiet" ref={cancelConfirmation} type="button" onClick={() => {
                setConfirmation(null); field.current?.focus()
              }}>{t('stay')}</button>
            </div>
          </div>}
          <footer className="dx-picker-footer">
            <button className="dx-control dx-quiet" type="button" disabled={Boolean(busy)} onClick={openManagement}>
              <ExpertsIcon />{t('management')}
            </button>
            <button className="dx-control dx-quiet" type="button" disabled={Boolean(busy) || state.status === 'loading'}
              onClick={refreshDirectory}><UiIcon name="refresh" size={14} />{t('refresh')}</button>
          </footer>
        </div>
      </MenuSurface>
    </div>, document.body)}
  </span>
}

export default {
  name: 'dsh-experts-client',
  inject: ['slots', 'locale', 'layout', 'remote', 'remote.agentPresets', 'sessions', 'conversation', 'workspaces', 'uiWorkspace'],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(localeNamespace, dictionaries))
    const t = ctx.locale.bind(localeNamespace)
    ctx.effect(() => {
      const style = document.createElement('style')
      style.textContent = stylesheet
      document.head.append(style)
      return () => style.remove()
    })

    const directory = createDirectory({
      ...browserOrganization(window, t), builtInIds, metadata, t,
      resolveText: labels => ctx.locale.resolveText(labels),
      async readPresets() {
        const result = await ctx.remote.agentPresets.list()
        if (!result.ok) throw new Error(result.error.message)
        if (!Array.isArray(result.value?.presets)) throw new Error(t('invalidRoster'))
        return result.value.presets
      },
    })
    ctx.effect(() => () => directory.dispose())
    ctx.on('locale/change', directory.relocalize)
    void directory.refresh()

    const lifetime = new AbortController()
    ctx.effect(() => () => lifetime.abort())
    const handoff = createSnapshotStore(null)
    const switchExpert = createExpertSwitcher({ ctx, directory, signal: lifetime.signal, handoff, t })
    const hooks = { expertDirectory: directory, expertHandoff: handoff }
    const refreshDirectory = () => { void directory.refresh() }
    ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main', key: panelId, locale: localeNamespace,
      inject: () => ({
        hooks, refreshDirectory, editDirectory: directory.edit,
        goBack: () => ctx.layout.selectPanel(null),
      }),
    }, ManagementPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: panelId, order: 1, label: () => t('management') }, ExpertsIcon,
    ))
    ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
      name: 'conversation.input.left', id: panelId, locale: localeNamespace,
      inject: () => ({ hooks, refreshDirectory, switchExpert, openManagement: () => ctx.layout.selectPanel(panelId) }),
    }, Picker))
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock', id: panelId, locale: localeNamespace,
      inject: () => ({
        hooks, dismiss: () => handoff.set(null),
        returnToSource(sourceId) {
          ctx.uiWorkspace.openSession(sourceId)
          handoff.set(null)
        },
      }),
    }, HandoffNotice))
  },
}
