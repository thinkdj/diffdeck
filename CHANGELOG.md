# Changelog

What changed in each release, in plain words. Newest first.

## 1.1.0

The inbox release: a new two-pane layout, your own metadata and descriptions, and safety with repos you didn't make.

- **Safer with repos you didn't make:** a repo's own git config can no longer make diffdeck run a program. Every git call switches off `core.fsmonitor`, `log.showSignature` and the repo's filter commands (Git LFS keeps working), and git no longer steps into submodules from the parent.
- **Harder to poke from other websites:** the server refuses any request another site makes, reads included, and a malformed address no longer stops it.
- **Descriptions:** give each repo a description under its name, edited in place. `*bold*`, `_italic_` and links render; only http and https links are allowed. Search looks through descriptions too.
- **Synced at and auto-refresh:** the top bar says when the list was last synced and how long ago (a few seconds ago, 1m ago, 1h ago). The list refreshes itself every 5 minutes while the tab is visible, as the Refresh button's tooltip says.
- **New layout:** the page works like an inbox. The repos are a list on the left, with nested repos under their parent on file-manager guide lines, folded by the count on the parent's row or a double-click, and the repo you pick opens on the right with its files, commits and metadata. Metadata shows as compact tags that shorten instead of falling off the row. Both sides scroll on their own, so nothing is wasted on empty card space. Up and down move through the list. Watched folders and the add bar fold away under the list. On phones you see one side at a time.
- **Default values:** a metadata field can have a default that every repo without its own value shows. Leave NULL checked for none. Clearing a value in one repo keeps it empty instead of falling back.
- **Metadata filters:** one filter per field under the status filter, Yes / No, a pick from the values in use, Overdue / Next 7 days / Later for dates, with the active ones as chips. Search now sticks to contents (names, branches, paths, commit subjects, file paths) and highlights matches.
- **Details actions:** Copy path and Open in VS Code sit together on the left, the remote link on the right. A better first-run page, and the demo can show it with the **Empty state** button.
- **Scripts and dependencies:** a repo with a `package.json` shows its scripts, the usual ones first, and its dependencies, dev ones tagged, in the details pane. Ten of each, with **View all** opening the full list in a side sheet.
- **Metadata:** define your own fields (Yes / No, short text, long text or date, each with an optional description) and fill them per repo in the details pane. A field is Global, on every repo, or Local, on just the repo you add it from, tagged Local. Filled fields show as tags in the list, and the metadata filters find them. Stored in `~/.diffdeck.json`, never in the repo. The demo has sample metadata you can edit.
- **Small touches:** styled tooltips for every button after a short pause, up and down work while typing in search, a layout for screens under 420px, a link with `?open=<repo path>` that opens that repo, and the tagline: the inbox for code you haven't shipped yet.
- **Phones and tablets:** the whole page fits small screens. Filters get their own row, buttons go icon-only, tooltips sit along the bottom of the screen, and inputs no longer make iOS zoom.
- **Release scripts:** `pnpm release`, `release:minor`, `release:major` and `release:beta` bump, tag, publish to npm and push in one step.

## 0.1.0

The first release.

- **One page for every local repo:** a card per repo with its branch, a status dot, status pills (conflicts, changes, to push, behind, stashes, no remote, never pushed) and its last commit.
- **Nested repos:** repos one level inside a repo show inside their parent's card.
- **Details panel:** opens under the card's row with the uncommitted files, recent commits, upstream, and a tree for switching between a repo and its nested repos.
- **Find what needs you:** filter by Changes, Unpushed or Behind, search by repo or branch (press `/`), and sort by most recent or by name.
- **Watch folders:** paste a repo or a folder of repos, or pick one with Browse (the system folder dialog). Removing one asks first and never touches the disk.
- **Quick actions:** open in VS Code, open the remote on GitHub or another host, copy the path.
- **Light and dark themes**, remembered in the browser.
- **Fresh numbers:** refresh by button, or just come back to the tab.
- **`npx diffdeck`:** runs on localhost port 4747 and opens the browser. Running it again reopens the running copy. Options: `--port`, `--no-open`.
- **Read-only and local:** git runs with read-only commands only, the server listens on 127.0.0.1, and requests from other sites are refused.
- **Live demo** with sample repos, published to GitHub Pages.
