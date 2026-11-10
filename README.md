# diffdeck

**The inbox for code you haven't shipped yet.**

diffdeck lists the git repos on your computer and what is still waiting in each one: changes you haven't committed, commits you haven't pushed, branches that have fallen behind, stashes and conflicts. Point it at the folder where you keep your code and it finds the repos, including ones nested inside other repos. You can give each repo a short description and fields of your own, like the stack it uses or when to look at it again. It runs on your computer and only ever reads your repos.

![diffdeck: the repo list on the left, with nested repos under their parent, and the open repo on the right with its uncommitted files, recent commits, scripts and dependencies](docs/screenshot.png)

See it with sample repos: [live demo](https://thinkdj.github.io/diffdeck/)

```sh
npx diffdeck
```

That starts diffdeck on your machine at http://localhost:4747 and opens it. Run it again while it is open and it just brings the page back up. Options: `--port <n>`, `--no-open`. Needs Node 20+ and `git` on your PATH, on Windows, macOS or Linux.

## Using it

- **Add your code.** Paste the path of a repo, or of a folder that holds repos, or click Browse. Later, more go in under **Watching**, below the list. Each path is checked one level down, and every repo found one level further for nested repos.
- **The list** has a row per repo with its status, branch and last commit. Nested repos sit under their parent and fold like folders: click the count on the parent's third line, or double-click the row.
- **The open repo** shows its description, uncommitted files, recent commits, the scripts and dependencies in its `package.json`, and its metadata.
- **Find things.** Press `/` to search names, branches, paths, descriptions, commits and file paths. Matches are highlighted, and up and down move through the results. Filter by status (changes, unpushed, behind) or by your own fields.
- **Descriptions** go under a repo's name: click to edit, Enter saves. `*bold*`, `_italic_` and links work.
- **Fresh numbers.** The list refreshes when you come back to the tab and every 5 minutes, or when you click Refresh.

Your list, descriptions and metadata are stored in `~/.diffdeck.json`, never in a repo.

## Metadata

Describe your repos with fields of your own. Open any repo's details, click **Add a field** (or **Edit fields**), and give it a name, an optional description, a scope, a type and an optional default value. Leave **NULL** checked for no default; otherwise every repo without a value of its own shows the default, until you change or clear it there.

Fields are defined once and filled per repo. The scope says which repos have the field:

- **Global**: every repo, for things you track everywhere, like **Uses Stripe** or **Stack**.
- **Local**: only the repo you added it from, for something only that repo needs, like **App Store** on a mobile app.

Local fields carry a **Local** tag in the details pane; global ones have no tag. A local field can't reuse the name of a global one, and the scope is fixed once the field is added. The types:

| Type | Input | In the list |
|---|---|---|
| Yes / No | switch | a tag with the name, when on |
| Short text | one line, up to 200 characters | the value, name on hover |
| Long text | multi-line box, up to 10,000 characters | details pane only |
| Date | date picker | the date, name on hover |

Then fill the fields in each repo's details pane. Every input saves by itself: a switch on toggle, text and dates on Enter or when you leave the box (Ctrl+Enter in long text), and Esc undoes an edit you haven't saved. Under the status filter, **Metadata** gives you one filter per field: Yes / No, a pick from the values in use for short text, Overdue / Next 7 days / Later for dates, Has text / Empty for long text. Active filters show as chips you can drop.

Fields and values live in `~/.diffdeck.json`, keyed by repo path, never in the repo itself:

```json
{
  "roots": ["/Users/sam/code"],
  "fields": [
    { "key": "Uses Stripe", "desc": "Takes payments through Stripe", "type": "boolean" },
    { "key": "App Store", "desc": "Is the latest build live?", "type": "boolean", "repo": "/Users/sam/code/mobile-app" }
  ],
  "meta": {
    "/Users/sam/code/invoice-app": { "Uses Stripe": true },
    "/Users/sam/code/mobile-app": { "Uses Stripe": true, "App Store": true }
  },
  "about": {
    "/Users/sam/code/invoice-app": "The *invoicing SaaS*: api and web in one workspace."
  }
}
```

A field with a `repo` is local to that repo. Renaming a field moves its values. Changing its type keeps only the values that still fit. Deleting a global field clears its value from every repo, a local one from its repo. A repo that moves to another folder starts with empty metadata.

## Safety

- **Read-only.** diffdeck runs `git status`, `git log` and `git remote`, and never commits, fetches, checks out or writes inside a repo.
- **Safe with repos you didn't make.** A repo's own config can tell git to run programs, and a folder you watch might hold one you unzipped from someone else. diffdeck switches those settings off for every git call (`core.fsmonitor`, `log.showSignature` and filter commands, except Git LFS), so looking at a repo never runs its code.
- **Local only.** The server listens on 127.0.0.1 and answers only to `localhost`. Other websites can't use it: browsers say where a request comes from, and diffdeck refuses any that isn't its own page.

## Develop

```sh
pnpm install
pnpm dev          # hot reload, with the git API, on port 4747
pnpm start        # build, then run the real CLI (bin/diffdeck.js)
pnpm test
```

- `bin/diffdeck.js`: the `npx diffdeck` command. Serves `dist/` and the API on 127.0.0.1, answers only to localhost
- `server/git.js`: the only code that runs git (`execFile`, no shell, `--no-optional-locks`, and a repo's own commands switched off)
- `server/api.js`: `/api` routes and the saved list
- `server/meta.js`: metadata fields and values, pure functions shared by the API and the demo
- `server/pickFolder.js`: the OS folder dialog behind Browse (PowerShell on Windows, osascript on macOS, zenity on Linux)
- `src/`: the page (React). `src/Meta.jsx` is the metadata UI, `src/inline.js` the little markdown for descriptions, `src/demo.js` the sample repos for the demo
- `scripts/screenshot.js`: `pnpm screenshot`, which makes `docs/screenshot.png`

## Demo

A static copy with sample repos and metadata, for showing the UI without installing anything. Metadata edits work there too, until you reload:

```sh
pnpm dev:demo     # try it locally
pnpm screenshot   # rebuild the demo, capture it with headless Chrome (set CHROME if it isn't found), save a 1600px optimized docs/screenshot.png
pnpm build:demo   # static site in dist-demo/, relative paths, host it anywhere (GitHub Pages, Netlify, Cloudflare Pages)
```

`.github/workflows/demo.yml` publishes it to GitHub Pages on every push to `main`. Turn it on once in the repo's Settings > Pages > Source: GitHub Actions.

## Release

By hand, from a clean `main`, in a normal terminal (npm opens the browser for your security key). Log in first: the login expires, and without it the publish fails with a misleading 404.

```bash
npm login
npm whoami     # must print your username before you go on
pnpm release
```

| Command | Version | npm dist-tag | Who gets it |
|---|---|---|---|
| `pnpm release` | 0.1.0 → 0.1.1 | `latest` | everyone running `npx diffdeck` |
| `pnpm release:minor` | 0.1.1 → 0.2.0 | `latest` | everyone |
| `pnpm release:major` | 0.2.0 → 1.0.0 | `latest` | everyone |
| `pnpm release:beta` | 0.2.0 → 0.2.1-beta.0 | `beta` | only `npx diffdeck@beta` |

Each one runs the tests, bumps `package.json`, commits `Release x.y.z` with a `vx.y.z` git tag, publishes (tests and build run again in `prepublishOnly`), then pushes the commit and tag. Publishing comes before the push, so a cancelled or failed publish leaves nothing half-released on GitHub. The bump commit and tag are already made locally by then, so don't rerun `pnpm release`, which would bump a second time: rerun `npm publish`, then `git push --follow-tags`.

To make a tested beta the default: `npm dist-tag add diffdeck@0.2.1-beta.0 latest`.

The package holds only `bin/`, `server/` and the built `dist/`, with no runtime dependencies: React and the icons are bundled into `dist/` at build time.

## License

MIT
