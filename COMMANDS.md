# Pongkan Crew command reference

## Markdown saving

`/markdown on` enables task and Crew Chat exports and creates `docs/pongkan-docs/` in the selected project. `/markdown off` stops subsequent exports without deleting documents. `/markdown` reports the mode and destination. The setting persists per project and defaults to off.

Changed records save as `task-<id>.md` or `discussion-<id>.md`. Continuations update the same task file; retries have separate IDs. Follow-ups queued during an active discussion update that discussion's file; follow-ups after completion create a new discussion ID with copied history. Exports include full saved responses, status, prompts, clarification answers, and speaker labels. Crew Chat user prompts record `Submitted with: Enter (preserve queue pause)` or `Submitted with: Shift+Left (queue and resume dispatch)`, submission/start times, and `Waiting for earlier prompts to finish` until started. Replies are grouped with their original prompt. Older saved messages without this metadata retain their original labels. Enabling does not backfill unchanged history. Export failures appear in Activity while original results remain saved. Unrelated existing files and redirected paths are rejected.

Safe writing uses a PowerShell/.NET directory-lock helper on Windows and directory descriptors on Linux with `/proc/self/fd`. Other platforms currently report an unsupported-platform error when saving is enabled.

[README](README.md) · [Todo website walkthrough](TODO_WEBSITE_WALKTHROUGH.md)

Enter commands **inside Pongkan Crew**, one message at a time, except for terminal commands below. Use names from your roster and replace uppercase placeholders with values shown by the app. `[Arguments]` are optional; omit the brackets.

Plain text goes to the selected teammate in Chat or continues the shared read-only discussion in Crew Chat. Both include saved conversation context on follow-ups. Activity accepts commands only. `/task` goes to the lead; when used from Crew Chat, it includes the discussion as context.

During an active Crew Chat discussion, new prompts wait until all turns for the current prompt finish, including its summary. They do not change the context of unfinished earlier turns. Queued prompts stay outside the live transcript with a waiting count and appear when their replies begin. Enter sends without changing the queue's paused state. Shift+Left queues the typed prompt and resumes paused dispatch, including other eligible queued tasks. Neither requires interrupting the current reply. Sending opens the conversation by closing any open panel. Tab remains teammate navigation or command/mention completion.

`/crew-task [GOAL]` uses the latest Crew Chat as context from any tab. Without a goal, it asks the lead to implement the agreed plan; with a goal, it uses that instruction plus the discussion. It requires a nonempty Crew Chat and waits for you to finish or stop an active discussion. It creates a coordinated workflow and opens Crew Chat, where the lead's plan, teammate replies, review and final summary appear as turns finish. `/task GOAL` opens the lead's individual Chat and only attaches Crew Chat automatically when invoked from that view.

## Chat, assignments, and discussions

| Command                          | Purpose                                                                       | Sample usage                                                             |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/chat [NAME]`                   | Open Chat and optionally select a teammate                                    | `/chat chief`                                                            |
| `/crew chat NAME`                | Alias for selecting a teammate's Chat                                         | `/crew chat developer`                                                   |
| `/personality`                   | List chat styles and each teammate's current style                            | `/personality`                                                           |
| `/personality [NAME\|all] STYLE` | Change the selected teammate, a named teammate, or the whole crew's chat tone | `/personality developer jokester`                                        |
| `/personality reset [NAME]`      | Restore neutral style for a teammate or the selected teammate                 | `/personality reset`                                                     |
| `/next`                          | Cycle forward through teammates and Crew Chat                                 | `/next`                                                                  |
| `/prev`                          | Cycle backward through teammates and Crew Chat                                | `/prev`                                                                  |
| `/task TEXT`                     | Lead plans sequential assignments, independent review, and summary            | `/task Add todo filters, verify them, and review the changes.`           |
| `/send NAME TEXT`                | Queue a direct assignment without changing selection                          | `/send developer Fix the remaining count.`                               |
| `/handoff NAME [TASK]`           | Pass the selected teammate's latest assistant answer to another teammate      | `/handoff reviewer Review the implementation against the requirements.`  |
| `/retry`                         | Resend the selected teammate's latest direct user message                     | `/retry`                                                                 |
| `/discuss TOPIC`                 | Start two read-only rounds with the crew, then a lead summary                 | `/discuss Plan keyboard navigation for our todo app. Do not edit files.` |
| `/group`                         | Open the latest shared Crew Chat                                              | `/group`                                                                 |
| `@NAME MESSAGE`                  | Request one read-only reply using the latest shared discussion                | `@developer How will you preserve invalid stored data?`                  |

For ordered implementation and review, use `/task`; direct tasks are independent. Discussions and mentions are read-only. Crew Chat shows readable plans and full teammate responses with speaker labels. Activity shows workflow IDs, task status and handoff records; raw tasks remain available through `/queue show ID`. Handoffs and retries can trigger edits; inspect changes first.

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
| `/schedule add MINUTES NAME GOAL`             | Recurring read-only task in a dedicated conversation                                         |
| `/schedule add MINUTES NAME --write GOAL`     | Recurring task with that member's normal access                                              |
| `/schedule list`                              | Intervals, next runs, and enabled state                                                      |
| `/schedule pause ID` / `/schedule resume ID`  | Disable or enable automatic runs                                                             |
| `/schedule run ID`                            | Dispatch now if the queue is unpaused and no prior run is pending                            |
| `/github issue OWNER/REPO NUMBER`             | Read an issue using authenticated `gh`                                                       |
| `/github pr OWNER/REPO NUMBER`                | Read a PR's title/body/status                                                                |
| `/github task OWNER/REPO NUMBER [--isolated]` | Create local work from an issue; no GitHub writes                                            |

Worktrees require a committed repository root and clean tracked files, start from `HEAD`, and do not copy untracked setup or dependencies. One writer runs per workspace; separate worktrees can run concurrently. Retain/review the branches and explicitly commit/merge with Git. `/workflow show ID` links teammate chats. The default Crew Chat aggregates workflow activity; named shared chats filter to their originating workflows. Named chats preserve context and task destinations when switching. `/new` opens a blank named chat; `/clear` applies only to legacy individual chats.

Memory lives in `.pongkan-crew/project-memory.json` (up to 50 entries, 2,000 characters each, 40 KB total). It is user-maintained guidance, not extra authority. Steering does not interrupt commands: running tasks continue with corrections after the current turn, queued tasks receive them when dispatched, and workflow guidance carries forward. `/queue show ID` includes delivery timestamps. Waiting questions still require `/answer`.

Schedules run inside the open app or a headless process: `node src/cli.js --folder PROJECT_PATH --worker`. Add `--once` for a periodic Windows Task Scheduler invocation: due jobs are dispatched once, active turns finish, and the process exits. A persistent worker can be launched by Task Scheduler to survive closing CMD; no system task is installed automatically. Use absolute executable/script/project paths. The folder lock prevents running the interactive app and worker on the same state simultaneously. Keep the machine on; inspect and recover paused/interrupted work explicitly. Missed intervals coalesce and a schedule never overlaps its prior pending task. Human approval/clarification still requires interactive attention. GitHub integration requires an installed, authenticated GitHub CLI.

After a Crew Chat discussion finishes, `Proceed with that`, `Go ahead`, or `Implement the plan` starts a workflow with the prior discussion attached and switches to the lead's chat. Other messages continue the discussion; `@NAME` always requests a read-only discussion reply. For a specific execution instruction, use `/task YOUR_GOAL` from Crew Chat. Wait for an active discussion to finish or stop it with `/stop` before starting execution.

Individual follow-ups include saved history even when resuming a Codex session. `/context on` can shorten assistant history; `/context off` sends saved history without local clipping. Discussion sessions remain separate from individual sessions.

### Sample: meet your crew

Paste this as one command to introduce the current roster in Crew Chat:

```text
/discuss Everyone in the current crew, introduce yourself. State your name, role, main responsibilities, current file access, and how you collaborate with the other teammates. Explain which tasks I should assign to you and give one short example. Cover every role in the current roster; do not invent absent teammates. Keep introductions concise and do not modify files. Lead: finish with a brief guide to who handles what.
```

This works with default and custom crews. Introductions are read-only; the lead summarizes who handles what. If the queue is paused, use `/queue resume` to start the replies.

## Questions and autonomy

| Command                | Purpose                                                              | Sample usage                                              |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `/questions`           | Show question mode and waiting questions                             | `/questions`                                              |
| `/questions list`      | Show pending questions with task IDs and reply instructions          | `/questions list`                                         |
| `/questions on`        | Allow material clarification questions in future work turns; default | `/questions on`                                           |
| `/questions off`       | Let AI decide routine choices within the task and report assumptions | `/questions off`                                          |
| `/answer TASK_ID TEXT` | Save your answer and continue the same waiting assignment            | `/answer TASK_ID Use a compact list with inline editing.` |

Question mode is saved per folder and affects future turns. Answer waiting tasks or cancel them with `/queue cancel TASK_ID`. Waiting blocks dependent work and that teammate's other tasks; independent teammates can continue. Answers queue when dispatch is paused. Discussions and lead planning do not use this question protocol.

Questions off does not bypass permissions. Teammates can use existing approvals or request automatically reviewed, command-specific escalation. Denied/unavailable actions remain blockers. An explicit blocker signal fails the task and cancels dependent work; prose alone does not.

## Stop and cancel

| Command                        | Purpose                                                                 | Sample usage                   |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------ |
| `/stop`                        | Stop selected teammate's active work; in Crew Chat, stop the discussion | `/stop`                        |
| `/stop NAME`                   | Stop a named teammate's active task                                     | `/stop developer`              |
| `/stop all`                    | Pause dispatch and cancel all queued, waiting, and running work         | `/stop all`                    |
| `/queue cancel TASK_ID`        | Cancel a queued, waiting, or running task                               | `/queue cancel TASK_ID`        |
| `/workflow cancel WORKFLOW_ID` | Cancel a workflow and its remaining assignments                         | `/workflow cancel WORKFLOW_ID` |
| `/quit` or `/exit`             | Stop active work and exit the CLI                                       | `/quit`                        |

Stopping preserves edits. Canceling a workflow task cancels dependent work. Use `/queue cancel TASK_ID` for waiting tasks; `/stop NAME` targets active work. After `/stop all`, use `/queue resume` to restart dispatch.

## Tasks and workflow history

| Command                         | Purpose                                                 | Sample usage                  |
| ------------------------------- | ------------------------------------------------------- | ----------------------------- |
| `/queue` or `/queue list`       | List task IDs, statuses, and dispatch state             | `/queue list`                 |
| `/queue show TASK_ID`           | Read prompt, result, error, dependency, and timing      | `/queue show TASK_ID`         |
| `/queue pause`                  | Stop new dispatch while active work continues           | `/queue pause`                |
| `/queue resume`                 | Resume dispatch of eligible queued tasks                | `/queue resume`               |
| `/queue move TASK_ID POSITION`  | Move a queued task to a one-based queue position        | `/queue move TASK_ID 1`       |
| `/queue retry TASK_ID`          | Create a retry of a finished standalone task            | `/queue retry TASK_ID`        |
| `/workflow` or `/workflow list` | List coordinated workflows                              | `/workflow list`              |
| `/workflow show WORKFLOW_ID`    | Inspect goal, assignments, statuses, summary, and error | `/workflow show WORKFLOW_ID`  |
| `/workflow retry WORKFLOW_ID`   | Start a new attempt at a finished/interrupted workflow  | `/workflow retry WORKFLOW_ID` |

Moving tasks respects dependencies and the single-writer rule. Retry workflows with `/workflow retry`; restart discussions with `/discuss` or a mention. Retries may repeat edits. After restart, dispatch is paused, running tasks are interrupted, and unfinished workflows need explicit retry. Direct waiting questions survive. A completed workflow means turns finished; read the review and summary to assess delivery.

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
| `/crew rename NAME NEWNAME`   | Rename a teammate; preserve lead/reviewer routing across restarts | `/crew rename chief boss`                              |
| `/crew remove NAME`           | Archive and remove a non-coordinator; reject extra arguments      | `/crew remove artist`                                  |

Finish/cancel active workflows and affected tasks before changing members. The reviewer stays read-only; coordination members and the last teammate cannot be removed. Writer access does not grant command approvals, and discussions remain read-only.

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
| Enter                | Send complete input                                                  | Paste one `/task ...` prompt, then Enter               |
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

Standalone greetings and acknowledgements such as `Hello!`, `Thanks`, and `Okay` receive instructions for a brief natural reply, without tools or a formal completion report. They run read-only and cannot become waiting clarification tasks. A message such as `Hello, build a navigation bar` remains a normal assignment, with its usual permissions and clarification behavior. Explicit workflows and resumed assignments keep task handling. Reply wording still comes from Codex; the app does not replace replies with canned greetings.

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
