import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, DeviceDesktopIcon, EyeIcon, ShieldCheckIcon, FileDiffIcon, FileDirectoryIcon, LockIcon, MoonIcon, PlusIcon, RepoIcon, SearchIcon, SunIcon, SyncIcon, XIcon } from '@primer/octicons-react'
import { Details, Row, ago, detached } from './Repo.jsx'
import { useConfirm } from './Confirm.jsx'
import { FieldsDialog } from './Meta.jsx'
import { MetaFilters, metaHit } from './Filters.jsx'
import { Seg } from './Seg.jsx'
import { TitleTips } from './Tip.jsx'

// The hosted demo (vite --mode demo) answers from sample data; normal builds never include it.
const DEMO = import.meta.env.MODE === 'demo'

async function api(url, opts) {
  if (DEMO) return (await import('./demo.js')).demoApi(url, opts)
  const res = await fetch('/api' + url, opts)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error)
  return body
}

const FILTERS = [
  ['all', 'All', () => true],
  ['changes', 'Changes', (r) => r.changed > 0],
  ['unpushed', 'Unpushed', (r) => r.ahead > 0 || (!r.error && !r.upstream && !detached(r))],
  ['behind', 'Behind', (r) => r.behind > 0],
]
// What search looks through: the repo's name, branch, path, description, recent commit subjects and uncommitted file paths.
const contents = (r) => [r.name, r.branch, r.path, r.about, ...(r.commits ?? []).map((c) => c.subject), ...(r.files ?? []).map((f) => f.path)].join('\n').toLowerCase()
// Sorts work on groups: a repo plus the repos nested in it.
const newest = (g) => Math.max(...[g.r, ...g.kids].map((x) => x.commits?.[0]?.time ?? 0))
const SORTS = {
  recent: (a, b) => newest(b) - newest(a),
  name: (a, b) => a.r.name.localeCompare(b.r.name),
}

// Light by default; your choice is remembered in this browser. index.html applies it before first paint.
function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light')
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('diffdeck.theme', next) } catch {}
    setTheme(next)
  }
  return (
    <button className="ibtn" onClick={flip} title="Switch light / dark" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
      {theme === 'light' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  )
}

const AUTO = 5 // minutes between automatic refreshes, while the tab is visible

// "Synced at 9:38 PM (a few seconds ago)", then (1m ago), (1h ago): the same short ages as the list. Ticks every 10s.
function Synced({ at }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])
  const age = ago(at / 1000)
  return <span className="muted" title={at.toLocaleString()}>Synced at {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({age === 'now' ? 'a few seconds ago' : `${age} ago`})</span>
}

// Path input plus Browse. Focused in the empty state, tucked under the list once there are folders.
function AddForm({ busy, onAdd, onBrowse, big }) {
  const add = async (e) => {
    e.preventDefault()
    const input = e.currentTarget.elements.path
    if (await onAdd(input.value)) input.value = ''
  }
  return (
    <form className="addbar" onSubmit={add}>
      <label>
        <PlusIcon size={16} />
        <input name="path" placeholder={navigator.platform.startsWith('Win') ? 'C:\\code\\my-app  or  C:\\code' : '~/code/my-app  or  ~/code'} aria-label="Repo or folder path" autoComplete="off" spellCheck="false" autoFocus={big} />
      </label>
      <button className="btn btn--primary" disabled={busy}>Add</button>
      <button type="button" className="btn btn--outline" onClick={onBrowse} disabled={busy} title="Browse for a folder"><FileDirectoryIcon size={16} /><span>Browse</span></button>
    </form>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [q, setQ] = useState('')
  const [mf, setMf] = useState({}) // metadata filters, see src/Filters.jsx
  const [showEmpty, setShowEmpty] = useState(false) // demo only: preview the page with nothing added yet
  const [open, setOpen] = useState(null)
  const [folded, setFolded] = useState(() => new Set()) // parents whose nested repos are hidden
  const [fieldsRepo, setFieldsRepo] = useState(null) // the repo whose fields dialog is open
  const searchRef = useRef(null)
  const inflight = useRef(null)
  const rowsRef = useRef([])
  const [confirm, confirmUI] = useConfirm()

  // Every route returns the fresh list, so loading, adding and removing all land here.
  const run = useCallback(async (url, opts) => {
    setBusy(true)
    try {
      setData(await api(url, opts))
      setError('')
      setChecked(new Date())
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const post = (url, body) => run(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const del = (url) => run(url, { method: 'DELETE' })

  const refresh = useCallback(() => {
    inflight.current ??= run('/repos').finally(() => { inflight.current = null })
  }, [run])

  useEffect(() => {
    refresh()
    // Keys outside inputs and dialogs: / searches, up and down move through the list. In search, up and down work too,
    // so you can type a few letters and walk the matches.
    const onKey = (e) => {
      const inSearch = document.activeElement === searchRef.current && /^Arrow(Up|Down)$/.test(e.key)
      if ((!inSearch && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) || document.querySelector('dialog[open]')) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const rows = rowsRef.current
        setOpen((o) => {
          const i = rows.findIndex((r) => r.path === o) + (e.key === 'ArrowDown' ? 1 : -1)
          return rows[Math.max(0, Math.min(rows.length - 1, i))]?.path ?? o
        })
      }
    }
    addEventListener('focus', refresh) // back from the editor or terminal: fresh numbers
    addEventListener('keydown', onKey)
    const auto = setInterval(() => !document.hidden && refresh(), AUTO * 60_000) // a hidden tab catches up on focus instead
    return () => {
      clearInterval(auto)
      removeEventListener('focus', refresh)
      removeEventListener('keydown', onKey)
    }
  }, [refresh])
  useEffect(() => { document.querySelector('.row.is-open')?.scrollIntoView({ block: 'nearest' }) }, [open])

  const close = useCallback(() => setOpen(null), [])
  const fold = (path) => setFolded((s) => {
    const next = new Set(s)
    next.has(path) ? next.delete(path) : next.add(path)
    return next
  })
  const addRoot = (path) => post('/roots', { path })
  const remove = async (root) => {
    const ok = await confirm({
      title: 'Stop watching this folder?',
      body: <><code>{root.path}</code>{root.missing ? '' : ` and its ${root.count} ${root.count === 1 ? 'repo' : 'repos'}`} will leave diffdeck. Nothing on disk changes.</>,
      action: 'Stop watching',
    })
    if (ok) del('/roots?path=' + encodeURIComponent(root.path))
  }
  const browse = () => post('/pick', {}) // native dialog, adds the pick
  const saveMeta = (path, key, value) => post('/meta', { path, key, value })
  const saveAbout = (path, text) => post('/about', { path, text })
  const openFields = (r) => { setError(''); setFieldsRepo(r) }

  const view = DEMO && showEmpty && data ? { roots: [], repos: [], fields: [] } : data
  const repos = view?.repos ?? []
  const roots = view?.roots ?? []
  const fields = view?.fields ?? []
  const paths = new Set(repos.map((r) => r.path))
  const kidsOf = Object.groupBy(repos.filter((r) => paths.has(r.parent)), (r) => r.parent)
  const match = FILTERS.find(([key]) => key === filter)[2]
  const needle = q.trim().toLowerCase()
  const hit = (r) => match(r) && contents(r).includes(needle) && metaHit(r, fields, mf)
  const shown = repos
    .filter((r) => !paths.has(r.parent))
    .map((r) => ({ r, kids: kidsOf[r.path] ?? [] }))
    .filter((g) => hit(g.r) || g.kids.some(hit))
    .sort(SORTS[sort])
  rowsRef.current = shown.flatMap((g) => [g.r, ...(folded.has(g.r.path) ? [] : g.kids)]) // what the arrow keys walk
  const selected = shown.flatMap((g) => [g.r, ...g.kids]).find((r) => r.path === open)

  const addForm = <AddForm busy={busy} onAdd={addRoot} onBrowse={browse} big={!roots.length} />
  return (
    <div className="app">
      <header className="top">
        <a className="logo" href="./"><img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" />diffdeck<span className="logo__tag">The inbox for code you haven't shipped yet</span></a>
        <div className="top__right">
          {checked && <Synced at={checked} />}
          <button className="btn btn--outline" onClick={refresh} disabled={busy} title={`Refresh now. Auto-refreshes every ${AUTO} minutes, and when you come back to this tab.`}>
            <SyncIcon size={16} className={busy ? 'spin' : ''} /><span>{busy ? 'Checking' : 'Refresh'}</span>
          </button>
          <ThemeToggle />
          {DEMO && (
            <button className={`btn btn--outline${showEmpty ? ' is-on' : ''}`} onClick={() => setShowEmpty(!showEmpty)} aria-pressed={showEmpty} title="Preview the page before any repo is added">
              <EyeIcon size={16} /><span>Empty state</span>
            </button>
          )}
        </div>
      </header>

      {DEMO && (
        <div className="notice notice--info notice--demo">
          <p>You are looking at sample repos. Run <code>npx diffdeck</code> on your computer to see your own.</p>
          <span className="promise" title="diffdeck only reads: it never commits, fetches, checks out or writes to a repo"><ShieldCheckIcon size={16} />Read-only</span>
          <span className="promise" title="It runs on your computer and talks only to it. Your list and metadata live in ~/.diffdeck.json"><DeviceDesktopIcon size={16} />Nothing leaves your machine</span>
        </div>
      )}
      {error && <p className="notice" role="alert">{error}</p>}

      <div className={`split${selected ? ' has-open' : ''}${data && !roots.length ? ' split--bare' : ''}`}>
        <aside className="side" aria-label="Repos">
          {roots.length > 0 && (
            <div className="tools">
              <div className="tools__row">
                <label className="search">
                  <SearchIcon size={16} />
                  <input ref={searchRef} type="search" placeholder="Search names, branches, commits, files" aria-label="Search repos" value={q} onChange={(e) => setQ(e.target.value)} />
                  <kbd>/</kbd>
                </label>
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                  <option value="recent">Recent</option>
                  <option value="name">A–Z</option>
                </select>
              </div>
              <Seg label="Filter" value={filter} onChange={setFilter} options={FILTERS.map(([key, text, f]) => [key, text, undefined, repos.filter(f).length])} />
              {fields.length > 0 && <MetaFilters fields={fields} repos={repos} value={mf} onChange={setMf} />}
            </div>
          )}
          <div className="side__list">
            {!data ? <div className="skeleton" /> : shown.length ? (
              <ul className="tree">
                {shown.map((g) => (
                  <li key={g.r.path}>
                    <Row r={g.r} kids={g.kids} fields={fields} q={needle} open={open} onOpen={setOpen} folded={folded.has(g.r.path)} onFold={fold} />
                    {g.kids.length > 0 && !folded.has(g.r.path) && (
                      <ul className="tree__kids">
                        {g.kids.map((k) => <li key={k.path}><Row r={k} fields={fields} q={needle} open={open} onOpen={setOpen} /></li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : roots.length > 0 && <p className="none">No repos match.</p>}
          </div>
          {roots.length > 0 && (
            <details className="watch">
              <summary><FileDirectoryIcon size={14} />Watching {roots.length} {roots.length === 1 ? 'folder' : 'folders'}<ChevronDownIcon size={14} /></summary>
              <div className="watch__body">
                <div className="roots">
                  {roots.map((root) => (
                    <span className="root" key={root.path}>
                      <code title={root.path}>{root.path}</code>
                      <small className={root.missing ? 'bad' : ''}>{root.missing ? 'not found' : root.count}</small>
                      <button type="button" title="Stop watching" aria-label={`Stop watching ${root.path}`} onClick={() => remove(root)}><XIcon size={14} /></button>
                    </span>
                  ))}
                </div>
                {addForm}
              </div>
            </details>
          )}
        </aside>

        <main className="main">
          {selected ? (
            <Details r={selected} fields={fields} q={needle} onMeta={saveMeta} onAbout={saveAbout} onFields={openFields} onSelect={setOpen} onClose={close} />
          ) : data && !roots.length ? (
            <div className="empty">
              <RepoIcon size={32} />
              <h2>Add your first repo</h2>
              <p>Paste the path of a repo, or of a folder that holds repos, and diffdeck keeps an eye on all of them from here.</p>
              {addForm}
              <ul className="empty__tips">
                <li><FileDirectoryIcon size={18} /><b>Folders work too</b>Every repo one level inside shows up. Repos nested one level inside those sit under their parent.</li>
                <li><FileDiffIcon size={18} /><b>See what needs you</b>Uncommitted changes, commits still to push, branches behind, stashes and conflicts, for every repo at once.</li>
                <li><LockIcon size={18} /><b>Read-only</b>diffdeck never commits, fetches or writes to a repo. Your list lives in <code>~/.diffdeck.json</code>.</li>
              </ul>
            </div>
          ) : data && (
            <div className="blank">
              <RepoIcon size={28} />
              <p>Pick a repo to see its files, commits and metadata.</p>
              <p className="muted"><kbd>↑</kbd> <kbd>↓</kbd> move through the list, <kbd>/</kbd> searches</p>
            </div>
          )}
        </main>
      </div>
      {fieldsRepo && <FieldsDialog repo={fieldsRepo} fields={fields} busy={busy} error={error} post={post} remove={del} onClose={() => setFieldsRepo(null)} />}
      {confirmUI}
      <TitleTips />
    </div>
  )
}
