# Pongkan Crew input and command reference

## Project briefings and proactive watch

`/briefing` reads saved Crew state locally: questions needing answers, ongoing workflows, results from the last 24 hours, and enabled recurring checks. It includes next commands and marks results without independent acceptance as unverified. It makes no model call and does not inspect source files or external services.

Enter these commands separately:

```text
/briefing
/watch on 09:00
/watch status
/watch inbox
```

Watch starts off for each project. `/watch on` uses the saved daily time, initially 09:00; `/watch on HH:MM` changes it using 24-hour machine local time. While enabled, watch saves a daily briefing snapshot and alerts about questions, stopped work, and finished results. A missed daily time produces one briefing on the next running check for that day. Missed days are not replayed. Existing completions are skipped when enabling watch; outstanding questions and failures can still alert.

Alerts appear in the terminal notice and Activity. `/watch inbox` reads the latest 50 notifications across restarts, newest first. Watch tracks the latest 100 outstanding signals and 100 completions separately; briefings show up to 10 items per section. `/watch clear` clears saved notifications without repeating unchanged alerts. `/watch off` disables alerts and daily briefings, retaining the inbox and chosen time. It does not disable recurring schedules.

Keep the app or `node src/cli.js --folder PROJECT_PATH --worker` running with the machine on. The worker prints new notifications and saves them in the same inbox; only one app or worker can own a project's folder lock. Watch never resumes paused work, retries assignments, grants permissions, or makes model calls. For recurring source inspections, use `/schedule add MINUTES NAME GOAL`; those assignments use Codex and its configured access. Use `/schedule pause ID` to stop an inspection schedule.

Watch records live in private `.pongkan-crew/state.json`. Briefings and alerts do not create Markdown export files; scheduled standalone results follow the normal `/markdown` settings. See [troubleshooting](WORKFLOW_TROUBLESHOOTING.md#briefings-and-watch-notifications) for missing alerts and [upgrading](UPGRADING.md#project-briefings-and-watch-settings) for saved settings.

## Reports, search, usage, and reusable tasks

| Command                    | Purpose                                                                  | Example                                                                |
| -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `/workflow report ID`      | Finished work, active assignments, blockers, acceptance, and next action | `/workflow report 08d7f22f`                                            |
| `/workflow criteria ID`    | Requirements, status, and review evidence                                | `/workflow criteria 08d7f22f`                                          |
| `/search TEXT`             | Search saved history and project memory                                  | `/search keyboard navigation`                                          |
| `/usage [WORKFLOW_ID]`     | Reported tokens, measured turns, and cumulative turn time                | `/usage`                                                               |
| `/template list`           | List saved task instructions                                             | `/template list`                                                       |
| `/template save NAME TEXT` | Save instructions, optionally using `{{goal}}`                           | `/template save fix Investigate {{goal}}, fix it, and request review.` |
| `/template show NAME`      | Read full saved instructions                                             | `/template show fix`                                                   |
| `/template run NAME GOAL`  | Start a workflow with saved instructions                                 | `/template run fix keyboard navigation`                                |
| `/template delete NAME`    | Explicitly remove saved instructions                                     | `/template delete fix`                                                 |
| `/worktree review ID`      | Preview readiness against the current project HEAD                       | `/worktree review 08d7f22f`                                            |
| `/commands [QUERY]`        | Search descriptions and fill the prompt with a command                   | `/commands reported tokens`                                            |

Replace example IDs with IDs from `/workflow list`. Reports distinguish execution progress from independent acceptance. Invalidated criteria remain historical until reviewed again; missing criteria remain explicitly unverified. Task and workflow detail panels include continuation guidance.

Search is literal and case insensitive. It covers saved private chats, named and archived conversations, recoverable archives, discussions, workflow requirements, task results/errors, and project memory. It stops after 40 matches with IDs and short excerpts. Narrow the query for more specific results. It does not call a model or search source files.

Project usage includes routing and direct chat; workflow usage includes only its assignment turns. Totals cover newly measured turns; older and unreported tokens are unavailable. Cached input is included in input tokens. Cumulative turn time includes failed attempts and can overlap across parallel turns. Usage is not a cost estimate or spending limit; model-turn budgets keep their current behavior.

Templates persist per project: at most 50 entries, each up to 8,000 characters. Names begin with a lowercase letter and contain lowercase letters, digits, or hyphens, up to 32 characters. Existing names require explicit deletion before replacement. `{{goal}}` inserts the run goal literally; otherwise the goal is appended. Expanded instructions are limited to 16,000 characters. Runs follow `/task` coordination, permissions, and current Crew Chat context.

In the picker, type or paste to filter, use Up/Down to select, and press Enter to fill the prompt. Supply arguments before sending. Tab completes supported saved workflow/task/conversation IDs and template names. Activity keeps dispatch status, waiting counts, and the latest workflow's next action visible alongside live actions.

Worktree review shows commits ahead/behind, status in both workspaces, tracked change statistics, overlapping files, and saved acceptance. It never merges branches. Uncommitted/untracked files are excluded from branch merges; inspect them separately. File overlap is a readiness hint, not a merge simulation or conflict-free guarantee. Use `/worktree show ID` for the tracked diff.

## Markdown saving

`/markdown on` enables exports of finished work and creates `docs/pongkan-docs/` in the selected project. `/markdown off` stops subsequent exports without deleting documents. `/markdown` reports the mode and destination. The setting persists per project and defaults to off.

Exports use UTF-8, including smart punctuation and multilingual text. `/markdown refresh` regenerates finished exports from saved history while saving is on. It also consolidates older per-task workflow/discussion exports: after the combined document is safely written, it removes matching task files bearing the app's ownership marker. Unrelated files, redirected paths, and hard-linked files are preserved. Refresh reports written/failed counts; failures appear in Activity. It preserves source history and can repair files affected by an older encoding bug.

Each finished workflow saves one `workflow-<id>.md` containing its assignments, teammate results, review, and summary. Each finished discussion saves one `discussion-<id>.md`; its individual turns do not create separate task files. Standalone tasks save as `task-<id>.md`. Running, queued, and waiting work is not exported. Completed, failed, cancelled, and interrupted work is exported after its task turns settle, preserving partial findings and errors. Discussion follow-ups normally create a new discussion ID with copied history. Workflow resume retains the existing record IDs; explicit workflow retries create separate IDs.

Exports include full saved responses, prompts, clarification answers, changed-file names, and speaker labels. Discussion exports retain Enter versus Shift+Left submission metadata and group replies with their original prompt. Live progress remains in Chat, Crew Chat, and Activity instead of being repeatedly written to Markdown. Enabling does not backfill unchanged history; use refresh for that. Export files are not automatically included in model context.

Safe writing uses a PowerShell/.NET directory-lock helper on Windows and directory descriptors on Linux with `/proc/self/fd`. Other platforms currently report an unsupported-platform error when saving is enabled.

[README](../README.md) · [Todo website walkthrough](TODO_WEBSITE_WALKTHROUGH.md)

Type normally **inside Pongkan Crew** and press Enter. Slash commands are optional overrides for explicit control. When using them, enter one command at a time, use names from your roster, and replace uppercase placeholders with values shown by the app. `[Arguments]` are optional; omit the brackets.

## Plain messages

| Where you type        | Who receives your message                          |
| --------------------- | -------------------------------------------------- |
| Crew Chat or Activity | The designated lead                                |
| Individual Chat       | The selected teammate                              |
| `@NAME MESSAGE`       | The named teammate, using shared Crew Chat context |

Plain messages go directly to the selected teammate in Individual Chat, or to the designated lead in Crew Chat and Activity. When the current conversation has unfinished workflow tasks, follow-ups are interpreted against those assignments and can resume or correct existing work. Routing uses saved conversation and task state, not phrase matching. Use @NAME to preserve an explicit recipient. Use /task or /crew-task to start a new coordinated workflow and /discuss for collective replies and a lead summary.

Developer retains write access for questions and authorized actions alike. Reviewer remains read-only. Follow-ups use the conversation context and queue after active shared turns. `@developer Commit and push.` uses the same path as any other request; the worker checks actual Git access when executing.

Use `/discuss TOPIC` for team discussion, `/task GOAL` or `/crew-task GOAL` for explicit coordinated execution, `/answer TASK_ID TEXT` for a saved waiting assignment, and `/stop` to cancel. With no unfinished workflow in context, plain messages stay with the recipient. With unfinished tasks, the router uses the message and saved context to decide whether to continue existing work or reply conversationally.

### Optional execution overrides

`/crew-task [GOAL]` explicitly uses the latest Crew Chat as context from any tab. Without a goal, it asks the lead to implement the agreed plan; with a goal, it uses that instruction plus the discussion. This command requires a nonempty, inactive Crew Chat; unlike a plain execution request, it reports an error while discussion is active. `/task GOAL` includes Crew Chat history and stays there when started from Crew Chat; otherwise it opens the lead's individual Chat. Both commands remain available.

## Chat, assignments, and discussions

### Workflow handoffs and completion

Directed messages queue one turn for the named teammate with their configured access. Unknown names fail before dispatch. Enter and Shift+Left use the same direct delivery.

Existing workflows remain explicit saved records. Ordinary sends do not create another workflow when unfinished work is already associated with the current conversation; semantic routing can continue the existing graph while preserving completed tasks.

Crew Chat keeps shared messages and results together. Messages sent during an active shared turn are saved immediately and queued after earlier turns.

New workflows use a persistent lead that chooses one next action at a time. It may work within its own access, delegate a bounded task, request independent review, ask a material question, or deliver after the requested outcome is verified. Later turns receive previous completed workflow results, available changed-file names, and clarification answers. This is a handoff: findings and next steps passed between teammates, rather than access to all their conversations. Long supplied context can be shortened; inspect full saved results when a detail matters. Older unmarked workflows adopt the lead engine when resumed or recovered; records explicitly marked legacy keep their original pipeline.

New workflows use a persistent lead for both standalone requests and Crew Chat. It chooses one bounded action at a time and uses independent review to verify the requested outcome; actual teammate replies remain visible in Crew Chat. Explicit legacy workflows retain the briefing, implementation, feedback, and final-review sequence. Independent eligible tasks can run through the scheduler.

Corrections are queued for the next task boundary. New lead workflows complete after an independent review verifies the requested outcome; failed requirements or unavailable required checks remain visible. Older legacy workflows can retain their previous completion behavior, so inspect their findings. Stop/cancel preserves edits. `/workflow resume ID` continues unfinished lead work without replaying completed assignments; `/workflow retry ID` creates a new attempt.

### Explicit sharing from individual Chat

`/share NAME [REQUEST]` copies the selected individual chat's latest completed user/assistant exchange into a new named Crew Chat for the selected teammate and NAME. For example, from Developer's Chat use `/share reviewer Review keyboard support`. Both teammates discuss the request read-only; their replies and participant names appear in Crew Chat. Follow-ups keep the same participants. Use `/conversation list` and `/conversation open ID` to return to the shared chat later.

Sharing requires a completed reply and another existing teammate. A running, queued, or unanswered private turn must finish first. Only the latest exchange is shared, including its full text; older exchanges and other private chats are not imported. An ordinary mention or a teammate suggesting collaboration does not trigger sharing. `/handoff NAME [TASK]` continues to send a direct assignment rather than open a shared conversation.

Use `/crew-task [GOAL]` after the discussion finishes to explicitly execute with the shared findings. Plain approvals go directly to the recipient and do not start workflows. `/crew-task --isolated [GOAL]` also carries that context into a separate Git worktree. Execution may involve additional crew specialists beyond the discussion participants.

| Command                          | Purpose                                                                       | Sample usage                                                             |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/chat [NAME]`                   | Open Chat and optionally select a teammate                                    | `/chat chief`                                                            |
| `/crew chat NAME`                | Alias for selecting a teammate's Chat                                         | `/crew chat developer`                                                   |
| `/personality`                   | List chat styles and each teammate's current style                            | `/personality`                                                           |
| `/personality [NAME\|all] STYLE` | Change the selected teammate, a named teammate, or the whole crew's chat tone | `/personality developer jokester`                                        |
| `/personality reset [NAME]`      | Restore neutral style for a teammate or the selected teammate                 | `/personality reset`                                                     |
| `/next`                          | Cycle forward through teammates and Crew Chat                                 | `/next`                                                                  |
| `/prev`                          | Cycle backward through teammates and Crew Chat                                | `/prev`                                                                  |
| `/task TEXT`                     | Lead coordinates bounded work and independent review until delivery           | `/task Add todo filters, verify them, and review the changes.`           |
| `/send NAME TEXT`                | Queue a direct assignment without changing selection                          | `/send developer Fix the remaining count.`                               |
| `/handoff NAME [TASK]`           | Pass the selected teammate's latest assistant answer to another teammate      | `/handoff reviewer Review the implementation against the requirements.`  |
| `/retry`                         | Resend the selected teammate's latest direct user message                     | `/retry`                                                                 |
| `/discuss TOPIC`                 | Start two read-only rounds with the crew, then a lead summary                 | `/discuss Plan keyboard navigation for our todo app. Do not edit files.` |
| `/group`                         | Open the latest shared Crew Chat                                              | `/group`                                                                 |
| `@NAME MESSAGE`                  | Send directly with shared context and the teammate's configured access        | `@developer How will you preserve invalid stored data?`                  |

Use `/task` or `/crew-task` to request coordinated work and independent review. Plain Crew Chat messages and mentions request one direct turn with the recipient's configured access. Direct tasks are independent; `/discuss` turns are read-only. Crew Chat shows actual teammate replies and current progress with speaker labels; future assignments stay in Activity. Task and workflow detail panels render Markdown, including links and code blocks. Raw task records remain available through `/queue show ID`.

New workflows started from Crew Chat keep real member replies in that conversation while a persistent lead selects one action at a time. The lead may delegate bounded work, request read-only independent review, or return to a worker with specific findings. Execution sessions stay separate from personal chats. Shared discussion and direct message prompts use bounded recent context, preserving the latest user request; full saved history remains available. Use `/context on` to additionally shorten optional handoff context. Every new lead workflow requires an independent `met` outcome before completion; a passing report without recorded reviewer inspection stays unverified. Explicit legacy workflows may show briefings, reviewer feedback, and worker responses before their final report. Older unmarked workflows adopt the lead engine when resumed or recovered. Use `/stop` in Crew Chat to cancel its discussion and associated workflows. `/stop all` and `/workflow cancel ID` remain explicit overrides.

## Conversations, isolated work, and automation

| Command                                       | Behavior                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/conversation new NAME TITLE`                | New independent individual chat; running chats continue                                      |
| `/conversation new group TITLE`               | New independent shared chat                                                                  |
| `/conversation list`                          | IDs, names, and archived conversations                                                       |
| `/conversation open ID`                       | Select a saved chat with its own history/session                                             |
| `/conversation archive ID`                    | Keep history, hide from active selection; requires inactive work and paused linked schedules |
| `/conversation restore ID`                    | Make an archived chat available again                                                        |
| `/conversation default [NAME\|group]`         | Return to original individual/shared history                                                 |
| `/task --isolated GOAL`                       | Workflow in a fresh Git worktree with separate teammate sessions                             |
| `/crew-task --isolated [GOAL]`                | Same isolation, using the selected Crew Chat plan                                            |
| `/worktree list`                              | Retained branches, folders, and chat IDs                                                     |
| `/worktree show WORKFLOW_ID`                  | Git status and tracked working changes                                                       |
| `/memory show`                                | Editable memory file and saved decision IDs                                                  |
| `/memory add TEXT`                            | Save a project decision; duplicate text is reused                                            |
| `/memory remove ID`                           | Remove a saved decision                                                                      |
| `/steer TASK_OR_WORKFLOW_ID TEXT`             | Apply a correction at the next task boundary                                                 |
| `/briefing`                                   | Local summary of questions, workflows, recent results, and recurring checks                  |
| `/watch on [HH:MM]`                           | Enable alerts and daily briefing; default 09:00 in machine local time                        |
| `/watch off`                                  | Disable alerts and daily briefing; schedules retain their enabled settings                   |
| `/watch status`                               | Show settings and background requirements (also the default `/watch` action)                 |
| `/watch inbox`                                | Read the latest 50 saved alerts and daily briefing snapshots                                 |
| `/watch clear`                                | Clear notifications without repeating unchanged alerts                                       |
| `/schedule add MINUTES NAME GOAL`             | Recurring read-only task in a dedicated conversation                                         |
| `/schedule add MINUTES NAME --write GOAL`     | Recurring task with that member's normal access                                              |
| `/schedule list`                              | Intervals, next runs, and enabled state                                                      |
| `/schedule pause ID` / `/schedule resume ID`  | Disable or enable automatic runs                                                             |
| `/schedule run ID`                            | Dispatch now if the queue is unpaused and no prior run is pending                            |
| `/github issue OWNER/REPO NUMBER`             | Read an issue using authenticated `gh`                                                       |
| `/github pr OWNER/REPO NUMBER`                | Read a PR's title/body/status                                                                |
| `/github task OWNER/REPO NUMBER [--isolated]` | Create local work from an issue; no GitHub writes                                            |

Worktrees require a committed repository root and clean tracked files, start from `HEAD`, and do not copy untracked setup or dependencies. One writer runs per workspace; separate worktrees can run concurrently. Retain/review the branches and explicitly commit/merge with Git. `/workflow show ID` links teammate chats. Crew Chat shows workflows linked to its discussion or named conversation. Named chats preserve context and task destinations when switching. `/new` opens a blank named chat; `/clear` applies only to legacy individual chats.

Memory lives in `.pongkan-crew/project-memory.json` (up to 50 entries, 2,000 characters each, 40 KB total). It is user-maintained guidance, not extra authority. Steering does not interrupt commands: running tasks continue with corrections after the current turn, queued tasks receive them when dispatched, and workflow guidance carries forward. `/queue show ID` includes delivery timestamps. Waiting questions still require `/answer`.

Schedules run inside the open app or a headless process: `node src/cli.js --folder PROJECT_PATH --worker`. Add `--once` for a periodic Windows Task Scheduler invocation: due jobs are dispatched once, active turns finish, and the process exits. A persistent worker can be launched by Task Scheduler to survive closing CMD; no system task is installed automatically. Use absolute executable/script/project paths. The folder lock prevents running the interactive app and worker on the same state simultaneously. Keep the machine on; inspect and recover paused/interrupted work explicitly. Missed intervals coalesce and a schedule never overlaps its prior pending task. Human approval/clarification still requires interactive attention. GitHub integration requires an installed, authenticated GitHub CLI.

You can request execution before or after the discussion finishes. During execution, corrections steer the current workflow instead of creating another one; status questions stay in discussion. `@NAME` remains an explicit request for a read-only discussion reply.

Individual follow-ups include saved history even when resuming a Codex session. `/context on` can shorten assistant history; `/context off` sends saved history without local clipping. Discussion sessions remain separate from individual sessions.

### Sample: meet your crew

Paste this as one message to introduce the current roster in Crew Chat:

```text
/discuss Everyone in the current crew, introduce yourself. State your name, role, main responsibilities, current file access, and how you collaborate with the other teammates. Explain which tasks I should assign to you and give one short example. Cover every role in the current roster; do not invent absent teammates. Keep introductions concise and do not modify files. Lead: finish with a brief guide to who handles what.
```

Enter this `/discuss` command in Crew Chat. It works with default and custom crews. Introductions are read-only; the lead summarizes who handles what. If dispatch is paused, use `/queue resume` to start the discussion.

## Questions and autonomy

| Command                | Purpose                                                              | Sample usage                                              |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `/questions`           | Show question mode and waiting questions                             | `/questions`                                              |
| `/questions list`      | Show pending questions with task IDs and reply instructions          | `/questions list`                                         |
| `/questions on`        | Allow material clarification questions in future work turns; default | `/questions on`                                           |
| `/questions off`       | Let AI decide routine choices within the task and report assumptions | `/questions off`                                          |
| `/answer TASK_ID TEXT` | Save your answer and continue the same waiting assignment            | `/answer TASK_ID Use a compact list with inline editing.` |

Question mode is saved per folder and affects future private assignments and workflow work turns. Use `/answer TASK_ID TEXT` for an assignment shown as waiting, or Shift+Right to fill in that command. Waiting blocks dependent work and that teammate's other tasks; independent teammates can continue. `/answer` queues the answer if global dispatch is paused; `/queue resume` releases it. Ordinary replies are delivered as new messages and do not automatically answer saved waiting tasks. Shared discussions and lead planning do not use this question protocol.

Routing clarifications also support Shift+Right: it fills `/answer REQUEST_ID ` for a question in the current conversation and preserves your draft. Type your answer, then press Enter or Shift+Left to submit it. Press Shift+Right again to cycle waiting questions. The reply is interpreted with its original request and exact clarification question; an ambiguous answer may need a focused follow-up. The question appears once under a capitalized Question heading with the keyboard hints, and answered requests retain their history.

Questions off does not bypass permissions. Teammates can use existing approvals or request automatically reviewed, command-specific escalation. Denied/unavailable actions remain blockers. An explicit blocker signal fails the task and cancels dependent work; prose alone does not.

## Stop and cancel

| Command                        | Purpose                                                              | Sample usage                   |
| ------------------------------ | -------------------------------------------------------------------- | ------------------------------ |
| `/stop`                        | Stop selected work; in Crew Chat, stop its discussion and workflows  | `/stop`                        |
| `/stop NAME`                   | Stop a named teammate's active task                                  | `/stop developer`              |
| `/stop all`                    | Pause dispatch and cancel all queued, waiting, and running work      | `/stop all`                    |
| `/queue cancel TASK_ID`        | Cancel a queued, waiting, or running task                            | `/queue cancel TASK_ID`        |
| `/workflow cancel WORKFLOW_ID` | Cancel a workflow and its remaining assignments                      | `/workflow cancel WORKFLOW_ID` |
| `/restart`                     | Stop active work, release the folder lock, and reload Crew from disk | `/restart`                     |
| `/quit` or `/exit`             | Stop active work and exit the CLI                                    | `/quit`                        |

Stopping preserves edits. `/stop` cancels the current shared discussion and its workflows in Crew Chat or Activity; in private Chat it targets the selected teammate's active task. `/stop NAME` targets a named teammate, and `/stop all` pauses dispatch and cancels all unfinished work. Use `/workflow resume ID` to continue an unfinished workflow or `/queue retry ID` for a finished standalone assignment. Plain `stop` and `continue` are messages to the recipient AI. `/queue resume` releases all eligible queued assignments, including those left paused by scoped recovery.

## Tasks and workflow history

`/recovery [WORKFLOW_ID]` requests fresh diagnosis and repair of an unfinished workflow. Without an ID, it selects the latest unfinished workflow associated with the current shared conversation (Crew Chat/Activity) or selected private conversation (Chat). It refuses completed or active workflows. Use `/workflow list` and supply an ID if no workflow matches.

During an active workflow, recovery runs automatically; this command is a manual override after a stopped workflow's external conditions change or for interrupted saved work. It renews the recovery budget, retires unfinished obsolete recovery branches, and reconnects original assignments before diagnosis. Completed steps and findings are retained, and unrelated paused tasks stay paused. The coordinator can request a read-only investigation, retry with a concrete alternative, or assign prerequisite implementation to an existing writer within an already writable workflow. Waiting questions still need `/answer`. The command does not change permissions or guarantee that external failures can be repaired.

| Command                                    | Purpose                                                                | Sample usage                   |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------ |
| `/queue` or `/queue list`                  | List task IDs, statuses, and dispatch state from the newest entries    | `/queue list`                  |
| `/queue show TASK_ID`                      | Read prompt, result, error, dependency, and timing                     | `/queue show TASK_ID`          |
| `/queue pause`                             | Stop new dispatch while active work continues                          | `/queue pause`                 |
| `/queue resume`                            | Resume dispatch of eligible queued tasks                               | `/queue resume`                |
| `/queue move TASK_ID POSITION`             | Move a queued task to a one-based queue position                       | `/queue move TASK_ID 1`        |
| `/queue retry TASK_ID`                     | Create a retry of a finished standalone task                           | `/queue retry TASK_ID`         |
| `/workflow list [STATUS]`                  | List workflows with step counts; filter active, paused, or all         | `/workflow list paused`        |
| `/workflow show WORKFLOW_ID`               | Inspect goal, progress, model-turn usage, results, summary, and errors | `/workflow show 1a2b3c4d`      |
| `/workflow budget WORKFLOW_ID TOTAL_TURNS` | Set a lead workflow's total model-turn budget (up to 1,000)            | `/workflow budget 1a2b3c4d 96` |
| `/workflow pause WORKFLOW_ID`              | Pause one workflow after stopping its active turn                      | `/workflow pause 1a2b3c4d`     |
| `/workflow resume WORKFLOW_ID`             | Continue unfinished steps, preserving completed assignments            | `/workflow resume 1a2b3c4d`    |
| `/workflow retry WORKFLOW_ID`              | Start a new attempt at a finished/interrupted workflow                 | `/workflow retry WORKFLOW_ID`  |

Moving tasks respects dependencies and the single-writer rule. After failure or restart, inspect the task and workflow records. `/workflow resume ID` continues unfinished lead work with existing artifacts and completed assignments; completed work is not replayed, and unrelated paused assignments remain paused. `/workflow budget ID TOTAL_TURNS` sets the overall model-call budget for a lead workflow, from current usage up to 1,000; the default is 64. It limits wrapper turns, not tokens, money, or native tool calls within a turn. Increasing a budget does not resume stopped work; resume explicitly afterward. A paused workflow stays paused across app restarts. Pausing stops an active turn and preserves its partial result as an interrupted step for continuation. A partially completed failed assignment continues from its existing files and findings. Restart an interrupted discussion with `/discuss TOPIC` or a new direct message.

`/workflow retry ID` deliberately starts a new workflow and may repeat completed edits; `/queue retry ID` creates a new standalone task. These retries differ from `/workflow resume ID`. Saved work starts paused after restart; `/queue resume` releases eligible queued tasks, while workflow resume releases only that workflow. New lead workflows require an independent `met` outcome before delivery; failed required criteria return to the lead for more work, and unavailable checks remain unverified. Older legacy workflows and read-only discussion records retain their existing review behavior; inspect their reports to assess delivery.

Workflow `PONGKAN_BLOCKED` reports, execution errors, failed prerequisite repairs, and failed outcome verification trigger automatic recovery. The coordinator uses current evidence and prior attempts to choose an investigation, changed approach, or prerequisite repair. A failed repair returns to diagnosis before the original assignment resumes. Failed independent verification returns to repair and reinspection before completion. Malformed planning, recovery, or verification responses receive at most two correction retries. New writer tasks require an existing implementation assignment in the workflow and retain the selected teammate's permission mode. Necessary project-local dependencies may be set up by an authorized writer using the configured approval tool, then functionally tested. Completed assignments are preserved. Two attempts without new command, tool, or file-change evidence stop the loop; a separate twelve-attempt total ceiling bounds cost even when observations keep changing. A coordinator `stop` must include a documented boundary (`approval_denied`, `credentials`, `user_decision`, or `unavailable_access`), evidence, and the minimum user action. Unsupported stops become investigations. Exhausted recovery reports an incomplete outcome rather than directing the user to restart the same loop. Recovery does not change access settings, supply credentials, override approval decisions, publish without authorization, or roll back project files. Paused, cancelled, and interrupted saved work is not silently restarted.

Direct Chat and Crew Chat assignments receive the same evidence-based working guidance. When a direct turn fails or reports `PONGKAN_BLOCKED`, its assigned teammate receives a read-only AI assessment containing the original request, current execution policy, worker findings, command/tool results, and previous attempts. A `retry` decision continues the same task with a changed approach; a documented `stop` identifies the required user action. Unsupported stops become investigations. Read-only assessment access does not change the original assignment's permissions, and recovery cannot increase them. These assessments are internal and do not appear as user messages or assistant replies. Cancellation stops an active assessment. Direct tasks use the same no-progress and total-attempt ceilings as workflows. Ordinary multi-speaker discussions retain their bounded discussion lifecycle. Error-word categories and legacy classification fields do not determine diagnoses or force recovery actions. Fixed signal formats and JSON schemas are application protocols, not error classifiers.

## Views, progress, and changes

| Command                 | Purpose                                                                           | Sample usage          |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------- |
| `/activity` or `/act`   | Open the team's live activity feed                                                | `/activity`           |
| `/switch`               | Cycle Chat → Crew Chat → Activity                                                 | `/switch`             |
| `/switch prev`          | Cycle views backward                                                              | `/switch prev`        |
| `/switch chat`          | Select individual Chat view                                                       | `/switch chat`        |
| `/switch group`         | Select Crew Chat view                                                             | `/switch group`       |
| `/switch activity`      | Select Activity view                                                              | `/switch activity`    |
| `/status`               | Show preset, lead/reviewer, question mode, dispatch, and member status            | `/status`             |
| `/progress [NAME]`      | Inspect current action, elapsed time, files, and errors                           | `/progress developer` |
| `/changes`              | List captured changed files from the latest writer task                           | `/changes`            |
| `/diff` or `/diff last` | View latest writer snapshot; bare `/diff` falls back to Git if no snapshot exists | `/diff last`          |
| `/diff TASK_ID`         | View a particular task's writer snapshot                                          | `/diff TASK_ID`       |
| `/diff git`             | View staged, unstaged, and untracked text changes using Git                       | `/diff git`           |
| `/folder`               | Show the target project folder and state-file location                            | `/folder`             |
| `/doctor`               | Check Codex availability and login                                                | `/doctor`             |
| `/close`                | Close an overlay panel                                                            | `/close`              |

Views keep work running. Diffs are bounded and read-only; snapshots work without Git. Activity shows reported events, not private reasoning or continuous subprocess output.

## Crew members and role catalog

| Command                       | Purpose                                                           | Sample usage                                           |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `/crew list`                  | List current teammates, roles, and access                         | `/crew list`                                           |
| `/crew info [NAME]`           | Inspect role, access, model, status, and direct session           | `/crew info developer`                                 |
| `/roles list [QUERY]`         | Browse or filter reusable roles                                   | `/roles list engineering`                              |
| `/roles show ROLE`            | Read a catalog role's responsibilities and default access         | `/roles show frontend-dev`                             |
| `/crew add NAME [ROLE_TEXT]`  | Add a read-only teammate with optional custom instructions        | `/crew add designer Review layouts and accessibility.` |
| `/crew add NAME --role ROLE`  | Add a catalog specialist with its default access                  | `/crew add frontend --role frontend-dev`               |
| `/crew role NAME ROLE_TEXT`   | Replace role instructions while keeping access                    | `/crew role designer Focus on keyboard navigation.`    |
| `/crew role NAME --role ROLE` | Apply catalog instructions and default access                     | `/crew role designer --role ui-ux-designer`            |
| `/crew access NAME read`      | Set future tasks to read-only access                              | `/crew access designer read`                           |
| `/crew access NAME write`     | Allow future implementation tasks to write in the project         | `/crew access designer write`                          |
| `/permissions [NAME]`         | Choose a Codex permission mode for a teammate                     | `/permissions developer`                               |
| `/permissions MODE [NAME]`    | Set `ask`, `approve`, `full`, or `read-only` for future turns     | `/permissions approve developer`                       |
| `/crew rename NAME NEWNAME`   | Rename a teammate; preserve lead/reviewer routing across restarts | `/crew rename chief boss`                              |
| `/crew remove NAME`           | Archive and remove a non-coordinator; reject extra arguments      | `/crew remove artist`                                  |

Finish/cancel active workflows and affected tasks before changing members. The reviewer stays read-only; coordination members and the last teammate cannot be removed. Writer access does not grant command approvals, and discussions remain read-only.

Codex permission modes control the CLI sandbox and approval behavior, independently of teammate write access. **Ask for approval** uses workspace-write and requests approval for eligible access outside it; Crew's noninteractive runner cannot answer a live user prompt. **Approve for me** uses Codex's native `--approve-for-me` option with workspace-write sandboxing and automatic review in fresh and resumed turns. Workers request scoped Node/npm EPERM retries through the execution tool without asking for permission in chat. **Full Access** removes the sandbox and runs without approval. **Read Only** blocks edits and escalation. A read-only role always overrides a mode that otherwise permits writing. These settings affect future turns.

These protections apply to the default crew as well as applied presets. Renaming `chief` to `boss` keeps `/task` routed to Boss; renaming `reviewer` keeps that teammate designated as the read-only reviewer. Applying a different preset selects its coordinators. `/crew remove artist extra` is invalid and leaves teammates, archives and saved state unchanged. See [upgrading](UPGRADING.md) for older saved crews.

Sidebar names, chat speaker labels and the selected teammate heading capitalize only the first letter (for example, `Chief`, `Developer`, `You` and `System`). Crew Chat speaker names follow the same format. Commands, mentions and saved teammate names continue to use lowercase names such as `/chat chief` and `@developer`.

Crew prompts also request capitalized teammate names in prose, introductions and handoffs. Exact lowercase IDs remain required in commands, mentions and workflow JSON. This affects future generated replies; existing replies and quoted text are preserved.

In Chat and Crew Chat, messages start directly below the speaker's name; blank lines separate messages.

## Presets

| Command                               | Purpose                                                                                            | Sample usage                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/preset list`                        | List built-in and saved teams                                                                      | `/preset list`                                                         |
| `/preset show NAME`                   | Preview members, instructions, access, and coordination                                            | `/preset show web`                                                     |
| `/preset apply NAME`                  | Archive current crew and create fresh preset sessions                                              | `/preset apply default`                                                |
| `/preset save NAME [LEAD REVIEWER]`   | Save current roles/access as a custom preset                                                       | `/preset save my-team chief reviewer`                                  |
| `/preset create NAME [LEAD REVIEWER]` | Capture the current roster as a new custom preset; reject existing names                           | `/preset create studio chief reviewer`                                 |
| `/preset title NAME TEXT`             | Set a custom preset display title (up to 200 characters)                                           | `/preset title studio Accessible design studio`                        |
| `/preset improve MEMBER [GOALS]`      | Queue read-only Codex suggestions for role skills and responsibilities; apply suggestions manually | `/preset improve developer Focus on accessible interfaces and testing` |
| `/preset delete NAME`                 | Delete only a custom preset definition; preserve teammates, conversations, archives and files      | `/preset delete studio`                                                |
| `/preset restore ARCHIVE_ID`          | Restore an archived complete crew                                                                  | `/preset restore ARCHIVE_ID`                                           |

Built-ins: `default`, `web`, `mobile`, `social`, `content`. Finish/cancel outstanding work before applying or restoring. Applying preserves files and task history but starts fresh conversations; `/undo` restores the prior crew. Saving does not replace the crew or overwrite built-ins.

### Build and refine your own team

Start with a built-in team, customize names and instructions, then capture the roster. Enter each line separately:

```text
/preset apply default
/crew add designer Review accessibility, keyboard navigation, and UI consistency. Deliver actionable findings and verification steps.
/preset improve designer Focus on accessible web interfaces
```

Read the suggestions in the designer chat. Apply the wording you accept with `/crew role designer YOUR_ACCEPTED_INSTRUCTIONS`. Role text describes skills; it does not install Codex skills or execute code. New custom teammates are read-only; grant write access only when needed using `/crew access designer write`.

```text
/preset create studio chief reviewer
/preset title studio Accessible design studio
/preset show studio
```

To change the saved team, customize the current crew and run `/preset save studio chief reviewer` again. This preserves its display title. Presets capture names, role instructions and access, not transcripts, sessions or model overrides. The lead and reviewer must exist and be different; the reviewer must be read-only. Names use lowercase letters, digits and hyphens, start with a letter, and contain at most 32 characters.

`/preset delete studio` removes its saved definition immediately. It cannot delete built-ins and does not delete the active crew or project files. Deleting an active definition clears its preset label; its crew remains customized. There is no preset-definition undo; save the current roster again if needed. Applying or restoring a preset archives the current crew and starts or restores sessions, respectively.

## Conversations and recovery

| Command                               | Purpose                                                                                                                 | Sample usage                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `/clear`                              | Archive and clear selected transcript, retaining Codex session memory                                                   | `/clear`                                     |
| `/new`                                | Archive and clear selected transcript and start a fresh Codex session                                                   | `/new`                                       |
| `/new-all`                            | Open fresh conversations for every teammate and Crew Chat; preserve previous history. Finish or stop active work first. | `/new-all`                                   |
| `/archives`                           | List recoverable conversation/crew snapshots                                                                            | `/archives`                                  |
| `/archives restore ARCHIVE_ID [NAME]` | Restore a conversation as a teammate; choose a new name for a copy                                                      | `/archives restore ARCHIVE_ID recovered-dev` |
| `/undo`                               | Restore latest undoable conversation or crew change                                                                     | `/undo`                                      |

Recovery restores conversations/settings, not project files. Stop/cancel relevant work first. `/preset apply default` resets all conversations to the default crew. Keep `.pongkan-crew/state.json` to preserve history.

## Model settings

| Command                             | Purpose                                                                                                          | Sample usage                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `/model [NAME]`                     | Inspect selected/named teammate's requested model and live status                                                | `/model developer`                     |
| `/model list`                       | Browse spaced model entries, supported efforts, and copyable commands for all teammates or the selected teammate | `/model list`                          |
| `/model set NAME MODEL_ID [EFFORT]` | Choose model and optional effort for future tasks                                                                | `/model set developer MODEL_ID medium` |
| `/model set all MODEL_ID [EFFORT]`  | Set model for all teammates                                                                                      | `/model set all MODEL_ID`              |
| `/model reset [NAME]`               | Remove overrides for selected/named teammate                                                                     | `/model reset developer`               |
| `/model reset all`                  | Restore inherited Codex defaults for everyone                                                                    | `/model reset all`                     |

The model panel shows a blank line between choices and actual commands for each cached model, using your selected teammate's name. Examples use a supported effort (medium when available), or omit effort when none is listed. It also shows commands to reset one teammate or everyone.

For example, if your catalog lists `gpt-5.4` with medium/high effort:

```text
/model set all gpt-5.4 medium
/model set developer gpt-5.4 high
/model developer
/model reset developer
/model reset all
```

`all` means every teammate in the current roster, not every saved preset. With the web preset, use a specific name such as `/model set frontend-dev gpt-5.4 high`. Omit effort to inherit Codex's effort default. Stop affected work and finish/cancel workflows before changing settings. Model IDs here are illustrative; no account availability is promised.

Choose IDs and effort levels from `/model list`; cached entries may be unavailable to your account. Changes affect future tasks, preserving conversations and permissions.

## Help and keyboard shortcuts

| Command or key       | Purpose                                                              | Sample usage                                           |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `/help`, `?`, or F1  | Open help                                                            | `/help`                                                |
| `/help QUERY`        | Search command help                                                  | `/help questions`                                      |
| Enter                | Send complete input                                                  | Type `Build the page`, then Enter                      |
| Shift+Enter          | Insert a new line without sending                                    | Write a multiline prompt before pressing Enter         |
| Tab / Shift+Tab      | Cycle teammates and Crew Chat; complete command/mention input        | Type `/chat dev`, then Tab                             |
| F2 / Shift+F2        | Cycle views forward/backward                                         | Chat → Crew Chat → Activity                            |
| Escape               | Close panel, return from group/activity to Chat, or clear Chat input | Press Esc                                              |
| Up / Down            | Move between wrapped input lines; history beyond first/last line     | Move Up to edit an earlier line                        |
| Shift+Left           | Queue the typed prompt and resume paused dispatch                    | Type a follow-up while the crew works, then Shift+Left |
| PgUp / PgDn          | Scroll history or an open panel                                      | Press PgUp while work runs                             |
| Left / Right         | Move input cursor                                                    | Edit a word in a prompt                                |
| Home / End           | Move to beginning/end of the current input line                      | Press Home                                             |
| Ctrl+Home / Ctrl+End | Move to beginning/end of the entire prompt                           | Jump to the first or last character                    |
| Backspace / Delete   | Remove preceding/following character                                 | Correct input before sending                           |
| Ctrl+U               | Clear input                                                          | Start the prompt again                                 |
| Ctrl+W               | Delete preceding word                                                | Remove the last word                                   |
| Ctrl+P / Ctrl+N      | Previous/next submitted input                                        | Recall a previous command                              |
| Ctrl+K               | Invoke `/stop` in the current view                                   | Stop selected work or discussion                       |
| Ctrl+L               | Redraw screen                                                        | Refresh after resizing                                 |
| Ctrl+C               | Stop work and exit                                                   | Close the CLI                                          |

Mouse wheel scrolls responses, activity and panels while the composer stays fixed. PgUp/PgDn also scroll content. Slash-command and mention completion take priority over Tab navigation when input begins with `/` or `@`.

The composer shows up to five lines, depending on terminal height. Long input reserves one line for `[1,234 characters hidden]` and uses the remaining lines for text around the cursor. The count updates as you navigate; input is not truncated when submitted. Crew imposes no input character limit. Ctrl+P/Ctrl+N browse submitted prompts from any input line and restore the current draft after the newest history entry. The footer sits one blank line above the terminal edge.

Activity previews show up to 1,200 characters of command output and 500 characters of command text, followed by `[2,350 more characters]` with the omitted count. This display limit does not shorten chat replies or Markdown responses.

## Terminal launch commands

Run these in PowerShell or Command Prompt, **outside the crew input**.

| Command                                            | Purpose                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `node .\src\cli.js`                                | Launch for the current folder from the Pongkan Crew repository        |
| `node .\src\cli.js --folder ..\todo-app`           | Launch from the tool repository targeting the sibling website         |
| `node ..\pongkan-crew\src\cli.js --folder .`       | Launch from `todo-app`, targeting that folder                         |
| `node .\src\cli.js --doctor --folder ..\todo-app`  | Run startup diagnostics and exit                                      |
| `node .\src\cli.js --preview --folder ..\todo-app` | Render once without Codex requests; loads/saves state and uses a lock |
| `node .\src\cli.js --help`                         | Print CLI usage and command help; `-h` is an alias                    |

The target defaults to the current directory; quote paths with spaces and confirm with `/folder`. Only one instance can target a folder. Run npm/npx in a terminal, not crew input. For a complete example, see the [todo walkthrough](TODO_WEBSITE_WALKTHROUGH.md).

## Conversation presentation

Chat shows clarification signals as readable `Question:` or `Blocked:` text. When you answer with `/answer TASK_ID TEXT`, the conversation shows `Answer: TEXT` instead of replaying the original assignment and internal continuation instructions. This also applies to recognized older saved conversations and workflow continuations. Original prompts and results remain available through `/queue show TASK_ID`; display formatting does not rewrite saved history.

The recipient AI interprets greetings, acknowledgements, requests, and unfamiliar verbs from the full message and conversation. The app does not classify them using word lists, change permissions for greetings, or replace replies with canned text. Short replies such as `Okay` retain the recipient's configured access and can refer to an earlier proposal. Use explicit commands to control saved waiting tasks, cancellation, and workflow recovery.

## Local context optimizer

Context optimization is optional and **off by default**. Enter each command separately:

```text
/context on
/context status
/context off
```

The mode is saved per project and applies when future prompts are built. It locally shortens long assistant replies in workflow handoffs, Crew Chat context, and recovered conversations without an existing Codex session. Each shortened reply retains its beginning, ending, source label, and an explicit omission marker. Every source remains represented. Full original records stay in saved history; `/queue show TASK_ID` displays full task results.

The optimizer keeps current assignments, clarification answers, user messages, captured changed-file lists, roles, permission instructions and discussion restrictions intact. It targets 24,000 characters per context section, allocating at most 4,000 characters per assistant reply. User text and source labels take priority, so this is a soft target rather than a hard context limit. Large user histories can exceed it.

`/context status` reports before/after character counts and shortened replies for the latest optimized section of each type. These compare the same labeled records before and after shortening, not total prompt size, provider token usage, cost savings or model context-window utilization. Existing counts remain visible when the mode is off.

This is deterministic clipping, not AI summarization or Codex session compaction. Middle text can contain essential evidence; inspect originals when needed, and disable the optimizer for tasks requiring every detail. It makes no extra API calls, resets no sessions, deletes no history and changes no permissions. Codex still manages the context inside resumed sessions; the app cannot inspect or compact that internal history. With the mode off, the app retains its previous bounded context behavior.
