# diffdeck

Every local git repo you juggle, on one page. Read-only: it never commits, fetches or writes to a repo.

```sh
pnpm install
pnpm start   # build and open http://localhost:4173
pnpm dev     # hot reload while working on diffdeck itself
pnpm test
```

Paste a repo path, or a folder that holds repos, into the add bar, or click Browse. Each path is checked one level down, and any repo found is checked one level down for nested repos, which show inside their parent's card. Your list is stored in `~/.diffdeck.json`.

Needs `git` on your PATH. Works on Windows, macOS and Linux.

- `server/git.js`: the only code that runs git (`execFile`, no shell, `--no-optional-locks`)
- `server/api.js`: `/api` routes and the saved list, mounted into Vite's own server
- `server/pickFolder.js`: the OS folder dialog behind Browse (PowerShell on Windows, osascript on macOS, zenity on Linux)
- `src/App.jsx`: the page
