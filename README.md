# diffdeck

Every local git repo you juggle, on one page: branch, uncommitted changes, unpushed commits and nested repos. Read-only: it never commits, fetches or writes to a repo.

See it with sample repos: [live demo](https://thinkdj.github.io/diffdeck/)

```sh
npx diffdeck
```

That starts diffdeck on your machine at http://localhost:4747 and opens it. Run it again while it is open and it just brings the page back up. Options: `--port <n>`, `--no-open`.

Paste a repo path, or a folder that holds repos, into the add bar, or click Browse. Each path is checked one level down, and any repo found is checked one level down for nested repos, which show inside their parent's card. Your list is stored in `~/.diffdeck.json`.

Needs Node 20+ and `git` on your PATH. Works on Windows, macOS and Linux.

## Develop

```sh
pnpm install
pnpm dev          # hot reload, with the git API, on port 4747
pnpm start        # build, then run the real CLI (bin/diffdeck.js)
pnpm test
```

- `bin/diffdeck.js`: the `npx diffdeck` command. Serves `dist/` and the API on 127.0.0.1, answers only to localhost
- `server/git.js`: the only code that runs git (`execFile`, no shell, `--no-optional-locks`)
- `server/api.js`: `/api` routes and the saved list
- `server/pickFolder.js`: the OS folder dialog behind Browse (PowerShell on Windows, osascript on macOS, zenity on Linux)
- `src/`: the page (React). `src/demo.js` holds the sample repos for the demo

## Demo

A static copy with sample repos, for showing the UI without installing anything:

```sh
pnpm dev:demo     # try it locally
pnpm build:demo   # static site in dist-demo/, relative paths, host it anywhere (GitHub Pages, Netlify, Cloudflare Pages)
```

`.github/workflows/demo.yml` publishes it to GitHub Pages on every push to `main`. Turn it on once in the repo's Settings > Pages > Source: GitHub Actions.

## Publish

```sh
npm publish       # runs the tests and builds dist/ first (prepublishOnly)
```

The package holds only `bin/`, `server/` and the built `dist/`, with no runtime dependencies: React and the icons are bundled into `dist/` at build time.

## License

MIT
