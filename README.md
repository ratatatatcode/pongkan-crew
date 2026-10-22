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
- Get local project briefings and opt-in alerts for questions, stopped work, and finished results.

## How Crew builds on Codex

Codex CLI provides the coding engine, tools, sessions, and sandbox. Crew adds a project-level roster, shared discussions, saved task dependencies, coordinated handoffs, and combined Markdown records. Standard Codex already supports specialist subagents, review, session recovery, queues, and worktrees; these capabilities alone are not unique to Crew. See the [capability comparison](docs/CODEX_COMPARISON.md) for advantages and current limits.

### Handoffs and execution

A handoff passes one teammate's findings to the next assignment. Researcher identifies relevant files, Developer reports changes and checks, and Reviewer inspects the work before Chief summarizes it. Crew supplies previous completed workflow results, available changed-file names, and clarification answers to subsequent tasks. Teammates share project files, but do not automatically share their entire conversations.

New workflows keep one persistent lead responsible for delivery. It inspects current artifacts and chooses one next action at a time: work within its own access, delegate a bounded assignment, request independent review, ask a material question, deliver an accepted result, or report an evidenced external blocker. It can repeat work and review as needed instead of creating a fixed plan up front. Crew members are instructed not to spawn additional agents; independent eligible tasks or isolated workflows can still run through Crew's scheduler. Older saved workflows and explicit legacy records remain supported.

New lead workflows complete only after an independent reviewer verifies the requested outcome. Failed requirements and unavailable required checks remain visible and can return to the lead for more work. Older legacy workflows may finish with unresolved review findings, so inspect their reports. Corrections entered during execution apply at the next task boundary; they do not immediately interrupt a running Codex turn. Long handoff context may be shortened, while full saved results remain available.

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

The default crew is **Chief, Researcher, Developer, and Reviewer**. Press **Tab / Shift+Tab** to cycle through teammates and Crew Chat. Press **F2 / Shift+F2** to switch among Chat, Crew Chat, and Activity. Type normally and press Enter. Crew Chat sends plain messages to the designated lead. Use /discuss for collective replies. `@NAME` addresses that teammate. Individual Chat sends to the selected teammate.

| Where you type        | Who receives your message                               | Sample usage                                  |
| --------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Crew Chat or Activity | Your crew's designated lead (Chief in the default crew) | `Plan a todo app and have Reviewer check it.` |
| Individual Chat       | The selected teammate                                   | `How does state persistence work?`            |
| `@NAME MESSAGE`       | The named teammate, using shared Crew Chat context      | `@developer Implement the agreed layout.`     |

Plain messages go directly to the selected teammate in Individual Chat, or to the designated lead in Crew Chat unless you name a recipient with `@NAME`. When that conversation has unfinished workflow tasks, follow-ups are interpreted against the current assignments so they can resume or correct existing work. This uses saved conversation and task state, not phrase matching. Use `/task` or `/crew-task` to start a new coordinated workflow, and `/discuss` for team discussion.

Natural-language routing does not grant access: each action still follows the selected recipient's permissions. Developer can implement an edit or perform authorized Git work directly; Reviewer stays read-only. Questions and actions use the same delivery path.

Every personality uses this same delivery and execution behavior. Styles change wording and tone, never permissions or action selection. Short acknowledgements such as “Okay” keep the recipient's configured access and conversation context.

Messages are saved and queued for the recipient or workflow. Follow-ups retain the conversation context. Use `/discuss` for team discussion and `/task` or `/crew-task` for an explicit coordinated workflow with independent review. With no unfinished workflow in context, ordinary text stays with the recipient; when unfinished work exists, the router can continue it without repeating completed steps.

```text
How should we improve the navigation?
Okay, go ahead with the plan. Add tests too.
Use shared queues and preserve the existing permissions.
What have you finished so far?
Continue where you stopped.
```

Messages sent while another shared turn is active queue after it. Use `/stop` to cancel work, `/queue resume` to dispatch saved queued tasks, and `/workflow pause ID` to pause one workflow. A running turn is stopped and retained as an interrupted step; `/workflow resume ID` continues unfinished steps and keeps completed work. `/workflow list [active|paused|all]` filters saved workflows, and `/workflow show ID` displays step results and errors. Ordinary follow-ups in a conversation with unfinished workflow tasks are interpreted against the saved assignments.

Plain messages resume dispatch for the current conversation; unrelated paused assignments stay paused. Individual Chat continues to address the selected teammate. Messages entered in Activity use the current Crew Chat. Slash commands remain available as explicit overrides; `/workflow retry ID` deliberately restarts the entire workflow.

New workflows keep one lead responsible for delivery. The lead inspects current artifacts, works within its configured role and access, and chooses one next action at a time: a bounded specialist assignment, independent review, a material question, delivery, or an evidenced external blocker. A read-only lead delegates edits to an existing writer. Crew Chat continues to show real member replies; individual chats remain available. Each workflow has persistent member sessions, isolated from private chat sessions, and retains roles, models, permissions, repository skills, project memory, findings, and user answers across restarts. `/workflow resume ID` continues unfinished work without replaying completed assignments.

Codex investigates failures within the working session first. If a specialist turn ends blocked, it receives an in-session continuation with the original permissions before returning findings to the lead. New direct chat tasks also continue in their own session, without a separate read-only recovery assessment. Repeated delegation or retries without new command, tool, change, or acceptance evidence stop with an incomplete report. All dispatched workflow turns count toward an overall budget of 64 model calls, including lead decisions, workers, and reviews. This bounds wrapper calls, not tokens, money, or native tool calls within a turn. Inspect usage with `/workflow show ID`; set a total with `/workflow budget ID TURNS` (up to 1,000), then explicitly resume stopped work. Older saved workflows adopt the lead engine when explicitly resumed or recovered: completed results and artifacts stay intact, and the lead reassesses unfinished work instead of replaying the old pipeline. Completed histories and explicitly legacy workflows remain readable and compatible.

Delivery requires independent inspection of the actual user requirements. General limitations belong in the review summary; they do not become invented acceptance criteria. Missing requirements return to the lead for a specific correction; unavailable required verification remains explicitly incomplete. Publishing and other external actions still require the user's explicit instruction.

Reviews return limitations separately from required acceptance criteria. Checks the user expressly permits to remain unverified are disclosed in the final delivery; turning questions off does not waive other requirements. After two repeated reviews without fewer unresolved required checks, execution stops with the outstanding findings. Rephrased requirements, fresh diagnostic output and rewritten notes cannot reset that acceptance-progress guard.

Shift+Right opens a dedicated question section with a live **Your response** draft. Enter or Shift+Left submits the answer. Answered questions and responses remain visible in the relevant private or crew chat, including while the queue is paused and after restart.

To ask a question of only one teammate, start the message with `@NAME`:

```text
@chief What will be the approach in a simple manner?
```

`@developer Replace Show and Hide with Show summary and Hide summary.` queues one Developer turn with write access. `@developer Commit and push.` uses the same direct path. Enter and Shift+Left use the same delivery. A mention does not change the recipient's configured access.

Ordinary messages request one recipient's reply. Use `@NAME` to address a teammate, or `/discuss` to request replies from the crew. `/discuss` explicitly schedules two rounds and a lead summary.

Crew Chat and individual chats use separate sessions. A teammate's individual chat does not automatically receive what they just discussed in Crew Chat. Continue with `@NAME` in Crew Chat when you want them to use that discussion, or include the relevant details in their individual chat. Use `/crew-task` to start a workflow from the saved discussion.

### Optional `/task` and `/crew-task` overrides

You can ask a teammate for work in ordinary language within their configured access. Use `/task` or `/crew-task` when you want coordinated planning, implementation, and independent review.

| Command or request  | Goal                                              | Crew Chat context                                   | Requirement                                                                   | Opens after starting                                           | Sample usage                                            |
| ------------------- | ------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `/task GOAL`        | Required                                          | Included when run from Crew Chat; otherwise omitted | No discussion required                                                        | Crew Chat when started there; otherwise lead's individual Chat | `/task Add filters and ask Reviewer to check them.`     |
| `/crew-task [GOAL]` | Optional; without one, implements the agreed plan | Always uses the latest discussion, from any view    | A saved Crew Chat discussion; any active discussion must finish or be stopped | Crew Chat                                                      | `/crew-task` or `/crew-task Implement the agreed plan.` |

These optional overrides create a coordinated workflow in which the lead selects bounded work, requests independent review, and delivers the verified result. Use `/task` for a standalone goal and `/crew-task` to carry the current Crew Chat discussion into implementation. Lead decisions and live teammate replies appear in the originating Crew Chat. Future assignments and task records appear in Activity.

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

### Reports, search, usage, and task templates

Use `/workflow report ID` for finished assignments, current work, blockers, review evidence, and the next action. `/workflow criteria ID` shows each saved requirement, its pass/fail/unverified status, and the review evidence. Execution progress and acceptance are shown separately; older workflows without criteria remain explicitly unverified. `/queue show ID` and `/workflow show ID` also include continuation guidance.

`/search TEXT` searches this project's saved private chats, named and archived conversations, recoverable archives, discussions, workflow requirements, task results, and project memory. Search is literal and case insensitive. Results include record IDs and short excerpts, stop after 40 matches, and never call a model. Narrow the query if results are truncated. Use `/conversation open ID`, `/queue show ID`, `/workflow show ID`, `/archives`, or `/memory show` to inspect the full source.

`/usage` shows project totals, including routing and direct chat; `/usage WORKFLOW_ID` shows only that workflow's assignment turns. Usage is saved for future turns when Codex reports input, cached input, and output tokens. Cached input is already included in input tokens. Missing and older usage is unavailable, not estimated. Cumulative turn time includes failed attempts and can overlap during parallel execution. Workflow model-turn budgets remain separate from token totals and do not impose a spending limit.

```text
/template save fix Investigate {{goal}}, implement the correction, and request independent review.
/template run fix Keyboard navigation skips the last item
/template list
/template show fix
/template delete fix
```

Templates are project specific and survive restart. Save up to 50 named templates, each up to 8,000 characters. Names start with a lowercase letter and contain lowercase letters, digits, or hyphens. Existing names must be explicitly deleted before replacement. `{{goal}}` inserts the run goal literally; without it, the goal is appended. Expanded instructions are limited to 16,000 characters. Running a template follows `/task` coordination and permissions, including the current Crew Chat context.

`/commands [QUERY]` opens a command picker. Type to filter descriptions, use Up/Down to select, and press Enter to fill the prompt. Supply arguments before sending the command. Tab completes saved workflow/task/conversation IDs and template names where supported. Activity now keeps dispatch status, waiting counts, and the latest workflow's next step visible while showing live actions. Unchanged Activity events reuse rendered rows.

`/worktree review ID` previews an isolated workflow against the current project HEAD. It shows commits ahead/behind, tracked change statistics, local status in both workspaces, overlapping files, and saved acceptance. It does not merge or modify either branch. Uncommitted and untracked files do not participate in a branch merge. This is a readiness preview using file overlap, not a merge simulation or a guarantee of a conflict-free merge. Use `/worktree show ID` for the tracked diff and inspect untracked files separately.

### Video clipping crew

Use `/preset show clipper` to preview or `/preset apply clipper` to select the Facebook and YouTube video crew. Video-producer coordinates Footage-analyst, Video-editor, Captioner, Copywriter, and a read-only Video-reviewer.

Place your video in the project folder and supply its path. For example:

```text
/preset apply clipper
/task Review "media/interview.mp4", pick three self-contained highlights, edit vertical clips for YouTube Shorts and Facebook Reels, add accurate English subtitles, and draft platform-specific titles, post captions, and descriptions. Save exports and subtitle files under "output/interview/" and have Video-reviewer check them. Do not publish.
```

This preset supplies specialist instructions, not an upload interface or bundled video tools. Actual inspection, transcription, and rendering depend on tools available to Codex in your environment, such as FFmpeg and a transcription tool. The crew checks availability and reports blockers or unrendered edit plans when production is unavailable. Source files stay intact; publishing requires an explicit request and available account integration.

## Keyboard controls

Rotating tips appear below the command/status line every 30 seconds while the CLI is open. They include project briefings, watch settings and inbox, recurring inspections, review evidence, and command discovery. Use `/help briefing`, `/help watch`, or `/commands watch` to find the related commands immediately.

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

### Project briefings and proactive watch

Use `/briefing` for questions, ongoing workflows, results from the last 24 hours, and enabled recurring checks. It shows recovery commands and distinguishes independently accepted workflows from unverified results. It reads saved Crew state without calling a model or inspecting project files and external services.

Enable `/watch on 09:00` for a daily briefing and alerts when a question, stopped assignment, or finished result appears. Times use the machine's local timezone. Alerts appear in the terminal notice and Activity; `/watch inbox` retains the latest 50 notifications across restarts, including daily briefing snapshots. Existing completions are skipped when enabling watch; pending questions and failures can still alert. Watch tracks the latest 100 outstanding signals and 100 completions separately, so finished history cannot hide questions. The briefing shows up to 10 entries per section.

`/watch status` shows settings, `/watch clear` clears saved notifications, and `/watch off` disables alerts and daily briefings. Watch never resumes paused work, retries assignments, or grants permissions. Clearing the inbox does not repeat unchanged alerts. After a missed briefing time, the next running check creates one briefing for the current day; missed days are not replayed.

For actual recurring project inspections, use the existing scheduler:

```text
/schedule add 60 researcher Inspect project health and report actionable findings. Do not edit files.
```

Scheduled inspections make model calls under their configured access. Watch itself makes none. Disabling watch leaves schedules enabled; manage them with `/schedule pause ID`. Keep the app or `node src/cli.js --folder PROJECT_PATH --worker` running. The worker prints notifications and saves them for `/watch inbox`; the folder lock permits one app or worker per project. Work stops while the machine is off. Remote delivery, operating-system push notifications, and cloud hosting are not included.

### Models and records

Use `/model` to inspect model settings, `/memory add TEXT` to save project guidance, and `/schedule` for recurring checks. Routing and shared discussion prompts use recent bounded context while preserving the latest user request. Full saved history remains available; `/context on` additionally clips optional handoff and recovered-chat context. When application source changes during a session, a persistent restart notice identifies that the running process still uses its loaded code.

Markdown exports use UTF-8 and are written when work finishes: one file per workflow or discussion, plus one per standalone task. Workflow steps and discussion turns do not create separate files. To consolidate older task exports or repair encoding, enable `/markdown on` and run `/markdown refresh`. It saves combined documents before removing their owned task duplicates; unrelated files and saved history are preserved. On Linux, the export directory is restricted to its owner and export files use owner-only permissions. On Windows, exports follow inherited ACLs; review them before enabling exports in a shared folder.

Project state lives in `<target-folder>/.pongkan-crew/`. Add `.pongkan-crew/` to your project's `.gitignore` and keep it private. `/markdown on` exports finished work to `docs/pongkan-docs/`; it defaults to off. Live progress remains in the app, and export files are not automatically added to model context. Crew Chat exports retain submission metadata.

Writers can edit project files. Planning, discussions, and reviews are read-only. Keep changes in version control and read the [security boundaries](SECURITY.md).

### Codex permission modes

Use `/permissions [NAME]` to choose a teammate's mode, or `/permissions MODE [NAME]` to set one directly (`ask`, `approve`, `full`, or `read-only`). These modes configure the Codex CLI sandbox and approval behavior; they do not change Windows account permissions. The teammate's Crew role still applies, so a read-only teammate cannot write even when another mode is selected.

- **Ask for approval** keeps workspace writes inside the workspace sandbox and requests approval for eligible access outside it. Crew runs Codex noninteractively, so requests that need a live user prompt may stop without being approved.
- **Approve for me** uses Codex's native `--approve-for-me` option for workspace-write sandboxing and automatic review of eligible requests, including fresh and resumed turns. Node/npm sandbox failures trigger a scoped execution-tool approval request rather than a chat permission question. It does not grant unrestricted filesystem access.
- **Full Access** removes Codex's filesystem sandbox and runs without approval. Use only when you intend to allow access beyond the project workspace.
- **Read Only** blocks edits and access escalation.

## Troubleshooting

Recovery runs automatically during active workflows. `/recovery [WORKFLOW_ID]` remains a manual override for a stopped workflow after external conditions change, or for interrupted saved work. It preserves completed steps and permissions and keeps unrelated paused tasks paused. Paused and cancelled work is never silently restarted.

For startup, login, blocked workflows, permissions, saved state, worktrees, schedules, exports, and terminal issues, see the [Crew troubleshooting guide](docs/WORKFLOW_TROUBLESHOOTING.md).

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
