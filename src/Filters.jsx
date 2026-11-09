// Metadata filters: one control per field, folded under the status filter, with the active ones as chips you can drop.
// Search is for contents (names, branches, commits, files); this is for pinpointing by your own fields.
// value: { [id(field)]: want }, want is '' (any), 'yes' | 'no' (Yes / No), 'set' | 'empty', an '=value' for short text,
// or 'overdue' | 'soon' | 'later' for dates. A filter on a local field only matches the repo that has it.
import { ChevronDownIcon, FilterIcon, XIcon } from '@primer/octicons-react'
import { fieldsFor } from '../server/meta.js'
import { Scope } from './Meta.jsx'

export const id = (f) => `${f.repo ?? ''}|${f.key}`
const day = (offset = 0) => new Date(Date.now() + offset * 86400_000).toLocaleDateString('sv') // YYYY-MM-DD, local
const OPTIONS = {
  boolean: [['yes', 'Yes'], ['no', 'No']],
  text: [['set', 'Has text'], ['empty', 'Empty']],
  date: [['overdue', 'Overdue'], ['soon', 'Next 7 days'], ['later', 'Later'], ['empty', 'Empty']],
}
// Short text: the values in use, so you pick instead of type.
const options = (f, repos) => OPTIONS[f.type] ?? [
  ...[...new Set(repos.map((r) => r.meta?.[f.key]).filter((v) => typeof v === 'string'))].sort().map((v) => ['=' + v, v]),
  ['empty', 'Empty'],
]

function matches(v, want) {
  const today = day()
  if (want === 'yes') return v === true
  if (want === 'no') return v !== true
  if (want === 'set') return v !== undefined
  if (want === 'empty') return v === undefined
  if (want === 'overdue') return v !== undefined && v < today
  if (want === 'soon') return v !== undefined && v >= today && v <= day(7)
  if (want === 'later') return v !== undefined && v > day(7)
  return v === want.slice(1)
}

export const active = (fields, value) => fields.filter((f) => value[id(f)])
export const metaHit = (r, fields, value) => active(fields, value)
  .every((f) => fieldsFor(fields, r.path).includes(f) && matches(r.meta?.[f.key], value[id(f)]))

export function MetaFilters({ fields, repos, value, onChange }) {
  const set = (f, want) => onChange({ ...value, [id(f)]: want })
  const on = active(fields, value)
  const label = (f) => options(f, repos).find(([k]) => k === value[id(f)])?.[1] ?? value[id(f)].slice(1)
  return (
    <>
      <details className="mfilt">
        <summary>
          <FilterIcon size={14} />Metadata{on.length > 0 && <b>{on.length}</b>}<ChevronDownIcon size={14} />
        </summary>
        <div className="mfilt__body">
          {fields.map((f) => (
            <label key={id(f)} className="mf">
              <span><b>{f.key}</b><Scope f={f} /></span>
              <select className="select" value={value[id(f)] ?? ''} onChange={(e) => set(f, e.target.value)}>
                <option value="">Any</option>
                {options(f, repos).map(([k, text]) => <option key={k} value={k}>{text}</option>)}
              </select>
            </label>
          ))}
        </div>
      </details>
      {on.length > 0 && (
        <div className="chips">
          {on.map((f) => (
            <button key={id(f)} className="chip" onClick={() => set(f, '')} title="Remove this filter">
              {f.key}: <b>{label(f)}</b><XIcon size={12} />
            </button>
          ))}
          <button className="more" onClick={() => onChange({})}>Clear</button>
        </div>
      )}
    </>
  )
}
