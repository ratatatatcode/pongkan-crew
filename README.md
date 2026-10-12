# Pongkan Crew

[![CI](https://github.com/ratatatatcode/pongkan-crew/actions/workflows/ci.yml/badge.svg)](https://github.com/ratatatatcode/pongkan-crew/actions/workflows/ci.yml)

A persistent team workflow workspace powered by Codex CLI. Chat with named teammates, turn discussions into assignments, review changes, and resume unfinished work in one place.

![Pongkan Crew terminal interface](assets/images/pongkan-crew-cli.png)

## Highlights

- Coordinate implementation, independent review, and a final summary.
- Discuss ideas in Crew Chat, then turn the plan into work.
- Keep separate conversations and task history for each project.
- Run independent workflows in isolated Git worktrees.
- Use specialist crews, project memory, recurring checks, and GitHub issue imports.

## How Crew builds on Codex

Codex CLI provides the coding engine, tools, sessions, and sandbox. Crew adds a project-level roster, shared discussions, saved task dependencies, coordinated handoffs, and combined Markdown records. Standard Codex already supports specialist subagents, review, session recovery, queues, and worktrees; these capabilities alone are not unique to Crew. See the [capability comparison](docs/CODEX_COMPARISON.md) for advantages and current limits.

### Handoffs and execution

A handoff passes one teammate's findings to the next assignment. Researcher identifies relevant files, Developer reports changes and checks, and Reviewer inspects the work before Chief summarizes it. Crew supplies previous completed workflow results, available changed-file names, and clarification answers to subsequent tasks. Teammates share project files, but do not automatically share their entire conversations.

The lead creates sequential assignments. Workflows started in Crew Chat also show a lead briefing, worker reply, reviewer feedback, and worker response before final review and summary. Only relevant specialists need an assignment. Crew members are instructed not to spawn additional agents; independent eligible tasks or isolated workflows can still run through Crew's scheduler.

Workflow completion means the scheduled stages finished, not that every review finding passed. Read the final findings and reported checks. Corrections entered during execution apply at the next task boundary; they do not immediately interrupt a running Codex turn. Long handoff context may be shortened, while full saved results remain available.

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

The default crew is **Chief, Researcher, Developer, and Reviewer**. Press **Tab / Shift+Tab** to cycle through teammates and Crew Chat. Press **F2 / Shift+F2** to switch among Chat, Crew Chat, and Activity. Type normally and press Enter. Crew Chat sends plain messages directly to Chief; `@NAME` sends directly to that teammate. Individual Chat sends to the selected teammate.

| Where you type        | Who receives your message                               | Sample usage                                  |
| --------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Crew Chat or Activity | Your crew's designated lead (Chief in the default crew) | `Plan a todo app and have Reviewer check it.` |
| Individual Chat       | The selected teammate                                   | `How does state persistence work?`            |
| `@NAME MESSAGE`       | The named teammate, using shared Crew Chat context      | `@developer Implement the agreed layout.`     |

Use your own words; no specific verb or keyword is required. Crew interprets each message and routes it to a reply, assignment, discussion, or workflow within the crew's permissions. In Crew Chat, a natural follow-up such as `Proceed with what you've discussed.` can start a coordinated workflow using the recent discussion as context. Use `/discuss`, `/task`, or `/crew-task` when you prefer an explicit command.

Natural-language routing does not grant access: each action still follows the selected recipient's permissions. Developer can implement an edit or perform authorized Git work directly; Reviewer stays read-only. Questions and actions use the same delivery path.

Every personality uses this same delivery and execution behavior. Styles change wording and tone, never permissions or action selection. Short acknowledgements such as “Okay” keep the recipient's configured access and conversation context.

Messages are saved and queued for the routed recipient or workflow. Follow-ups retain the conversation context. Use `/discuss` for team discussion and `/task` or `/crew-task` for an explicit coordinated workflow with independent review. You can also approve a plan in your own words; Crew uses recent Crew Chat context to interpret the request.

```text
How should we improve the navigation?
Okay, go ahead with the plan. Add tests too.
Use shared queues and preserve the existing permissions.
What have you finished so far?
Continue where you stopped.
```

Messages sent while another shared turn is active queue after it. Use `/stop` to cancel work, `/queue resume` to dispatch saved queued tasks, and `/workflow resume ID` to continue unfinished workflow steps. Plain `continue` is delivered to the recipient as conversation, without a separate classifier.

Plain messages resume dispatch for the current conversation; unrelated paused assignments stay paused. Individual Chat continues to address the selected teammate. Messages entered in Activity use the current Crew Chat. Slash commands remain available as explicit overrides; `/workflow retry ID` deliberately restarts the entire workflow.

To ask a question of only one teammate, start the message with `@NAME`:

```text
@chief What will be the approach in a simple manner?
```

`@developer Replace Show and Hide with Show summary and Hide summary.` queues one Developer turn with write access. `@developer Commit and push.` uses the same direct path. Enter and Shift+Left use the same delivery. A mention does not change the recipient's configured access.

Ordinary messages can request one recipient's reply or a workflow, depending on their meaning. `/discuss` explicitly schedules two rounds and a lead summary.

Crew Chat and individual chats use separate sessions. A teammate's individual chat does not automatically receive what they just discussed in Crew Chat. Continue with `@NAME` in Crew Chat when you want them to use that discussion, or include the relevant details in their individual chat. In Crew Chat, approve the plan naturally—for example, `Proceed with what you've discussed.`—or use `/crew-task` for an explicit command.

### Optional `/task` and `/crew-task` overrides

You can ask for work in ordinary language instead of typing either command. Crew interprets the request and routes it to a reply or coordinated workflow as appropriate. For example, ask Chief to build a feature and have Reviewer check it; Crew can plan and assign the work automatically. Use `/task` or `/crew-task` when you want to explicitly choose a workflow path.

| Command             | Goal                                              | Crew Chat context                                   | Requirement                                                                   | Opens after starting                                           | Sample usage                                        |
| ------------------- | ------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `/task GOAL`        | Required                                          | Included when run from Crew Chat; otherwise omitted | No discussion required                                                        | Crew Chat when started there; otherwise lead's individual Chat | `/task Add filters and ask Reviewer to check them.` |
| `/crew-task [GOAL]` | Optional; without one, implements the agreed plan | Always uses the latest discussion, from any view    | A saved Crew Chat discussion; any active discussion must finish or be stopped | Crew Chat                                                      | `/crew-task` (use the saved discussion)             |

These optional overrides create a coordinated workflow in which the lead plans assignments, requests an independent review, and summarizes the result. Use `/task` for a standalone goal and `/crew-task` to carry the current Crew Chat discussion into implementation. Plans, live teammate replies, review, and summaries appear in the originating Crew Chat. Future assignments and task records appear in Activity.

**Individual chat context:** Workflows originating in Crew Chat use separate execution sessions. Standalone workflows use each teammate's active individual conversation. The lead plans with their own chat context; selecting Developer and entering `/task` does not automatically send Developer's private conversation to the lead. `/crew-task` explicitly includes Crew Chat history, but does not collect everyone's private chats. Include relevant private-chat decisions in the goal or Crew Chat before starting.

### Share a private exchange with another teammate

In Developer's individual Chat, enter `/share reviewer Review keyboard support`. This copies the latest completed user/assistant exchange into a new named Crew Chat for Developer and Reviewer. Both reply there in read-only discussion rounds, and follow-ups stay with that duo. Older private exchanges and other individual chats stay private; mentioning a teammate alone does not share anything. Wait for the private reply to finish before sharing.

Use `/crew-task` after the discussion finishes to execute with its shared findings. A plain approval is interpreted by its recipient AI and does not schedule a workflow. `/crew-task --isolated` carries those findings into a separate worktree with fresh individual conversations. Workflow planning, implementation, and review can involve additional crew members. `/handoff` remains a direct assignment to one teammate; `/share` creates a visible shared discussion.

### Adding `--isolated`

| Command                        | Behavior                                                                                                                 | Sample usage                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `/task --isolated GOAL`        | Runs the goal in a separate Git worktree. Includes Crew Chat history when started from Crew Chat.                        | `/task --isolated Add a remaining count.`           |
| `/crew-task --isolated [GOAL]` | Runs the current Crew Chat plan in a separate Git worktree, with an optional goal override. Requires a saved discussion. | `/crew-task --isolated` (uses the saved discussion) |

`--isolated` starts from committed `HEAD` and creates fresh individual conversations for the workflow. Existing private-chat history is not carried over; explicitly supplied goals and Crew Chat context still are. Commit the changes you want included before starting. The branch and worktree remain available for inspection afterward; the command does not automatically commit, merge, push, or open a PR.

| Action                          | Sample usage                                                |
| ------------------------------- | ----------------------------------------------------------- |
| Select a teammate               | `/chat developer`                                           |
| Assign work directly            | `/send developer Add a remaining count.`                    |
| Follow progress                 | `/activity`                                                 |
| Inspect changes                 | `/changes` or `/diff`                                       |
| Choose a specialist crew        | `/preset list`, then `/preset apply web`                    |
| Start a separate conversation   | `/conversation new developer Todo polish`                   |
| Run an isolated workflow        | `/task --isolated Add a remaining count.`                   |
| Read a GitHub issue or PR       | `/github issue OWNER/REPO 12` or `/github pr OWNER/REPO 34` |
| Implement a GitHub issue        | `/github task OWNER/REPO 12 --isolated`                     |
| Save future results as Markdown | `/markdown on`                                              |
| Stop selected work              | `/stop`                                                     |
| Search command help             | `/help permissions`                                         |

GitHub commands require an authenticated GitHub CLI (`gh`). They do not automatically commit, push, or open PRs. Isolated workflows start from committed `HEAD` and retain their branches and worktrees for review.

## Keyboard controls

Rotating tips appear below the command/status line while the CLI is open.

| Key                       | Action                                                                     | Sample usage                                      |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Tab / Shift+Tab           | Cycle teammates and Crew Chat                                              | Press Tab until Developer is selected.            |
| F2 / Shift+F2             | Switch views                                                               | Press F2 to open Activity.                        |
| Mouse wheel / PgUp / PgDn | Scroll responses, activity or panels                                       | Page up to read earlier Crew Chat messages.       |
| Up / Down                 | Move through input lines; browse prompt history beyond the first/last line | Press Up to recall an earlier prompt.             |
| Left / Right              | Move the cursor across input line boundaries                               | Move Left to edit the previous line.              |
| Home / End                | Jump to the current input line's beginning/end                             | Press Home to edit from the line start.           |
| Ctrl+Home / Ctrl+End      | Jump to the entire prompt's beginning/end                                  | Press Ctrl+Home to edit from the prompt start.    |
| Ctrl+P / Ctrl+N           | Browse prompt history from anywhere in the input                           | Press Ctrl+P for the previous prompt.             |
| Shift+Left                | Send the typed prompt; resume only its conversation                        | Press Shift+Left to send the current message.     |
| Shift+Right               | Fill in the answer command for a waiting question; press again to cycle    | Press Shift+Right to fill a waiting answer.       |
| Enter                     | Send the full prompt; resume only its conversation                         | Type a message, then press Enter to send it.      |
| Shift+Enter               | Insert a new line without sending                                          | Press Shift+Enter to continue a multiline prompt. |
| Esc                       | Close a panel or clear input                                               | Press Esc to close the open settings panel.       |
| ? / F1                    | Open help                                                                  | Press ? to see the help screen.                   |
| Ctrl+K                    | Stop selected work                                                         | Press Ctrl+K to stop the selected task.           |
| Ctrl+C                    | Exit and stop work                                                         | Press Ctrl+C to exit the CLI.                     |

Mouse wheel scrolls responses, activity and panels while the input stays fixed. Long input uses up to five visible lines, including a `[1,234 characters hidden]` marker when collapsed. The visible text follows the cursor; Enter and Shift+Left send the full input without a character limit imposed by Crew. The footer leaves one blank line at the bottom.

Shared follow-ups queue after earlier shared turns and retain their submitted text. Direct delivery respects the recipient permissions. Use explicit workflow commands for coordinated work; stopping does not undo file edits.

## Example: local todo website

![Local todo website preview](assets/images/todo-result.gif)

Build a local Next.js todo app with the crew: [walkthrough](docs/TODO_WEBSITE_WALKTHROUGH.md) / [full video](assets/video/todo-result.mp4).

## Settings and saved data

Use `/model` to inspect model settings, `/memory add TEXT` to save project guidance, and `/schedule` for recurring checks. Routing and shared discussion prompts use recent bounded context while preserving the latest user request. Full saved history remains available; `/context on` additionally clips optional handoff and recovered-chat context. When application source changes during a session, a persistent restart notice identifies that the running process still uses its loaded code.

Markdown exports use UTF-8 and are written when work finishes: one file per workflow or discussion, plus one per standalone task. Workflow steps and discussion turns do not create separate files. To consolidate older task exports or repair encoding, enable `/markdown on` and run `/markdown refresh`. It saves combined documents before removing their owned task duplicates; unrelated files and saved history are preserved.

Project state lives in `<target-folder>/.pongkan-crew/`. Add `.pongkan-crew/` to your project's `.gitignore` and keep it private. `/markdown on` exports finished work to `docs/pongkan-docs/`; it defaults to off. Live progress remains in the app, and export files are not automatically added to model context. Crew Chat exports retain submission metadata.

Writers can edit project files. Planning, discussions, and reviews are read-only. Keep changes in version control and read the [security boundaries](SECURITY.md).

### Codex permission modes

Use `/permissions [NAME]` to choose a teammate's mode, or `/permissions MODE [NAME]` to set one directly (`ask`, `approve`, `full`, or `read-only`). These modes configure the Codex CLI sandbox and approval behavior; they do not change Windows account permissions. The teammate's Crew role still applies, so a read-only teammate cannot write even when another mode is selected.

- **Ask for approval** keeps workspace writes inside the workspace sandbox and requests approval for eligible access outside it. Crew runs Codex noninteractively, so requests that need a live user prompt may stop without being approved.
- **Approve for me** uses Codex's workspace-write sandbox and automatic review for eligible requests. It does not grant unrestricted filesystem access.
- **Full Access** removes Codex's filesystem sandbox and runs without approval. Use only when you intend to allow access beyond the project workspace.
- **Read Only** blocks edits and access escalation.

## Troubleshooting

```powershell
node .\src\cli.js --doctor --folder "C:\Projects\My Project"
```

If Node or Codex is missing, install it and reopen the terminal. Run `codex login` to sign in. Close any other Pongkan Crew instance using the same folder. On Windows, set `PONGKAN_CODEX_BIN` to the full path of `codex.exe` if discovery fails.

If a Node/npm command reports `EPERM` for a path outside the project (for example, `C:\Users\...`), **Approve for me** may not resolve the Windows access failure. Identify the exact required path and grant only that path if needed; Full Access removes the sandbox boundary for the whole run.

## Documentation and development

[Command reference](docs/COMMANDS.md) / [Codex comparison](docs/CODEX_COMPARISON.md) / [Upgrading and recovery](docs/UPGRADING.md) / [Todo website walkthrough](docs/TODO_WEBSITE_WALKTHROUGH.md) / [Markdown export contract](docs/MARKDOWN_SAVING_CONTRACT.md) / [Contributing](CONTRIBUTING.md) / [Security](SECURITY.md)

### Development checks

Run `npm ci` to install the development tools before running `npm run lint` or `npm run format:check`. Tests (`node --test`), offline previews (`node .\scripts\preview-display.js` and `node .\scripts\preview-display.js --activity`), and syntax validation (`node .\scripts\check-syntax.js`) need no installed dependencies. Continuous integration runs tests and both previews on Linux and Windows with Node 22 and 24. A separate Ubuntu job on Node 22 checks linting, formatting, syntax, package contents, and sensitive-path ignore rules.

Optional live checks use your signed-in Codex account: `node .\scripts\check-codex.js` verifies a short response and session resume; `node .\scripts\check-workflow.js` checks planning, assignment, review, and summary in a temporary read-only project; `node .\scripts\check-routing.js` checks unfamiliar phrasing and contextual approval without dispatching any work. They make real model requests and are separate from offline tests. On Windows, `node .\scripts\check-terminal-input.js` checks synthetic console input; it requires login for startup but sends no agent assignments.

## License

[MIT](LICENSE)
