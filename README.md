# Pongkan Crew

[![CI](https://github.com/ratatatatcode/pongkan-crew/actions/workflows/ci.yml/badge.svg)](https://github.com/ratatatatcode/pongkan-crew/actions/workflows/ci.yml)

A terminal workspace for named Codex teammates. Chat, plan tasks, review changes, and follow your crew's work in one place.

![Pongkan Crew terminal interface](assets/images/pongkan-crew-cli.png)

## Highlights

- Coordinate implementation, independent review, and a final summary.
- Discuss ideas in Crew Chat, then turn the plan into work.
- Keep separate conversations and task history for each project.
- Run independent workflows in isolated Git worktrees.
- Use specialist crews, project memory, recurring checks, and GitHub issue imports.

## Quick start

Requires **Node.js 22+**, the **Codex CLI**, and a signed-in Codex account. No `npm install` is needed.

From this repository:

```powershell
codex login
node .\src\cli.js
```

To work on another existing project:

```powershell
node .\src\cli.js --folder "C:\Projects\My Project"
```

Use `/folder` inside the app to confirm the target.

## Usage

The default crew is **Chief, Researcher, Developer, and Reviewer**. Type in an individual Chat to talk to the selected teammate, or give the crew a goal:

```text
/task Improve the navigation, add tests, and review the changes.
```

To discuss first, open Crew Chat. Wait for the discussion to finish, then execute its plan:

```text
/discuss How should we improve the navigation?
/crew-task
```

Enter commands separately. Ordinary messages in Crew Chat continue a read-only discussion. Follow implementation in individual Chat and Activity; Crew Chat also shows workflow updates.

| Action                          | Command                                                   |
| ------------------------------- | --------------------------------------------------------- |
| Select a teammate               | `/chat developer`                                         |
| Assign work directly            | `/send developer GOAL`                                    |
| Follow progress                 | `/activity`                                               |
| Inspect changes                 | `/changes`, `/diff`                                       |
| Choose a specialist crew        | `/preset list`, `/preset apply web`                       |
| Start a separate conversation   | `/conversation new developer TITLE`                       |
| Run an isolated workflow        | `/task --isolated GOAL`                                   |
| Read a GitHub issue or PR       | `/github issue OWNER/REPO 12`, `/github pr OWNER/REPO 34` |
| Implement a GitHub issue        | `/github task OWNER/REPO 12 --isolated`                   |
| Save future results as Markdown | `/markdown on`                                            |
| Stop selected work              | `/stop`                                                   |
| Search command help             | `/help QUERY`                                             |

GitHub commands require an authenticated GitHub CLI (`gh`). They do not automatically commit, push, or open PRs. Isolated workflows start from committed `HEAD` and retain their branches and worktrees for review.

## Keyboard controls

Rotating tips appear below the command/status line while the CLI is open.

| Key                       | Action                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| Tab / Shift+Tab           | Cycle teammates and Crew Chat                                           |
| F2 / Shift+F2             | Switch views                                                            |
| Mouse wheel / PgUp / PgDn | Scroll responses, activity or panels                                    |
| Up / Down                 | Previous / next prompt; return to your new draft                        |
| Shift+Right               | Fill in the answer command for a waiting question; press again to cycle |
| Enter                     | Send                                                                    |
| Esc                       | Close a panel or clear input                                            |
| ? / F1                    | Open help                                                               |
| Ctrl+K                    | Stop selected work                                                      |
| Ctrl+C                    | Exit and stop work                                                      |

Mouse wheel scrolls responses, activity and panels while the input stays fixed. Up/Down previews submitted prompts and restores your new draft after the newest prompt. Stopping work does not undo file edits.

## Example: local todo website

![Local todo website preview](assets/images/todo-result.gif)

Build a local Next.js todo app with the crew: [walkthrough](docs/TODO_WEBSITE_WALKTHROUGH.md) / [full video](assets/video/todo-result.mp4).

## Settings and saved data

Use `/model` to inspect model settings, `/memory add TEXT` to save project guidance, and `/schedule` for recurring checks. `/context on` optionally clips long assistant context; full saved history is retained.

Project state lives in `<target-folder>/.pongkan-crew/`. Add `.pongkan-crew/` to your project's `.gitignore` and keep it private. `/markdown on` exports future changes to `docs/pongkan-docs/`; it defaults to off.

Writers can edit project files. Planning, discussions, and reviews are read-only. Keep changes in version control and read the [security boundaries](SECURITY.md).

## Troubleshooting

```powershell
node .\src\cli.js --doctor --folder "C:\Projects\My Project"
```

If Node or Codex is missing, install it and reopen the terminal. Run `codex login` to sign in. Close any other Pongkan Crew instance using the same folder. On Windows, set `PONGKAN_CODEX_BIN` to the full path of `codex.exe` if discovery fails.

## Documentation and development

[Command reference](docs/COMMANDS.md) / [Upgrading and recovery](docs/UPGRADING.md) / [Contributing](CONTRIBUTING.md) / [Security](SECURITY.md)

Run `npm ci` to install the development tools before running `npm run lint` or `npm run format:check`. Tests (`node --test`), offline previews (`node .\scripts\preview-display.js` and `node .\scripts\preview-display.js --activity`), and syntax validation (`node .\scripts\check-syntax.js`) need no installed dependencies. Continuous integration runs tests and both previews on Linux and Windows with Node 22 and 24. A separate Ubuntu job on Node 22 checks linting, formatting, syntax, package contents, and sensitive-path ignore rules.

## License

[MIT](LICENSE)
