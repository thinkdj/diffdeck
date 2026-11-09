# AGENTS.md

Notes for coding agents (and people) working on diffdeck. The README covers what it does and how to run it; this file covers the things that are easy to break.

## Principles

- **Simple first.** KISS, DRY, no speculative abstractions. Plain JavaScript (no TypeScript), React 19, Vite, the `git` CLI. No runtime dependencies: everything in `devDependencies`, React and the icons are bundled into `dist/`.
- **Read-only toward repos.** diffdeck never commits, fetches, checks out or writes anything inside a repo. All git calls go through `server/git.js` and must stay read-only. Its only state is `~/.diffdeck.json`.
- **Windows, macOS and Linux.** Paths may use `\`. Use `path` on the server, `execFile` (never a shell), and test anything path-related with a Windows path in mind.
- **Plain words in the UI.** Short, human copy ("Never pushed", "Stop watching this folder?"), no jargon.

## Server

- `server/git.js` is the only place that runs git: `execFile('git', ['--no-optional-locks', '-c', 'core.quotepath=false', ...])`. `--no-optional-locks` keeps `status` from touching the index, and `core.quotepath=false` keeps non-ASCII paths readable. `status()` never throws: a broken repo comes back as `{ error }` and shows as an Error row.
- Status comes from `git status --porcelain=v2 --branch --show-stash`, `git log -5` and `git remote -v`. `files` is capped at 200, but `changed` is the real count. `webUrl()` strips credentials, so only a clean https URL ever reaches the page.
- `pkg` comes from `readPkg()` in `server/api.js`: the repo's `package.json` scripts, dependencies and devDependencies (string values only), or `null` when there is none. The page (`src/Pkg.jsx`) shows ten of each and the rest in a side sheet, a native `<dialog>` like the others.
- Discovery (`server/api.js`): a watched path is either a repo or a folder of repos (one level down). Every repo found is checked one more level down for nested repos, which carry `parent`. A repo found twice is listed once.
- Added paths are cleaned: surrounding quotes stripped (Explorer's "Copy as path"), `~` expanded, the Windows drive letter uppercased (so `v:\` and `V:\` are the same root).
- `load()` refuses to go on if `~/.diffdeck.json` exists but can't be parsed, so a hand-edited typo is never overwritten. Missing file means empty config.
- **Every route answers with the full fresh list** (`list()`), so the page has one code path: `run(url, opts)` in `src/App.jsx` sets the data. Keep new routes that way.
- **Security:** the CLI listens on 127.0.0.1 only and answers only to localhost Host headers (DNS rebinding). Non-GET requests with a foreign `Origin` get 403, and POSTs must be `application/json`, which another site can't send without a CORS preflight that nothing answers. Keep both checks in front of any new write route.
- Port 4747 is fixed on purpose: the theme lives in localStorage per origin. A second `npx diffdeck` finds the first through `GET /api/ping` and just opens it; if the port belongs to something else it tries the next one (unless `--port` was given).
- `pnpm dev` mounts the same `api` handler inside Vite (`vite.config.js`), so dev and the CLI behave the same.
- `server/pickFolder.js` opens the OS folder dialog behind Browse (PowerShell, osascript, zenity). It resolves to an empty string when cancelled. It deliberately has no `windowsHide`, which would hide the dialog itself.

## Metadata

- Config shape: `fields: [{ key, desc, type, default?, repo? }]`, `meta: { "<repo path>": { [key]: value } }` and `about: { "<repo path>": text }`, the repo description (`setAbout`, `POST /about`, up to 1,000 characters, `r.about` on the page).
- A description renders through `inline()` in `src/inline.js`: `*bold*`, `_italic_`, `[text](url)` and bare URLs, as tokens turned into React elements, never HTML. Only http(s) links pass `safeUrl`; anything else stays text. Keep it that way: no `dangerouslySetInnerHTML`.
- Types: `boolean`, `string`, `text`, `date` (`YYYY-MM-DD`, what `<input type="date">` gives).
- **Fields are defined globally, values are per repo.** A field without `repo` is Global (every repo has it); with `repo` it is Local to that one path. `fieldsFor(fields, path)` gives a repo's fields, globals first, and every UI place (list rows, details, search, the dialog) goes through it. A field is identified by `key` plus `repo`, so edits and deletes send both (`DELETE /fields?key=&repo=`).
- Names are unique among the fields one repo can see: globals never share a name, and a local can't take a global's name (or a global a local's), so `meta[path][key]` is never ambiguous. Two repos may each have a local with the same name. Scope is fixed at creation; there is no promote or demote.
- `server/meta.js` holds all the rules as **pure functions** (`saveField`, `removeField`, `setValue`, `withMeta`). The API and the demo both use them, so they must stay free of Node APIs. Validation lives there: name up to 40 characters, description up to 200, short text up to 200 with no line breaks, long text up to 10,000. `src/Meta.jsx` mirrors the text limits as `maxLength` (`LIMIT`); change both together.
- Empty values (`''`, `false`, `null`) are never stored; they delete the key, and a repo with no values left is dropped from `meta`. A Yes / No field is therefore either `true` or absent.
- A field may have a `default` (the dialog's NULL box, checked, means none). `withMeta` fills it in for repos without their own value. Clearing a value on a field with a default stores `null` instead of deleting the key, so the repo stays empty; `withMeta` drops nulls, so the page never sees one. Dropping the default drops those nulls too.
- Renaming a field (`was` → `key`) moves its values; a type change keeps only values that fit the new type. Field names that exist on `Object.prototype` (`constructor`, `__proto__`, …) are refused, so plain `obj[key]` lookups stay safe.
- Values and local fields are keyed by the repo's absolute path. Moving a repo loses its metadata; removing a watched folder keeps it (it comes back if you re-add the folder).
- The fields dialog is opened from one repo's details (`FieldsDialog repo={r}`): it lists the globals and that repo's locals, and the scope choice ("Every repo" / "Only <name>") shows only when adding.
- Inputs in the details pane are **uncontrolled** and keyed by their saved value, so a fresh value from the server remounts them while the input you moved to keeps focus. Text and dates save on blur or Enter (Ctrl+Enter in long text), switches on change, and nothing is sent when the value didn't change. Esc in an input undoes the edit and stops propagation, so it doesn't close the pane.

## Page

- Inbox layout: the list (`aside.side`) on the left, the open repo (`main`) on the right, each scrolling on its own inside a `100dvh` page. Under 860px only one shows: the list, or the open repo with its X going back.
- The list is a tree of **groups**: a top-level repo plus its nested repos (`kids`), which sit indented under it on guide lines and fold with the count button that leads the parent's third line, before its tags, or a double-click on the parent row (`folded`, a Set of parent paths). There is no fold-arrow column, so rows keep their width. Filters, search and sort work on groups; a group shows if the parent or any kid matches. Search covers contents only (`contents()`: name, branch, path, commit subjects, file paths) and `Hi` highlights matches; metadata has its own filters (`src/Filters.jsx`, `metaHit`), one select per field, with a filter on a local field matching only the repo that has it. `rowsRef` holds the rows on screen in order, which is what the arrow keys walk.
- Status: `badges()` in `src/Repo.jsx` decides the pills and their tone (`bad`, `warn`, `ok`, plain). Each row has a status dot with the reasons in a tooltip; a folded parent's dot also covers its hidden kids.
- In demo mode an **Empty state** button in the top bar swaps `data` for an empty `view`, so the hosted demo can show the first-run page.
- Keys outside inputs and dialogs: `/` focuses search, up and down move the selection, Esc closes the open repo. Watched folders and the add bar live in a native `<details>` under the list; with no folders yet, the add bar sits in the empty state instead.
- The page refreshes on window focus (coming back from the editor). `refresh()` dedupes overlapping calls through `inflight`.
- Dialogs are native `<dialog>` with `showModal()`: `useConfirm()` in `src/Confirm.jsx` and `FieldsDialog` in `src/Meta.jsx`. Render a confirm **outside** another dialog's React tree, or its Esc reaches the outer dialog's `onCancel`. The details pane ignores Esc while any dialog is open.
- Errors from the API show in the page notice; `FieldsDialog` shows the same `error`, because the page notice is hidden behind the modal.

## Styles

- `src/app.css`, one file, tokens from the cdn.farm design system ("Glacier" accent). Light and dark are `[data-theme]` on `<html>`, set in `index.html` before first paint to avoid a flash.
- Breakpoints: 860px (one pane at a time, the page scrolls as a whole), 640px (phone: icon-only Refresh, the empty-state add bar wraps, tooltips fixed along the bottom of the screen) and 420px (small phone: rows rearrange, pills under the name and branch and commit on their own lines, filters 2 by 2, detail actions in a grid). Inputs are 16px on phones so iOS doesn't zoom. In the list the tooltip opens to the right of the dot, so the pane's edge never clips it.
- Long labels shorten with an ellipsis (`min-width: 0` plus `overflow: hidden` on a `<span>`), never by overflowing the page.

## Demo

- `vite --mode demo` swaps `api()` for `demoApi()` from `src/demo.js` (dynamically imported, so normal builds never include it). It builds to `dist-demo/` with relative paths for GitHub Pages (`.github/workflows/demo.yml`).
- The sample data must be shaped exactly like `GET /api/repos`. **When the API shape changes, update `src/demo.js` too.** Times and dates are relative to now so the demo never ages. Metadata edits work in memory; adding or removing watched folders explains that it is a demo.

## Tests, builds, releases

- `pnpm test` runs `node --test` on `server/*.test.js` and `src/inline.test.js` (plain `node:test` and `assert`, no framework). Test files are left out of the npm package.
- Check `pnpm build` and `pnpm build:demo` after UI changes.
- Releases: `pnpm release` (or `:minor`, `:major`, `:beta`) from a clean `main`. npm needs the owner's security key, so agents don't publish; the owner runs it in their own terminal. Note user-facing changes in `CHANGELOG.md` under **Unreleased**.
- Commits: plain human titles, no `feat:` style prefixes, no co-author trailers, no URLs in messages.
