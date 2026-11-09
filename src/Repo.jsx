// One repo: its status pills, its row in the list, and the details pane.
import { useEffect, useState } from 'react'
import { Tip } from './Tip.jsx'
import { MetaSection, Tags } from './Meta.jsx'
import { PkgSection, depRow, depsOf, scriptRow, scriptsOf } from './Pkg.jsx'
import { About } from './About.jsx'
import {
  AlertIcon, ArchiveIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CloudOfflineIcon, CodeIcon,
  CopyIcon, DiffAddedIcon, DiffModifiedIcon, DiffRemovedIcon, DiffRenamedIcon, FileDiffIcon, FileSubmoduleIcon, GitBranchIcon, GitCommitIcon,
  LinkExternalIcon, MarkGithubIcon, RepoPushIcon, XCircleIcon, XIcon,
} from '@primer/octicons-react'

const UNITS = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]]
export const ago = (t) => {
  const s = Date.now() / 1000 - t
  const u = UNITS.find(([, n]) => s >= n)
  return u ? Math.floor(s / u[1]) + u[0] : 'now'
}
const when = (t) => new Date(t * 1000).toLocaleString()
// Wraps every match of the search term in <mark>. q is already lower-cased and trimmed.
export function Hi({ text, q }) {
  const i = q && text ? text.toLowerCase().indexOf(q) : -1
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark><Hi text={text.slice(i + q.length)} q={q} /></>
}
const baseName = (p) => p.split(/[\\/]/).pop()
export const detached = (r) => r.branch === '(detached)'
const branchOf = (r) => (detached(r) ? `detached at ${r.commits?.[0]?.hash ?? '?'}` : r.branch || '–')

// Status pills, loudest first. Tone: bad, warn, ok, or '' for plain. n is the number shown in compact pills,
// hint what the tooltip adds when the number needs a caveat.
function badges(r) {
  if (r.error) return [{ Icon: XCircleIcon, text: 'Error', tone: 'bad' }]
  const b = []
  if (r.conflicts) b.push({ Icon: AlertIcon, n: r.conflicts, text: `${r.conflicts} conflicted`, tone: 'bad' })
  if (r.changed) b.push({ Icon: FileDiffIcon, n: r.changed, text: `${r.changed} changed`, tone: 'warn' })
  if (r.ahead) b.push({ Icon: ArrowUpIcon, n: r.ahead, text: `${r.ahead} to push`, tone: 'warn' })
  if (!r.hasRemote) b.push({ Icon: CloudOfflineIcon, text: 'No remote', tone: 'bad' })
  else if (!r.upstream && !detached(r)) b.push({ Icon: RepoPushIcon, text: 'Never pushed', tone: 'warn' })
  if (r.behind) b.push({ Icon: ArrowDownIcon, n: r.behind, text: `${r.behind} behind`, tone: '', hint: 'As of your last fetch. diffdeck never fetches.' })
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
    {badges(r).map(({ Icon, n, text, tone, hint }) => (
      <span key={text} className={`pill pill--${tone || 'plain'}`} title={compact ? [text, hint].filter(Boolean).join('. ') : hint}><Icon size={compact ? 12 : 14} />{compact ? n : text}</span>
    ))}
  </span>
)

// Copy path and open in the editor on the left, the remote on the right.
function Actions({ r }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(r.path).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  })
  const Host = r.web?.includes('github.com') ? MarkGithubIcon : LinkExternalIcon
  return (
    <div className="actions">
      <button type="button" className="btn btn--outline" onClick={copy}>
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}<span>{copied ? 'Copied' : 'Copy path'}</span>
      </button>
      <a className="btn btn--primary" href={'vscode://file/' + r.path.replaceAll('\\', '/').replace(/^\/+/, '')}>
        <CodeIcon size={16} /><span>Open in VS Code</span>
      </a>
      {r.web && <a className="btn btn--outline actions__remote" href={r.web} target="_blank" rel="noreferrer" title={r.web}><Host size={16} /><span>{r.web.replace('https://', '')}</span></a>}
    </div>
  )
}

// One row of the list: a top-level repo or a nested one, so no row spends width on a fold arrow.
// Line 1: name, compact pills and age. Line 2: branch and the last commit.
// Line 3, when there is something for it: a parent's nested-repo count first (it folds and unfolds them), then metadata tags.
// Double-clicking a parent row also folds it. The fold button can't sit inside the row's button, so line 3 is its own strip.
// A click anywhere on the row opens the repo, padding and tags included (the button's own click bubbles up here, so the
// keyboard takes the same path). Only the fold button and the status dot, which a tap asks for its tooltip, keep out of it.
export function Row({ r, kids = [], fields, q, open, onOpen, folded, onFold }) {
  const last = r.commits?.[0]
  const isOpen = open === r.path
  return (
    <div
      className={`row${isOpen ? ' is-open' : ''}`}
      onClick={(e) => !e.target.closest('.row__fold, .tip') && onOpen(r.path)}
      onDoubleClick={(e) => kids.length > 0 && !e.target.closest('.row__fold') && onFold(r.path)} // the fold button already toggled on each click
    >
      <StatusDot r={r} kids={folded ? kids : []} /> {/* folded: the dot speaks for the hidden nested repos too */}
      <div className="row__body">
        <button className="row__hit" aria-current={isOpen || undefined}>
          <span className="row__top">
            {r.parent && <FileSubmoduleIcon size={14} className="row__kind" />}
            <span className="row__name"><Hi text={r.name} q={q} /></span>
            <Pills r={r} compact />
            {last && <small className="row__ago" title={when(last.time)}>{ago(last.time)}</small>}
          </span>
          <span className="row__sub">
            <GitBranchIcon size={12} /><span className="row__branch"><Hi text={branchOf(r)} q={q} /></span>
            <span className="row__subject">{r.error ? 'Error' : last ? <Hi text={last.subject} q={q} /> : 'No commits yet'}</span>
          </span>
        </button>
        <div className="row__foot">
          {kids.length > 0 && (
            <button className="row__fold" onClick={() => onFold(r.path)} aria-expanded={!folded} title={`${folded ? 'Show' : 'Hide'} ${kids.length} nested ${kids.length === 1 ? 'repo' : 'repos'}`}>
              {folded ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}<FileSubmoduleIcon size={12} />{kids.length}
            </button>
          )}
          <Tags r={r} fields={fields} />
        </div>
      </div>
    </div>
  )
}

// The status code picks the icon and the plain words in its tooltip: ?? untracked, A added, D deleted, R/C renamed or copied,
// else modified. A conflict is any code with a U, or both sides adding or deleting the file (AA, DD).
const FILE = {
  '?': [DiffAddedIcon, 'new', 'New, not tracked yet'], A: [DiffAddedIcon, 'add', 'Added'], D: [DiffRemovedIcon, 'del', 'Deleted'],
  R: [DiffRenamedIcon, 'mod', 'Renamed'], C: [DiffRenamedIcon, 'mod', 'Copied'], U: [AlertIcon, 'del', 'Conflict'],
}
const fileKind = (code) => FILE[/U|AA|DD/.test(code) ? 'U' : code.trim()[0]] ?? [DiffModifiedIcon, 'mod', 'Modified']

// The reading pane: everything about the open repo. Esc closes it.
export function Details({ r, fields, q, onMeta, onAbout, onFields, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('dialog[open]') && onClose() // Esc in a dialog closes only the dialog
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <section className="details" aria-label={`${r.name} details`}>
      <header className="details__head">
        <div className="details__title">
          <h2>
            {r.parent && <><button className="crumb" onClick={() => onSelect(r.parent)} title="Open parent repo">{baseName(r.parent)}</button><span className="crumb"> / </span></>}
            <Hi text={r.name} q={q} />
          </h2>
        </div>
        <div className="details__more">{/* full width, under the title and the close button */}
          <About key={r.path + '|' + r.about} r={r} q={q} onSave={onAbout} />
          <code><Hi text={r.path} q={q} /></code>
        </div>
        <Actions r={r} />
        <button className="ibtn" onClick={onClose} title="Close (Esc)" aria-label="Close details"><XIcon size={18} /></button>
      </header>
      <div className="details__status">
        <p className="branch"><GitBranchIcon size={14} /><span><Hi text={branchOf(r)} q={q} />{r.upstream && <span className="muted"> → {r.upstream}</span>}</span></p>
        <Pills r={r} />
      </div>
      {r.error ? <p className="error">{r.error}</p> : (
        <div className="details__cols">
          <section>
            <h3 className="label">Uncommitted · {r.changed}</h3>
            {r.files.length ? (
              <ul className="files">
                {r.files.map((f) => {
                  const [Icon, kind, words] = fileKind(f.code)
                  return <li key={f.path} title={words}><Icon size={16} className={kind} aria-label={words} /><Hi text={f.path} q={q} /></li>
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
                  <li key={c.hash}><GitCommitIcon size={16} /><code>{c.hash}</code><span title={c.subject}><Hi text={c.subject} q={q} /></span><small title={when(c.time)}>{ago(c.time)}</small></li>
                ))}
              </ul>
            ) : <p className="muted">No commits yet.</p>}
          </section>
          {r.pkg && (
            <>
              <PkgSection title="Scripts" repo={r.name} items={scriptsOf(r.pkg)} row={scriptRow} />
              <PkgSection title="Dependencies" repo={r.name} items={depsOf(r.pkg)} row={depRow} />
            </>
          )}
        </div>
      )}
      <MetaSection r={r} fields={fields} onSave={onMeta} onManage={onFields} />
    </section>
  )
}
