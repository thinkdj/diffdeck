// Metadata: fields you define, with a value per repo. A field is global (every repo has it) or local
// (only the repo in its `repo`), for example
//   { key: 'Ottabase', desc: 'Defines if the repo runs off Ottabase Framework', type: 'boolean' }    global
//   { key: 'Store status', desc: 'Where the build is in review', type: 'string', repo: '/code/app' }  local
// Saved in ~/.diffdeck.json next to the watched folders, never in the repo:
//   { "roots": [...], "fields": [...], "meta": { "<repo path>": { "Ottabase": true } } }
// A name is unique among the fields a repo can see: no two globals share one, and a local can't reuse a global's.
// Pure functions over that config (no Node APIs), so the API (server/api.js) and the demo (src/demo.js) share them.
// Each one returns a new config, or throws an Error whose message the page shows as is.

// The types a field can have, with the label the page shows for each.
export const TYPES = { boolean: 'Yes / No', string: 'Short text', text: 'Long text', date: 'Date' }

// What a stored value must look like. Empty values ('' or false) are never stored: they clear the field.
const FITS = {
  boolean: (v) => v === true,
  string: (v) => typeof v === 'string' && v.length <= 200 && !v.includes('\n'),
  text: (v) => typeof v === 'string' && v.length <= 10_000,
  date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v), // what <input type="date"> gives
}
const NEEDS = { boolean: 'yes or no', string: 'one line, up to 200 characters', text: 'up to 10,000 characters', date: 'a date like 2026-12-31' }

const without = (vals, key) => Object.fromEntries(Object.entries(vals).filter(([k]) => k !== key))
// Rewrite the values of every repo (or only `only`, for a local field), dropping repos left with none.
const eachRepo = (meta = {}, only, fn) => Object.fromEntries(Object.entries(meta)
  .map(([p, vals]) => [p, !only || p === only ? fn(vals) : vals])
  .filter(([, vals]) => Object.keys(vals).length))
const sameField = (f, key, repo) => f.key === key && (f.repo ?? null) === (repo || null)

// The fields one repo has: every global, then its own locals.
export const fieldsFor = (fields = [], path) => [...fields.filter((f) => !f.repo), ...fields.filter((f) => f.repo === path)]

// A repo as the page gets it: its values ride along as r.meta. A field the repo has no value for shows its default;
// a stored null means "cleared on purpose" and beats the default. The page never sees null.
export function withMeta(cfg, repo) {
  const stored = cfg.meta?.[repo.path] ?? {}
  const meta = {}
  for (const f of fieldsFor(cfg.fields, repo.path)) {
    const v = Object.hasOwn(stored, f.key) ? stored[f.key] : f.default
    if (v != null) meta[f.key] = v
  }
  return { ...repo, meta }
}

// Add a field, or change one: `was` names the field being edited. `repo` makes it local to that repo (it can't
// change later). Values follow a rename; a type change keeps only the values that still fit (Short text to Long
// text keeps all, Yes / No to Date keeps none). `default` is optional: what repos without a value of their own show.
export function saveField(cfg, { was, key, desc, type, repo, default: def } = {}) {
  const fields = cfg.fields ?? []
  key = String(key ?? '').trim()
  desc = String(desc ?? '').trim()
  if (!key) throw new Error('Give the field a name.')
  if (key.length > 40) throw new Error('Keep the name under 40 characters.')
  if (desc.length > 200) throw new Error('Keep the description under 200 characters.')
  if (key in {}) throw new Error(`"${key}" is a reserved word. Pick another name.`) // constructor, __proto__, …: unsafe as object keys
  if (!Object.hasOwn(TYPES, type)) throw new Error('Pick a type.')
  if (repo != null && (typeof repo !== 'string' || !repo)) throw new Error('Which repo?')
  if (typeof def === 'string') def = def.trim()
  if (def === '' || def === false) def = null // an empty default is no default
  if (def != null && !FITS[type](def)) throw new Error(`The default for ${key} takes ${NEEDS[type]}.`)
  const i = was == null ? -1 : fields.findIndex((f) => sameField(f, was, repo))
  if (was != null && i < 0) throw new Error(`There is no field called ${was}.`)
  // a global clashes with any field of that name, a local with globals and its own repo's locals
  if (fields.some((f, j) => j !== i && f.key === key && (!repo || !f.repo || f.repo === repo))) {
    throw new Error(`There is already a field called ${key}${repo ? ' for this repo' : ''}.`)
  }
  const field = { key, desc, type, ...(def != null && { default: def }), ...(repo && { repo }) }
  const keep = (v) => (v === null ? def != null : FITS[type](v)) // a cleared-on-purpose null only matters while there is a default
  if (i < 0) return { ...cfg, fields: [...fields, field] }
  return {
    ...cfg,
    fields: fields.with(i, field),
    meta: eachRepo(cfg.meta, repo, (vals) => {
      const rest = without(vals, was)
      return Object.hasOwn(vals, was) && keep(vals[was]) ? { ...rest, [key]: vals[was] } : rest
    }),
  }
}

// Delete a field and its values: in every repo for a global, in its own repo for a local.
export const removeField = (cfg, key, repo) => ({
  ...cfg,
  fields: (cfg.fields ?? []).filter((f) => !sameField(f, key, repo)),
  meta: eachRepo(cfg.meta, repo, (vals) => without(vals, key)),
})

// Set one repo's value for one field. '', false or null clears it: the key goes, or becomes null when the field
// has a default, so the repo stays empty instead of falling back to the default.
export function setValue(cfg, { path, key, value } = {}) {
  if (typeof path !== 'string' || !path) throw new Error('Which repo?')
  const field = fieldsFor(cfg.fields, path).find((f) => f.key === key)
  if (!field) throw new Error(`There is no field called ${key}.`)
  const v = typeof value === 'string' ? value.trim() : value
  const empty = v === '' || v === false || v == null
  if (!empty && !FITS[field.type](v)) throw new Error(`${key} takes ${NEEDS[field.type]}.`)
  const rest = without(cfg.meta?.[path] ?? {}, key)
  const vals = !empty ? { ...rest, [key]: v } : field.default != null ? { ...rest, [key]: null } : rest
  const meta = { ...cfg.meta, [path]: vals }
  if (!Object.keys(vals).length) delete meta[path]
  return { ...cfg, meta }
}
