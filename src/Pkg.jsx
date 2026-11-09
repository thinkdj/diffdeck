// package.json in the details pane: scripts and dependencies, ten at a time, the rest in a sheet that slides in from the right.
// r.pkg is read by the server (null when the repo has no package.json) and shaped { scripts, dependencies, devDependencies }.
import { useEffect, useRef, useState } from 'react'
import { XIcon } from '@primer/octicons-react'

const SHOW = 10
// The scripts you reach for first come first; the rest keep their package.json order.
const COMMON = ['dev', 'start', 'build', 'test', 'lint', 'typecheck', 'preview', 'deploy', 'release']
const rank = (name) => COMMON.indexOf(name) + 1 || 99
export const scriptsOf = (pkg) => Object.entries(pkg.scripts).sort(([a], [b]) => rank(a) - rank(b))
export const depsOf = (pkg) => [
  ...Object.entries(pkg.dependencies).map(([n, v]) => ({ n, v })),
  ...Object.entries(pkg.devDependencies).map(([n, v]) => ({ n, v, dev: true })),
]
export const scriptRow = ([name, cmd]) => <li key={name} title={cmd}><b>{name}</b><span>{cmd}</span></li>
export const depRow = ({ n, v, dev }) => <li key={n}><b>{n}</b>{dev && <i>dev</i>}<small>{v}</small></li>

export function PkgSection({ title, repo, items, row }) {
  const [all, setAll] = useState(false)
  return (
    <section>
      <h3 className="label">{title} · {items.length}</h3>
      {items.length ? <ul className="pkg">{items.slice(0, SHOW).map(row)}</ul> : <p className="muted">None in package.json.</p>}
      {items.length > SHOW && <button className="more" onClick={() => setAll(true)}>View all {items.length}</button>}
      {all && (
        <Sheet title={title} sub={repo} onClose={() => setAll(false)}>
          <ul className="pkg">{items.map(row)}</ul>
        </Sheet>
      )}
    </section>
  )
}

// Native <dialog> pinned to the right edge. Esc and the backdrop close it, and the details pane ignores Esc while it is open.
function Sheet({ title, sub, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return (
    <dialog
      ref={ref}
      className="modal modal--sheet"
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div>
        <header className="modal__head">
          <h2>{title}<small>{sub}</small></h2>
          <button className="ibtn" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
