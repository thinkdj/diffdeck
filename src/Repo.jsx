// One repo: its status pills, its card (with any nested repos inside), and the details panel that opens below.
import { useEffect, useState } from 'react'
import { Tip } from './Tip.jsx'
import {
  AlertIcon, ArchiveIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, CloudOfflineIcon, CodeIcon, CopyIcon,
  DiffAddedIcon, DiffModifiedIcon, DiffRemovedIcon, DiffRenamedIcon, FileDiffIcon, FileSubmoduleIcon, GitBranchIcon,
  GitCommitIcon, LinkExternalIcon, MarkGithubIcon, RepoIcon, RepoPushIcon, XCircleIcon, XIcon,
} from '@primer/octicons-react'

const UNITS = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]]
const ago = (t) => {
  const s = Date.now() / 1000 - t
  const u = UNITS.find(([, n]) => s >= n)
  return u ? Math.floor(s / u[1]) + u[0] : 'now'
}
const agoLong = (t) => (ago(t) === 'now' ? 'just now' : `${ago(t)} ago`)
const when = (t) => new Date(t * 1000).toLocaleString()
const baseName = (p) => p.split(/[\\/]/).pop()
export const detached = (r) => r.branch === '(detached)'
const branchOf = (r) => (detached(r) ? `detached at ${r.commits?.[0]?.hash ?? '?'}` : r.branch || '–')

// Status pills, loudest first. Tone: bad, warn, ok, or '' for plain. n is the number shown in compact pills.
function badges(r) {
  if (r.error) return [{ Icon: XCircleIcon, text: 'Error', tone: 'bad' }]
  const b = []
  if (r.conflicts) b.push({ Icon: AlertIcon, n: r.conflicts, text: `${r.conflicts} conflicted`, tone: 'bad' })
  if (r.changed) b.push({ Icon: FileDiffIcon, n: r.changed, text: `${r.changed} changed`, tone: 'warn' })
  if (r.ahead) b.push({ Icon: ArrowUpIcon, n: r.ahead, text: `${r.ahead} to push`, tone: 'warn' })
  if (!r.hasRemote) b.push({ Icon: CloudOfflineIcon, text: 'No remote', tone: 'bad' })
  else if (!r.upstream && !detached(r)) b.push({ Icon: RepoPushIcon, text: 'Never pushed', tone: 'warn' })
  if (r.behind) b.push({ Icon: ArrowDownIcon, n: r.behind, text: `${r.behind} behind`, tone: '' })
  if (r.stash) b.push({ Icon: ArchiveIcon, n: r.stash, text: `${r.stash} ${r.stash === 1 ? 'stash' : 'stashes'}`, tone: '' })
  if (!b.some((x) => x.tone)) b.unshift({ Icon: CheckIcon, text: 'Clean', tone: 'ok' })
  return b
}
const toneOf = (...repos) => {
  const tones = repos.flatMap(badges).map((x) => x.tone)
  return ['bad', 'warn'].find((t) => tones.includes(t)) ?? 'ok'
}

// Dot after the repo name: worst status of the repo and its nested repos, explained on hover.
const HEADLINE = { bad: 'At risk: work could be lost', warn: 'Work not on the remote yet', ok: 'All good: clean and pushed' }
function StatusDot({ r, kids = [] }) {
  const tone = toneOf(r, ...kids)
  const why = [r, ...kids].flatMap((x) => badges(x)
    .filter((b) => b.tone === 'bad' || b.tone === 'warn')
    .map((b) => (x === r ? b.text : `${x.name}: ${b.text}`)))
  return (
    <Tip text={<><b>{HEADLINE[tone]}</b>{why.map((w) => <span key={w}>{w}</span>)}</>}>
      <span className={`dot dot--${tone}`} />
    </Tip>
  )
}

const Pills = ({ r, compact }) => (
  <span className="pills">
    {badges(r).map(({ Icon, n, text, tone }) => (
      <span key={text} className={`pill pill--${tone}`} title={compact ? text : undefined}><Icon size={compact ? 12 : 14} />{compact ? n : text}</span>
    ))}
  </span>
)

// Open in editor, open remote, copy path. Icon-only on cards, labelled in the details panel.
function Actions({ r, labels }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(r.path).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  })
  const cls = (primary) => (labels ? `btn ${primary ? 'btn--primary' : 'btn--outline'}` : 'ibtn')
  const Host = r.web?.includes('github.com') ? MarkGithubIcon : LinkExternalIcon
  return (
    <div className="actions">
      <a className={cls(true)} href={'vscode://file/' + r.path.replaceAll('\\', '/').replace(/^\/+/, '')} title="Open in VS Code">
        <CodeIcon size={16} />{labels && <span>Open in VS Code</span>}
      </a>
      {r.web && <a className={cls()} href={r.web} target="_blank" rel="noreferrer" title={r.web}><Host size={16} />{labels && <span>{r.web.replace('https://', '')}</span>}</a>}
      <button type="button" className={cls()} onClick={copy} title="Copy path">
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}{labels && <span>{copied ? 'Copied' : 'Copy path'}</span>}
      </button>
    </div>
  )
}

// A top-level repo. Repos nested inside it are listed in the card, so the hierarchy reads at a glance.
export function RepoCard({ r, kids, open, onOpen }) {
  const last = r.commits?.[0]
  const isOpen = open === r.path || kids.some((k) => k.path === open)
  return (
    <article className={`card${isOpen ? ' is-open' : ''}`}>
      <button className="card__hit" onClick={() => onOpen(r.path)} aria-expanded={open === r.path} aria-label={`Details for ${r.name}`} />
      <header className="card__head">
        <h3 className="card__name">{r.name}<StatusDot r={r} kids={kids} /></h3>
        <Actions r={r} />
      </header>
      <p className="branch"><GitBranchIcon size={14} /><span>{branchOf(r)}</span></p>
      <Pills r={r} />
      <p className="card__last" title={last && when(last.time)}>
        {last ? (
          <>Last commit:<span className="card__subject"><span>{last.subject}</span></span><b>{agoLong(last.time)}</b></>
        ) : 'No commits yet'}
      </p>
      {kids.length > 0 && (
        <div className="nest">
          <p className="label">{kids.length} nested {kids.length === 1 ? 'repo' : 'repos'}</p>
          {kids.map((k) => (
            <button key={k.path} className={`nest__row${open === k.path ? ' is-open' : ''}`} onClick={() => onOpen(k.path)} aria-expanded={open === k.path}>
              <FileSubmoduleIcon size={14} className={`tone--${toneOf(k)}`} />
              <span className="nest__name">{k.name}</span>
              <Pills r={k} compact />
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

// First letter of the status code picks the icon: ?? untracked, A added, D deleted, R/C renamed, U conflict, else modified.
const FILE = { '?': [DiffAddedIcon, 'new'], A: [DiffAddedIcon, 'add'], D: [DiffRemovedIcon, 'del'], R: [DiffRenamedIcon, 'mod'], C: [DiffRenamedIcon, 'mod'], U: [AlertIcon, 'del'] }

// Parent repo with its nested repos underneath, for switching between them without closing the panel.
function Tree({ group, current, onSelect }) {
  const row = (x, Icon) => (
    <button key={x.path} className={`tree__row${x.path === current ? ' is-open' : ''}`} onClick={() => onSelect(x.path)} aria-current={x.path === current}>
      <Icon size={14} className={`tone--${toneOf(x)}`} />
      <span className="tree__name">{x.name}</span>
      <Pills r={x} compact />
    </button>
  )
  return (
    <nav className="tree" aria-label="Repos in this group">
      <p className="label">Repos here</p>
      {row(group.r, RepoIcon)}
      <div className="tree__kids">{group.kids.map((k) => row(k, FileSubmoduleIcon))}</div>
    </nav>
  )
}

// Full-width panel under the row of the open card; the caret points at that card's column.
export function Details({ r, group, caret, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <section className={`details${group.kids.length ? ' details--tree' : ''}`} style={{ '--caret': caret }} aria-label={`${r.name} details`}>
      {group.kids.length > 0 && <Tree group={group} current={r.path} onSelect={onSelect} />}
      <div className="details__main">
      <header className="details__head">
        <div className="details__title">
          <h2>
            {r.parent && <><button className="crumb" onClick={() => onSelect(r.parent)} title="Open parent repo">{baseName(r.parent)}</button><span className="crumb"> / </span></>}
            {r.name}
          </h2>
          <code>{r.path}</code>
        </div>
        <Actions r={r} labels />
        <button className="ibtn" onClick={onClose} aria-label="Close details"><XIcon size={18} /></button>
      </header>
      <div className="details__status">
        <p className="branch"><GitBranchIcon size={14} /><span>{branchOf(r)}{r.upstream && <span className="muted"> → {r.upstream}</span>}</span></p>
        <Pills r={r} />
      </div>
      {r.error ? <p className="error">{r.error}</p> : (
        <div className="details__cols">
          <section>
            <h3 className="label">Uncommitted · {r.changed}</h3>
            {r.files.length ? (
              <ul className="files">
                {r.files.map((f) => {
                  const [Icon, kind] = FILE[f.code.trim()[0]] ?? [DiffModifiedIcon, 'mod']
                  return <li key={f.path} title={f.code}><Icon size={16} className={kind} />{f.path}</li>
                })}
                {r.changed > r.files.length && <li className="muted">and {r.changed - r.files.length} more</li>}
              </ul>
            ) : <p className="muted">Nothing uncommitted.</p>}
          </section>
          <section>
            <h3 className="label">Recent commits</h3>
            {r.commits.length ? (
              <ul className="commits">
                {r.commits.map((c) => (
                  <li key={c.hash}><GitCommitIcon size={16} /><code>{c.hash}</code><span>{c.subject}</span><small title={when(c.time)}>{ago(c.time)}</small></li>
                ))}
              </ul>
            ) : <p className="muted">No commits yet.</p>}
          </section>
        </div>
      )}
      </div>
    </section>
  )
}
