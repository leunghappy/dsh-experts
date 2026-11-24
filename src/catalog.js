import { chinese } from './i18n.js'

const generalId = 'builtin:general'
const otherId = 'builtin:other'
const collator = new Intl.Collator('zh-CN')

function normalize(value) {
  return value.normalize('NFKC').trim().toLowerCase()
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function emptyOrganization() {
  return { version: 1, categories: [], tagsByPreset: {} }
}

export function validateOrganization(value, t = chinese) {
  if (value?.version !== 1 || !Array.isArray(value.categories)
    || !value.tagsByPreset || typeof value.tagsByPreset !== 'object' || Array.isArray(value.tagsByPreset)) {
    throw new Error(t('invalidOrganization'))
  }
  const ids = new Set([generalId, otherId])
  const names = new Set(['all', 'general', 'other'].map(key => normalize(chinese(key))))
  for (const category of value.categories) {
    const name = normalize(text(category?.name))
    if (!text(category?.id) || !name || ids.has(category.id) || names.has(name)) {
      throw new Error(t('invalidCategory'))
    }
    ids.add(category.id)
    names.add(name)
  }
  for (const tags of Object.values(value.tagsByPreset)) {
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) {
      throw new Error(t('invalidTags'))
    }
  }
  return value
}

export function updateOrganization(organization, operation, t = chinese) {
  if (operation.kind === 'set-tags') {
    const allowed = new Set([generalId, ...organization.categories.map(category => category.id)])
    const previous = new Set(operation.previousTags)
    const selected = new Set(operation.tags)
    const latest = Object.hasOwn(organization.tagsByPreset, operation.presetId)
      ? organization.tagsByPreset[operation.presetId]
      : operation.previousTags
    const tags = new Set(latest.filter(tag => !previous.has(tag) || selected.has(tag)))
    for (const tag of selected) {
      if (!previous.has(tag)) tags.add(tag)
    }
    return {
      ...organization,
      tagsByPreset: {
        ...organization.tagsByPreset,
        [operation.presetId]: [...tags].filter(tag => allowed.has(tag)),
      },
    }
  }

  const name = text(operation.name)
  if (!name) throw new Error(t('missingCategoryName'))
  if (['all', 'general', 'other'].some(key => normalize(t(key)) === normalize(name))) {
    throw new Error(t('invalidCategory'))
  }
  const id = operation.id
  const category = { id, name }
  if (operation.kind === 'rename-category') {
    if (!organization.categories.some(entry => entry.id === id)) throw new Error(t('missingCategory'))
    return validateOrganization({
      ...organization,
      categories: organization.categories.map(entry => entry.id === id ? category : entry),
    }, t)
  }
  if (operation.kind === 'add-category') {
    return validateOrganization({ ...organization, categories: [...organization.categories, category] }, t)
  }
  throw new Error(t('invalidEdit'))
}

function localizedText(value, resolveText) {
  if (typeof value === 'string') return text(value)
  const zh = text(value?.zh)
  const en = text(value?.en)
  if (!zh || !en) return zh || en
  return resolveText({ zh, en })
}

export function buildCatalog(presets, organization, {
  metadata = {}, builtInIds = [], t = chinese, resolveText = labels => labels.zh,
} = {}) {
  const common = { id: generalId, name: t('general') }
  const other = { id: otherId, name: t('other') }
  const categories = [common, ...organization.categories, other]
  const byCategory = new Map(categories.map(category => [category.id, category]))
  const byId = new Map()
  const builtIns = new Set(builtInIds)
  for (const preset of presets) {
    const id = text(preset?.id)
    if (!id || byId.has(id)) continue
    const extra = Object.hasOwn(metadata, id) ? metadata[id] : undefined
    const tags = Object.hasOwn(organization.tagsByPreset, id)
      ? organization.tagsByPreset[id]
      : builtIns.has(id) ? [common.id] : []
    const categoryIds = [...new Set(tags)].filter(tag => tag !== other.id && byCategory.has(tag))
    const memberships = (categoryIds.length ? categoryIds : [other.id]).map(tag => byCategory.get(tag))
    const name = localizedText(extra?.name, resolveText) || localizedText(preset.name, resolveText) || id
    const aliases = new Set(Array.isArray(extra?.aliases) ? extra.aliases.map(text).filter(Boolean) : [])
    for (const label of [extra?.name?.zh, extra?.name?.en, preset.name, preset.name?.zh, preset.name?.en]) {
      if (text(label) && normalize(label) !== normalize(name)) aliases.add(text(label))
    }
    byId.set(id, {
      id,
      name,
      description: localizedText(extra?.description, resolveText) || localizedText(preset.description, resolveText),
      categoryIds,
      categories: memberships,
      aliases: [...aliases],
      avatar: text(extra?.avatar),
      unavailable: text(preset.unavailable) || text(preset.broken),
      order: byId.size,
    })
  }
  const experts = [...byId.values()]
  const counts = new Map()
  for (const expert of experts) {
    const name = normalize(expert.name)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  for (const expert of experts) {
    expert.disambiguate = counts.get(normalize(expert.name)) > 1
  }
  return { categories, experts }
}

function matchRank(candidate, query) {
  const name = normalize(candidate.name)
  const aliases = candidate.aliases.map(normalize)
  if (name === query) return 0
  if (aliases.includes(query)) return 1
  if (name.startsWith(query)) return 2
  if (aliases.some(alias => alias.startsWith(query))) return 3
  if (name.includes(query)) return 4
  if (aliases.some(alias => alias.includes(query))) return 5
  return Infinity
}

export function searchExperts(catalog, { query = '', categoryId, selectableOnly = false } = {}) {
  const search = normalize(query)
  return catalog.experts
    .filter(expert => (!categoryId || expert.categories.some(category => category.id === categoryId))
      && (!selectableOnly || !expert.unavailable))
    .map(expert => ({ expert, rank: search ? matchRank(expert, search) : 0 }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank || a.expert.order - b.expert.order
      || collator.compare(a.expert.name, b.expert.name) || a.expert.id.localeCompare(b.expert.id))
    .map(({ expert }) => expert)
}
