// Metadata in the page: your own fields (server/meta.js), shown as tags in the list, filled in the details pane,
// and defined in the Metadata fields dialog. A field is Global (every repo) or Local (one repo); values are per repo.
// Each input saves on its own, there is no Save button:
//   Yes / No  saves on toggle          Short text, Date  save on Enter or when you leave the box
//   Long text saves on Ctrl+Enter or when you leave the box          Esc undoes an edit you haven't saved
import { useEffect, useRef, useState } from 'react'
import { CalendarIcon, CheckIcon, CheckboxIcon, GearIcon, GlobeIcon, NoteIcon, PencilIcon, PlusIcon, RepoIcon, TrashIcon, TypographyIcon, XIcon } from '@primer/octicons-react'
import { TYPES, fieldsFor } from '../server/meta.js'
import { Seg } from './Seg.jsx'
import { useConfirm } from './Confirm.jsx'

const ICON = { boolean: CheckboxIcon, string: TypographyIcon, text: NoteIcon, date: CalendarIcon }
const LIMIT = { string: 200, text: 10_000 } // same limits server/meta.js checks
// Only local fields are tagged: global is the default, so it needs no label. The tooltip names the repo, because the
// metadata filters list every repo's local fields side by side.
export const Scope = ({ f }) => f.repo && <span className="scope" title={`Only ${f.repo.split(/[\\/]/).pop()} has this field`}>Local</span>
const day = (v) => new Date(v + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) // T00:00: local, not UTC

// In the list: one quiet tag per filled field, compact so they share one line. Yes / No shows its name, short text and
// dates just the value (the name is in the tooltip). Long text stays in the details pane.
export function Tags({ r, fields }) {
  const set = fieldsFor(fields, r.path).filter((f) => f.type !== 'text' && r.meta?.[f.key] !== undefined)
  if (!set.length) return null
  return (
    <span className="tags">
      {set.map((f) => (
        <span key={f.key} className="tag" title={f.type === 'boolean' ? f.key : `${f.key}: ${r.meta[f.key]}`}>
          {f.type === 'boolean' && <CheckIcon size={12} />}
          {f.type === 'date' && <CalendarIcon size={12} />}
          <b>{f.type === 'boolean' ? f.key : f.type === 'date' ? day(r.meta[f.key]) : r.meta[f.key]}</b>
        </span>
      ))}
    </span>
  )
}

// One input. Uncontrolled: the key changes with the saved value, so a fresh value from the server remounts it.
function Value({ f, value, onSave }) {
  if (f.type === 'boolean') {
    return <input type="checkbox" role="switch" className="switch" defaultChecked={value === true} onChange={(e) => onSave(e.target.checked)} />
  }
  const saved = value ?? ''
  const commit = (e) => e.target.value.trim() !== saved && onSave(e.target.value)
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation() // undo the edit, don't close the panel
      e.target.value = saved
      e.target.blur()
    }
    if (e.key === 'Enter' && (f.type !== 'text' || e.ctrlKey || e.metaKey)) e.target.blur()
  }
  const props = { className: 'field', defaultValue: saved, onBlur: commit, onKeyDown, maxLength: LIMIT[f.type] }
  return f.type === 'text' ? <textarea rows={2} {...props} /> : <input type={f.type === 'date' ? 'date' : 'text'} {...props} />
}

// In the details panel: every field this repo has, globals first, ready to fill.
export function MetaSection({ r, fields: all, onSave, onManage }) {
  const fields = fieldsFor(all, r.path)
  return (
    <section className="meta" aria-label="Metadata">
      <header className="meta__head">
        <h3 className="label">Metadata</h3>
        <button className="btn btn--outline" onClick={() => onManage(r)}>
          {fields.length ? <><GearIcon size={14} />Edit fields</> : <><PlusIcon size={14} />Add a field</>}
        </button>
      </header>
      {fields.length ? (
        <div className="meta__grid">
          {fields.map((f) => (
            <label key={f.key + f.type + JSON.stringify(r.meta?.[f.key])} className={`mfield mfield--${f.type}`}>
              <span className="mfield__text"><b>{f.key}<Scope f={f} /></b>{f.desc && <small>{f.desc}</small>}</span>
              <Value f={f} value={r.meta?.[f.key]} onSave={(v) => onSave(r.path, f.key, v)} />
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">Describe your repos with your own fields, like <b>Uses Stripe</b> (yes / no), <b>Stack</b> or <b>Launch date</b>. diffdeck keeps them, the repo is never touched.</p>
      )}
    </section>
  )
}

// Add, edit and delete the fields of one repo (opened from its details): the globals and its own locals.
// The form below the lists adds a field, or edits the one you picked. Scope is set when a field is added.
export function FieldsDialog({ repo, fields: all, busy, error, post, remove, onClose }) {
  const ref = useRef(null)
  const [edit, setEdit] = useState(null) // the field being edited, null when adding
  const [type, setType] = useState('boolean')
  const [scope, setScope] = useState('global')
  const [noDefault, setNoDefault] = useState(true) // the NULL box: no default value
  const [confirm, confirmUI] = useConfirm()
  useEffect(() => { ref.current.showModal() }, [])

  const fields = fieldsFor(all, repo.path)
  const isEdit = (f) => edit?.key === f.key && edit?.repo === f.repo
  const pick = (f) => { setEdit(f); setType(f?.type ?? 'boolean'); setNoDefault(f?.default == null) }
  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const { key, desc, def } = form.elements
    const where = edit ? edit.repo : scope === 'local' ? repo.path : undefined
    const value = noDefault ? null : type === 'boolean' ? def.checked : def.value
    if (await post('/fields', { was: edit?.key, key: key.value, desc: desc.value, type, repo: where, default: value })) {
      form.reset()
      pick(null)
    }
  }
  const drop = async (f) => {
    const ok = await confirm({
      title: `Delete ${f.key}?`,
      body: `Its value is removed from ${f.repo ? repo.name : 'every repo'}. The repos themselves are not touched.`,
      action: 'Delete field',
    })
    const url = '/fields?key=' + encodeURIComponent(f.key) + (f.repo ? '&repo=' + encodeURIComponent(f.repo) : '')
    if (ok && (await remove(url)) && isEdit(f)) pick(null)
  }
  const list = (label, items) => items.length > 0 && (
    <>
      <p className="label">{label}</p>
      <ul className="flist">
        {items.map((f) => {
          const Icon = ICON[f.type]
          return (
            <li key={f.key} className={isEdit(f) ? 'is-open' : ''}>
              <Icon size={16} />
              <span><b>{f.key}</b><small>{TYPES[f.type]}{f.default != null && ` · default ${f.default === true ? 'Yes' : f.default}`}{f.desc && ` · ${f.desc}`}</small></span>
              <button className="ibtn" onClick={() => pick(f)} title="Edit" aria-label={`Edit ${f.key}`}><PencilIcon size={16} /></button>
              <button className="ibtn ibtn--danger" onClick={() => drop(f)} title="Delete" aria-label={`Delete ${f.key}`}><TrashIcon size={16} /></button>
            </li>
          )
        })}
      </ul>
    </>
  )

  return (
    <>
      <dialog
        ref={ref}
        className="modal modal--wide"
        aria-labelledby="fields-title"
        onCancel={(e) => { e.preventDefault(); onClose() }} // Esc
        onClick={(e) => e.target === ref.current && onClose()} // backdrop
      >
        <div>
          <header className="modal__head">
            <h2 id="fields-title">Metadata fields</h2>
            <button className="ibtn" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
          </header>
          <p>Global fields are on every repo, local ones only on <b>{repo.name}</b>. Either way each repo keeps its own values. Saved in <code>~/.diffdeck.json</code>, never in a repo.</p>
          {error && <p className="notice" role="alert">{error}</p>}
          {list('Global · every repo', fields.filter((f) => !f.repo))}
          {list(`Local · only ${repo.name}`, fields.filter((f) => f.repo))}
          <form className="fform" onSubmit={submit} key={`${edit?.repo ?? ''}|${edit?.key ?? 'new'}`}>
            <p className="label">{edit ? `Edit ${edit.key}` : 'Add a field'}{edit && <Scope f={edit} />}</p>
            {!edit && (
              <div className="fform__type">For<Seg label="Scope" value={scope} onChange={setScope} options={[['global', 'Every repo', GlobeIcon], ['local', `Only “${repo.name}”`, RepoIcon]]} /></div>
            )}
            <label>Name<input className="field" name="key" defaultValue={edit?.key} placeholder="Uses Stripe" maxLength={40} required autoComplete="off" autoFocus /></label>
            <label>Description <i>optional, shown under the name</i><input className="field" name="desc" defaultValue={edit?.desc} placeholder="Takes payments through Stripe" maxLength={200} autoComplete="off" /></label>
            <div className="fform__type">Type<Seg label="Type" value={type} onChange={setType} options={Object.entries(TYPES).map(([k, text]) => [k, text, ICON[k]])} /></div>
            <div className="fform__type">
              <span>Default value <i>what repos without their own value show</i></span>
              <div className="fdefault" key={type /* a fresh input when the type changes */}>
                {type === 'boolean' ? (
                  <input type="checkbox" role="switch" className="switch" name="def" defaultChecked={edit?.default === true} disabled={noDefault} aria-label="Default value" />
                ) : type === 'text' ? (
                  <textarea className="field" name="def" rows={2} defaultValue={edit?.type === 'text' ? edit.default ?? '' : ''} maxLength={LIMIT.text} disabled={noDefault} aria-label="Default value" />
                ) : (
                  <input className="field" type={type === 'date' ? 'date' : 'text'} name="def" defaultValue={edit?.type === type ? edit.default ?? '' : ''} maxLength={LIMIT[type]} disabled={noDefault} aria-label="Default value" autoComplete="off" />
                )}
                <label className="fnull"><input type="checkbox" checked={noDefault} onChange={(e) => setNoDefault(e.target.checked)} />NULL</label>
              </div>
            </div>
            {edit && type !== edit.type && <p className="hint">Values that don't fit the new type are cleared.</p>}
            <div className="modal__actions">
              {edit && <button type="button" className="btn btn--outline" onClick={() => pick(null)}>Cancel</button>}
              <button className="btn btn--primary" disabled={busy}>{edit ? 'Save field' : <><PlusIcon size={16} />Add field</>}</button>
            </div>
          </form>
        </div>
      </dialog>
      {confirmUI /* outside the dialog, so its Esc doesn't reach this dialog's onCancel through React */}
    </>
  )
}
