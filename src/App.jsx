import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownIcon, ArrowUpIcon, FileDiffIcon, FileDirectoryIcon, MoonIcon, PlusIcon, RepoIcon, SearchIcon, SunIcon, SyncIcon, XIcon,
} from '@primer/octicons-react'
import { Details, RepoCard, detached } from './Repo.jsx'
import { useConfirm } from './Confirm.jsx'

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
  ['all', 'All', RepoIcon, () => true],
  ['changes', 'Changes', FileDiffIcon, (r) => r.changed > 0],
  ['unpushed', 'Unpushed', ArrowUpIcon, (r) => r.ahead > 0 || (!r.error && !r.upstream && !detached(r))],
  ['behind', 'Behind', ArrowDownIcon, (r) => r.behind > 0],
]
// Sorts work on cards: a repo plus the repos nested in it.
const newest = (g) => Math.max(...[g.r, ...g.kids].map((x) => x.commits?.[0]?.time ?? 0))
const SORTS = {
  recent: (a, b) => newest(b) - newest(a),
  name: (a, b) => a.r.name.localeCompare(b.r.name),
}
const GAP = 14 // px between cards, also used to aim the details caret

function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([key, text, Icon, count]) => (
        <label key={key}>
          <input type="radio" name={label} checked={value === key} onChange={() => onChange(key)} />
          <span>{Icon && <Icon size={14} />}{text}{count !== undefined && <small>{count}</small>}</span>
        </label>
      ))}
    </div>
  )
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

export default function App() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [cols, setCols] = useState(1)
  const searchRef = useRef(null)
  const inflight = useRef(null)
  const observer = useRef(null)
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

  const refresh = useCallback(() => {
    inflight.current ??= run('/repos').finally(() => { inflight.current = null })
  }, [run])

  useEffect(() => {
    refresh()
    const onKey = (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    addEventListener('focus', refresh) // back from the editor or terminal: fresh numbers
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('focus', refresh)
      removeEventListener('keydown', onKey)
    }
  }, [refresh])

  // The grid's column count decides where the details panel goes: right after the open card's row.
  const gridRef = useCallback((el) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(() => setCols(getComputedStyle(el).gridTemplateColumns.split(' ').length))
    observer.current.observe(el)
  }, [])

  const toggle = useCallback((path) => setOpen((o) => (o === path ? null : path)), [])
  const close = useCallback(() => setOpen(null), [])
  const add = async (e) => {
    e.preventDefault()
    const input = e.currentTarget.elements.path
    const ok = await run('/roots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: input.value }) })
    if (ok) input.value = ''
  }
  const remove = async (root) => {
    const ok = await confirm({
      title: 'Stop watching this folder?',
      body: <><code>{root.path}</code>{root.missing ? '' : ` and its ${root.count} ${root.count === 1 ? 'repo' : 'repos'}`} will leave diffdeck. Nothing on disk changes.</>,
      action: 'Stop watching',
    })
    if (ok) run('/roots?path=' + encodeURIComponent(root.path), { method: 'DELETE' })
  }
  const browse = () => run('/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }) // native dialog, adds the pick

  const repos = data?.repos ?? []
  const roots = data?.roots ?? []
  const paths = new Set(repos.map((r) => r.path))
  const kidsOf = Object.groupBy(repos.filter((r) => paths.has(r.parent)), (r) => r.parent)
  const match = FILTERS.find(([key]) => key === filter)[3]
  const needle = q.trim().toLowerCase()
  const hit = (r) => match(r) && `${r.name} ${r.branch}`.toLowerCase().includes(needle)
  const shown = repos
    .filter((r) => !paths.has(r.parent))
    .map((r) => ({ r, kids: kidsOf[r.path] ?? [] }))
    .filter((g) => hit(g.r) || g.kids.some(hit))
    .sort(SORTS[sort])

  const at = shown.findIndex((g) => g.r.path === open || g.kids.some((k) => k.path === open))
  const selected = at >= 0 && repos.find((r) => r.path === open)
  const rowEnd = Math.min(shown.length, (Math.floor(at / cols) + 1) * cols) - 1
  const caret = `calc((100% + ${GAP}px) * ${((at % cols) + 0.5) / cols} - ${GAP / 2}px)`

  return (
    <div className="page">
      <header className="top">
        <a className="logo" href="./"><img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" />diffdeck</a>
        <div className="top__right">
          {checked && <span className="muted">Checked {checked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className="btn btn--outline" onClick={refresh} disabled={busy} title="Refresh">
            <SyncIcon size={16} className={busy ? 'spin' : ''} /><span>{busy ? 'Checking' : 'Refresh'}</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {DEMO && <p className="notice notice--info">You are looking at sample repos. Run <code>npx diffdeck</code> on your computer to see your own.</p>}
      {error && <p className="notice" role="alert">{error}</p>}

      {roots.length > 0 && (
        <div className="bar">
          <Seg label="Filter" value={filter} onChange={setFilter} options={FILTERS.map(([key, text, Icon, f]) => [key, text, Icon, repos.filter(f).length])} />
          <label className="search">
            <SearchIcon size={16} />
            <input ref={searchRef} type="search" placeholder="Search repos or branches" aria-label="Search repos" value={q} onChange={(e) => setQ(e.target.value)} />
            <kbd>/</kbd>
          </label>
          <Seg label="Sort" value={sort} onChange={setSort} options={[['recent', 'Recent'], ['name', 'A–Z']]} />
        </div>
      )}

      {!data ? (
        <div className="skeleton" />
      ) : !roots.length ? (
        <div className="empty">
          <RepoIcon size={32} />
          <h2>Add your first repo</h2>
          <p>Paste the path of a repo, or of a folder that holds repos. Repos nested one level inside a repo show up too.</p>
        </div>
      ) : shown.length ? (
        <div className="grid" ref={gridRef} style={{ gap: GAP }}>
          {shown.map((g, i) => (
            <Fragment key={g.r.path}>
              <RepoCard r={g.r} kids={g.kids} open={open} onOpen={toggle} />
              {selected && i === rowEnd && <Details r={selected} group={shown[at]} caret={caret} onSelect={setOpen} onClose={close} />}
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="none">No repos match.</p>
      )}

      <form className="addbar" onSubmit={add}>
        <label>
          <PlusIcon size={20} />
          <input name="path" placeholder={navigator.platform.startsWith('Win') ? 'C:\\code\\my-app  or  C:\\code' : '~/code/my-app  or  ~/code'} aria-label="Repo or folder path" autoComplete="off" spellCheck="false" autoFocus={data && !roots.length} />
        </label>
        <button className="btn btn--primary" disabled={busy}>Add</button>
        <button type="button" className="btn btn--outline" onClick={browse} disabled={busy}><FileDirectoryIcon size={18} />Browse</button>
      </form>

      {roots.length > 0 && (
        <div className="roots">
          <span className="label">Watching</span>
          {roots.map((root) => (
            <span className="root" key={root.path}>
              <FileDirectoryIcon size={14} />
              <code title={root.path}>{root.path}</code>
              <small className={root.missing ? 'bad' : ''}>{root.missing ? 'not found' : root.count}</small>
              <button type="button" title="Stop watching" aria-label={`Stop watching ${root.path}`} onClick={() => remove(root)}><XIcon size={14} /></button>
            </span>
          ))}
        </div>
      )}
      {confirmUI}
    </div>
  )
}
