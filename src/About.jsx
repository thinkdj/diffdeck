// A repo's description, under its name in the details pane. Click it (or the pencil) to edit in place:
// Enter or leaving the box saves, Shift+Enter adds a line, Esc cancels. *bold*, _italic_ and links render (src/inline.js).
import { useState } from 'react'
import { PencilIcon } from '@primer/octicons-react'
import { inline } from './inline.js'
import { Hi } from './Repo.jsx'

const LIMIT = 1000 // same limit server/meta.js checks

// Tokens to elements. Search matches in plain text are highlighted, like everywhere else.
const render = (tokens, q) => tokens.map((t, i) =>
  typeof t === 'string' ? <Hi key={i} text={t} q={q} />
  : t.b ? <b key={i}>{render(t.b, q)}</b>
  : t.i ? <em key={i}>{render(t.i, q)}</em>
  : <a key={i} href={t.a} target="_blank" rel="noreferrer noopener">{render(t.kids, q)}</a>)

export function About({ r, q, onSave }) {
  const [editing, setEditing] = useState(false)
  const saved = r.about ?? ''
  const done = (e) => {
    setEditing(false)
    if (e.target.value.trim() !== saved) onSave(r.path, e.target.value)
  }
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.target.blur()
    }
    if (e.key === 'Escape') {
      e.stopPropagation() // cancel the edit, don't close the pane
      e.target.value = saved
      e.target.blur()
    }
  }
  if (editing) {
    return (
      <div className="about about--edit">
        <textarea className="field" rows={1} defaultValue={saved} maxLength={LIMIT} autoFocus onBlur={done} onKeyDown={onKeyDown} placeholder="What is this repo for?" aria-label="Description" />
        <small className="muted"><b>*bold*</b> <em>_italic_</em> and links. Enter saves, Shift+Enter adds a line, Esc cancels.</small>
      </div>
    )
  }
  return (
    <div className="about" onClick={(e) => !e.target.closest('a') && setEditing(true)}>
      <p className={saved ? '' : 'muted'}>
        {saved ? render(inline(saved), q) : 'Add a description'}
        <button className="ibtn" onClick={() => setEditing(true)} title="Edit description" aria-label="Edit description"><PencilIcon size={14} /></button>
      </p>
    </div>
  )
}
