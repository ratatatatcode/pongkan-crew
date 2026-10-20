# Crew troubleshooting guide

[README](../README.md) | [Commands](COMMANDS.md) | [Upgrading and recovery](UPGRADING.md)

This guide covers known failure categories in Crew, including blocked workflows, startup, permissions, saved state, conversations, scheduling, exports, and terminal behavior. New failures can occur; use the diagnostic checklist at the end when no section matches. A blocked report means a prerequisite remains unresolved; it does not necessarily mean a database operation failed.

## Quick start: the recovery command

Restart Crew after updating its code, then enter this in Crew's input:

```text
/recovery
```

It diagnoses the current unfinished workflow and attempts repairs while preserving completed steps and configured permissions. To select a workflow explicitly, use its actual ID. For example:

```text
/recovery 08d7f22f
```

That ID is an example from the database-isolation workflow; use `/workflow list` to find IDs in your own project. Allow the attempt to finish, then inspect `/activity` and `/workflow show WORKFLOW_ID`. The command allows two automatic recovery attempts and reports any remaining blocker.

If Crew cannot start because saved-state validation fails, `/recovery` cannot run yet. Update and relaunch Crew first; see [saved-state troubleshooting](#saved-state-storage-and-path-errors). Older archived records missing permission defaults are handled by the updated loader.

## Quick symptom index

| Symptom                                    | Start here                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Missing teammate acceptance                | [Teammate confirmation](#required-database-dev-confirmation-remains-unavailable) |
| Recovery repeats or stops                  | [Automatic recovery](#let-automatic-recovery-handle-a-teammate-dependency)       |
| PowerShell refuses npm                     | [PowerShell wrapper](#powershell-blocks-npmps1)                                  |
| A writer says read-only                    | [Task access](#a-writer-reports-that-the-workspace-is-read-only)                 |
| Raw JSON, missing IDs, cramped text        | [Display problems](#raw-json-missing-ids-or-inconsistent-message-spacing)        |
| CLI will not start or sign in              | [Startup](#startup-login-and-executable-discovery)                               |
| Another instance or lock error             | [Folder locks](#folder-locks-and-another-instance-is-open)                       |
| Nothing runs or tasks remain queued        | [Queue diagnosis](#queued-work-does-not-start)                                   |
| A task waits for an answer                 | [Clarifications](#waiting-questions-and-answers-that-do-not-continue-work)       |
| Work stops after restart or cancellation   | [Resume versus retry](#interrupted-cancelled-or-completed-work)                  |
| Invalid plan, JSON, or verification report | [Structured reports](#invalid-plans-and-structured-reports)                      |
| Completed but changes are missing          | [Outcome verification](#completed-does-not-mean-verified)                        |
| Model, capacity, network, or session error | [Model and service failures](#model-service-and-session-failures)                |
| Wrong chat or missing history              | [Conversations](#conversation-context-and-missing-history)                       |
| Corrupt state or unsafe path error         | [Saved state](#saved-state-storage-and-path-errors)                              |
| Isolated workflow cannot start             | [Worktrees](#git-and-isolated-worktree-problems)                                 |
| Recurring tasks do not run                 | [Schedules](#schedules-and-headless-workers)                                     |
| Markdown export fails or omits content     | [Exports](#markdown-exports-and-project-memory)                                  |
| Keys or scrolling do not work              | [Terminal controls](#terminal-input-scrolling-and-panels)                        |
| Command, preset, or teammate is rejected   | [Configuration](#commands-teammates-and-presets)                                 |

Commands beginning with `/` belong in Crew's input. PowerShell commands belong in a separate terminal. Replace uppercase placeholders with actual IDs, names, or paths; do not paste placeholder text literally.

## One-command recovery

For a failed, cancelled, or interrupted workflow, run:

```text
/recovery
```

Crew selects the latest unfinished workflow associated with the current conversation. In Crew Chat or Activity, it uses the current shared conversation; in Chat, it uses standalone workflows linked to the selected private conversation. It does not scan and restart every old failure in the project. If no workflow matches, select one explicitly:

```text
/recovery WORKFLOW_ID
```

This requests a fresh diagnosis with a new two-attempt recovery budget. Crew keeps completed steps, retires unfinished obsolete recovery branches, and reconnects the original unfinished assignments before diagnosis. The coordinator receives recorded errors and completed teammate findings. It can request reviews, assign prerequisite repairs to an existing writer, or retry a worker with a changed approach. Failed initial planning is retried within the original goal. Unrelated paused tasks stay paused.

The command refuses completed or still-active workflows; repeated commands cannot stack concurrent recovery runs. Waiting questions still require `/answer TASK_ID TEXT`. Standalone tasks and discussions use their own retry/restart commands, described below.

Recovery is best effort. It preserves configured permissions and the original goal; it does not reset credentials, override approval decisions, roll back files, or promise to fix external outages. Inspect the resulting review and summary. If no valid action is available, Crew reports the remaining blocker instead of looping indefinitely.

## Find the affected workflow

Run these commands inside Crew, replacing `WORKFLOW_ID` with the ID shown in the list:

```text
/workflow list
/workflow show WORKFLOW_ID
```

The list shows each workflow's ID, status, short goal, and detail command. The detail panel shows assignments, results, and errors. For a particular assignment, use `/queue show TASK_ID`.

Read the latest error before resuming. The notice “Workflow … resumed” confirms dispatch restarted; a later failure can still leave the workflow marked `failed`.

## Let automatic recovery handle a teammate dependency

When a worker ends its response with `PONGKAN_BLOCKED`, Crew asks the coordinator to evaluate recovery. The coordinator can:

- Ask a teammate to inspect a prerequisite or review a contract in a read-only turn.
- Retry the reporting worker with a concrete changed approach.
- Assign prerequisite work to another teammate, then retry the reporting worker. For example, Project-lead can ask Test-engineer to create missing regression coverage before continuing its assessment.
- Stop and report the action still needed from the user.

New writer tasks require an existing writable implementation assignment in the workflow. Recovery retains the selected teammate's configured permissions. A read-only workflow cannot gain source-edit tasks through recovery.

Crew allows at most two automatic recovery attempts before stopping. Only an explicit `/recovery` request renews that budget. Completed steps and partial findings are preserved. Recovery does not automatically restore or roll back project files, supply credentials, or override denied approvals. A teammate's agreement must come from their actual review; the coordinator must not invent acceptance.

After updating or restarting Crew, explicitly resume the unfinished workflow:

```text
/workflow resume WORKFLOW_ID
```

Resuming does not reset the recovery limit. Use `/recovery` when a fresh diagnosis is needed, particularly after exhausting the previous budget or a failed recovery handoff. Plain “continue” is a message to the recipient AI and does not itself resume a failed workflow. `/workflow retry WORKFLOW_ID` starts a new workflow and may repeat completed work; use it deliberately after inspecting the existing changes.

## “Required Database-dev confirmation remains unavailable”

This means the reporting worker has not found the required review or acceptance. Allow recovery to request the review. If manual intervention is needed, send a specific request:

```text
/send database-dev Review docs/DATABASE_ISOLATION_CONTRACT.md and record your acceptance or requested changes in that document. Do not claim acceptance without reviewing it.
/chat database-dev
```

The filename and teammate name are examples; substitute those used by your project. Resolve requested changes before resuming implementation.

`/send NAME MESSAGE` creates a separate private task for that teammate without switching your view. `/chat NAME` opens their reply. A separate task does not automatically resume the blocked workflow, and its private reply is not automatically a workflow handoff. Recording the reviewed decision in the relevant project document makes it available for the resumed worker to inspect.

## PowerShell blocks `npm.ps1`

If a report says PowerShell refused to load `npm.ps1`, use `npm.cmd` with the same arguments in the target project's terminal. For example:

```powershell
npm.cmd test
```

Workers receive this fallback guidance automatically. It avoids the PowerShell wrapper without changing execution policy. It does not resolve unrelated test failures or sandbox denials; inspect any new error separately.

## A writer reports that the workspace is read-only

The sidebar's `write` label describes the teammate's role. An individual turn can still be read-only: planning, discussion, review, and some coordination turns intentionally request read-only access. A teammate's Read Only permission mode or host restrictions can also prevent edits.

Inspect the failed assignment and the actual tool error. Each new prompt states the current task's requested access so the worker can distinguish it from historical read-only turns. A writer should not infer current access solely from an earlier message.

Route necessary source or test changes to a writable implementation task within the authorized goal. If the worker remains blocked, report the exact operation and error rather than repeatedly requesting the same change or claiming that the sidebar guarantees filesystem access.

## Raw JSON, missing IDs, or inconsistent message spacing

Older versions could print the full workflow prompt in `/workflow list`, hiding IDs behind historical chat, show recovery JSON directly, or place a “You” label immediately after progress text while errors had extra spacing.

Update Crew, close the running CLI, and restart it from the updated source using the same target project folder. An existing Node process keeps its previously loaded code. The current list uses compact entries, recovery decisions display as readable text, and workflow blocks use consistent separation.

The earlier error “Recovery retry must address the original worker” occurred when a coordinator reported another teammate's blocker. The corrected routing can assign that teammate prerequisite work before retrying the coordinator. After restarting, resume the affected workflow to retry its saved unfinished recovery task.

Keep saved state intact. If the problem persists, capture the workflow ID, latest assignment error, command used, and a screenshot. Inspect reports for private data before sharing them.

## Startup, login, and executable discovery

From the Pongkan Crew source folder, run:

```powershell
node --version
node .\src\cli.js --doctor --folder "C:\Projects\My Project"
```

Crew requires Node.js 22 or newer, an available Codex CLI, an existing project folder, and a usable login. Quote paths containing spaces. If `node` is not found, install a supported Node version and reopen the terminal. If the script cannot be found, check that you are launching from the tool repository or use its absolute script path.

If doctor reports Codex unavailable, check the CLI installation and executable path. On Windows, `PONGKAN_CODEX_BIN` can point to the full path of the installed native `codex.exe`. Set it to the actual executable, not a directory or a shell command. Restart Crew after changing the environment.

For “Login unavailable” or “No login found,” run `codex login` in the terminal, then restart Crew and rerun doctor. Successful startup checks do not guarantee a particular model or later network request will succeed.

## Folder locks and “another instance is open”

Only one interactive app or headless worker may own a target project's saved state. Close the other instance using that exact folder. An apparently duplicate window may be a scheduled worker.

Crew automatically reclaims a stale lock when it can establish that the recorded process exited. A lock with an unknown owner or a process that still exists is not treated as safely stale. Check the reported PID before changing anything.

If the error specifically reports interrupted lock recovery, close all instances and follow its instruction for the exact `.recovery` file. Do not remove the whole `.pongkan-crew` directory, delete state, or remove a live instance's lock to force another launcher through.

## Queued work does not start

Inspect `/status`, `/queue list`, and `/queue show TASK_ID`. A queued task may be waiting for:

- Global dispatch to resume after startup or `/queue pause`.
- Its dependency to complete successfully.
- The same teammate's active turn or saved clarification to finish.
- Another writer or stable read in the same project folder to release access.
- A scoped pause that deliberately keeps unrelated tasks from running.

Use `/workflow resume WORKFLOW_ID` for a failed or interrupted workflow. Use `/queue resume` when you intend to release all eligible queued tasks, including unrelated paused tasks. Resuming the queue does not turn a failed dependency into a completed one, and moving a task earlier does not bypass dependencies.

“Another writer is active in this folder” is a scheduling constraint. Let that writer finish or explicitly stop its work. Do not launch a second instance against the same state to bypass it.

If the app shows little progress, inspect `/progress NAME` and `/activity` before assuming it is hung. Activity reports tool events and responses; it is not a continuous stream of subprocess output or private reasoning. Stop a genuinely stuck task, inspect partial edits, then choose the appropriate recovery command.

## Waiting questions and answers that do not continue work

Run `/questions list`, then answer the actual waiting task:

```text
/answer TASK_ID YOUR_ANSWER
```

Shift+Right can fill the answer command. An ordinary message is a new message and does not automatically answer a saved waiting task. If dispatch is paused, the answer is saved but will not run until eligible dispatch resumes.

“Only a task waiting for an answer can be answered” means the ID is not currently waiting. Recheck the list; do not answer an old failed task. For an interrupted or finished workflow, inspect and resume the workflow first as appropriate.

`/questions off` affects future work turns and lets workers decide routine choices. It does not supply missing credentials, approve an action, remove saved waiting questions, or override permissions. A worker that asks for clarification while questions are off can fail its task; inspect the request before retrying.

## Interrupted, cancelled, or completed work

| Situation                                                     | Appropriate action                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unfinished workflow failed, was cancelled, or was interrupted | Inspect changes, then `/workflow resume WORKFLOW_ID` to reuse its unfinished steps. |
| Finished or interrupted standalone assignment                 | Inspect changes, then `/queue retry TASK_ID` to create a new task.                  |
| Interrupted discussion                                        | Start `/discuss TOPIC` or send a new directed message with the needed context.      |
| A complete workflow has additional requested changes          | Start a follow-up task; a completed workflow cannot be resumed.                     |
| A new attempt at the whole workflow is intended               | `/workflow retry WORKFLOW_ID`; completed edits may be repeated.                     |
| The previous turn is still stopping                           | Wait for it to settle before resuming.                                              |

Stopping preserves source edits. `/stop all` also pauses dispatch. `/undo`, archives, and fresh chats restore or change Crew history/configuration, not project source files. Use your project's version control or backups for source recovery after inspecting changes.

An unknown task or workflow ID may belong to another target folder or be mistyped. Use the lists in the current project rather than reusing IDs from screenshots or another project.

## Invalid plans and structured reports

“Lead returned invalid JSON,” “Invalid lead plan,” or “No complete structured report was returned” means Crew could not accept the required structured response. It must not invent missing steps or treat malformed output as a valid plan.

Inspect `/workflow show WORKFLOW_ID` and the failing task. A plan needs 1–12 named steps, existing teammates, no step assigned to the lead, and an existing read-only reviewer. A workflow marked as requiring edits must include a writable implementer. Correct the roster or request if needed, then deliberately retry planning. Inspect partial edits first if failure occurred after implementation rather than during initial planning.

“Invalid recovery decision” or “Recovery failed” can indicate malformed output or an unavailable teammate. Crew stops rather than executing an invalid decision. Check the accompanying original blocker; fix the underlying prerequisite before retrying. Automatic recovery attempts are bounded and do not increase through repeated resume commands.

“Recovery cannot introduce source edits into a read-only workflow” is intentional. Start a separately authorized implementation task if source changes are needed; changing the prose of a read-only review does not grant edit access.

## Completed does not mean verified

The workflow status `completed` means its scheduled turns finished. Read the summary and review for defects, unavailable checks, and remaining work.

For workflows with structured outcome verification, `needs_work` means a requirement failed or remains unmet; `unverified` means evidence or checks are insufficient. A worker's claim of passing tests does not replace independent reviewer inspection. A `met` report without recorded successful independent inspection is downgraded to `unverified`.

If a verification report cannot be read, inspect the task and Activity. Arrange a new review or follow-up work with the relevant requirements and evidence. Do not interpret missing verification as success, or repeatedly resume a completed workflow to request new changes.

## Model, service, and session failures

For capacity, quota, rate-limit, authentication, connectivity, or model-unavailable errors, retain the exact provider error and check `/doctor` and `/model NAME` as relevant. Wait for temporary availability problems to clear rather than repeatedly launching identical attempts. Automatic workflow recovery handles explicit blocker reports; it does not guarantee repair of process failures or provider outages.

Use `/model list` for available cached choices and supported effort values. The catalog does not guarantee account access. Unknown model IDs and unsupported effort values can be rejected. After affected work stops, set a supported model with `/model set NAME MODEL_ID EFFORT`, or remove an override with `/model reset NAME`. These changes affect future turns and do not resume failed workflows themselves.

If a session repeatedly carries stale assumptions, first inspect the current conversation and task settings. `/clear` retains Codex session memory; `/new` opens a fresh conversation/session and preserves earlier history. A fresh chat is appropriate for new direct work but does not automatically repair a workflow's saved execution session or dependency chain. Explicitly include the findings needed by a replacement task.

## Conversation context and missing history

Use `/conversation list` and `/conversation open CONVERSATION_ID` to find saved chats. Restore an archived chat with `/conversation restore CONVERSATION_ID`. Switching views does not stop active work.

Individual chats, named Crew Chats, and workflow execution sessions have different histories. Private messages are not automatically shared with everyone. `/share NAME REQUEST` shares the latest completed private exchange; `/handoff NAME TASK` sends the selected teammate's latest private answer. Wait for the latest reply before sharing, and choose another teammate as recipient.

`/crew-task` carries the current Crew Chat findings into a workflow. It does not collect every private conversation. Include relevant decisions in the shared discussion or goal before execution. A plain approval or “continue” goes to its recipient AI; use explicit workflow commands when you need deterministic dispatch.

If there is no discussion to execute, start `/discuss TOPIC` first or use `/task GOAL` for a standalone workflow. If a discussion is active, wait for completion or explicitly stop it before starting its implementation plan.

Context optimization and Activity previews can shorten text. Inspect full task details and original files for missing evidence; `/context off` disables optional context shortening for future requests. History remains saved, but not all of it is guaranteed to fit in each model request.

## Saved state, storage, and path errors

An older Crew version could reject otherwise valid state because archived teammate records lacked the newer `codexPermissions` field. The current loader supplies the same default for archived and active records, preserving history and explicit permissions. Update Crew and relaunch the same project before attempting manual repair. This compatibility fix does not make genuinely malformed state valid.

For “Invalid crew state JSON” or “Invalid crew state,” close Crew and back up the exact target project's `.pongkan-crew/state.json` before repair. Preserve the original error and existing file. Do not delete all state or overwrite it with an empty object to make startup succeed. Restore only from a known valid backup after confirming the target folder and closing other instances. See [upgrade and recovery guidance](UPGRADING.md).

For “Cannot write folder state,” `EPERM`, `EACCES`, or a disk-space error, check the exact reported path, available storage, and current account's access. A path outside the workspace may be needed for executable resolution or tooling. Changing a teammate's role does not change host filesystem permissions. Request only the specific access required by the actual operation; do not assume Full Access is a necessary fix.

For Node startup `EPERM: lstat` on a parent path such as `C:\Users\Admin`, or npm cache/temp access errors, use `/permissions approve NAME` for a writable teammate. Crew passes Codex's native `--approve-for-me` option and instructs the worker to request a scoped retry through the execution tool. Automatic review can still deny a request, and genuine Windows ACL failures or file locks need separate diagnosis. Read-only roles remain read-only. Restart Crew after updating its code; mode changes apply to future turns. The optional live check `node scripts/check-permissions.js` uses your Codex account to verify Node and npm in fresh and resumed turns.

“Unsafe crew state file/directory,” “Unsafe worktree directory,” and “Unsafe Markdown destination” can indicate redirected paths, symbolic links/junctions, hard links, or unexpected file types. Crew deliberately rejects these paths. Close the app, preserve the affected data, and inspect the exact path before restoring an ordinary directory/file in the intended project. Do not disable the checks or replace unrelated filesystem paths.

If a backup is unavailable or the corruption cannot be understood safely, retain the broken state and seek help with a redacted error. Source files and saved Crew history are separate recovery concerns.

## Git and isolated worktree problems

Isolated workflows require Git, the repository root as the target folder, a committed `HEAD`, and no tracked changes pending. For “Open the Git repository root,” relaunch against the root. For dirty tracked files, inspect them and deliberately commit or stash the relevant changes before trying again. Do not discard them to satisfy the check.

Worktrees start from committed `HEAD`; uncommitted work and untracked project files are not automatically carried into the isolated checkout. Commit the files required for the task or choose a normal workflow in the existing workspace.

Use `/worktree list` and `/worktree show WORKFLOW_ID` to inspect isolated branches and changes. If an isolated directory is missing, redirected, or unsafe, stop and inspect the recorded branch and worktree before recovery. Creating an empty replacement folder does not restore its source files or Git metadata.

Crew retains isolated worktrees and does not automatically merge, push, or delete them. Review and integrate changes explicitly. A normal workflow has no isolated worktree, so “This workflow has no isolated worktree” is expected for that workflow.

For Git ownership or repository access errors, inspect the repository owner and exact path. Do not globally trust every repository or force Git operations as a generic workaround.

## Schedules and headless workers

Inspect `/schedule list` and the last task before running or resuming a schedule. Schedules require the app or a headless worker to be running, the machine to be on, dispatch unpaused, and no previous pending run for the same schedule. Missed intervals produce one run rather than a backlog of overlapping runs.

`/schedule resume SCHEDULE_ID` enables automatic runs; `/schedule run SCHEDULE_ID` requests a run now when dispatch and prior-task conditions permit. A schedule's archived conversation must be restored before it can resume. Read-only schedules do not gain writer access because the teammate normally writes; creating a write schedule requires the explicit `--write` option.

The headless worker refuses saved paused work. Inspect and resume or cancel it in the interactive app first, then close that app before starting a worker for the same folder. Interactive and headless instances share the folder lock. Use absolute executable, script, and project paths in external schedulers. Crew does not install an operating-system scheduled task automatically.

Schedule intervals must be whole minutes from 1 to 525600, goals 1–8000 characters, and a project supports up to 50 schedules. Approval decisions and material clarifications can still require interactive attention.

## Markdown exports and project memory

Inspect `/markdown` for export status and location. Enable saving with `/markdown on` before `/markdown refresh`. Disabling export does not erase existing documents. See the [Markdown export contract](MARKDOWN_SAVING_CONTRACT.md) for how workflow, discussion, and standalone records are organized.

If a save fails, inspect the exact destination and error. A filename conflict may mean an existing file is not a Crew-generated document. Preserve it and resolve the conflict rather than overwriting it blindly. Linked or redirected destinations are intentionally rejected. After resolving the storage issue, refresh exports; export failure alone does not prove that the implementation failed.

For an invalid `project-memory.json`, back it up and repair its expected entries before continuing. Memory supports up to 50 entries, 2000 characters per entry, and 40 KB overall. Use `/memory show` to inspect IDs and `/memory remove MEMORY_ID` to remove a specific entry. Shorten content when a size limit is reached. Memory is guidance, not permission to bypass the task's boundaries.

## Terminal input, scrolling, and panels

Use PgUp/PgDn to scroll history or an open panel. Close a panel with Escape or `/close`; use F2 to change views. A history offset can hide new output until you scroll back toward the latest messages. The task can keep running while you browse a panel.

Enter sends the entire prompt; Shift+Enter inserts a newline. Up/Down moves within wrapped input and browses history beyond its boundaries. Tab may complete a command or cycle teammates depending on input context. Use explicit `/chat NAME`, `/group`, and `/activity` commands if shortcuts are intercepted by the terminal.

If special keys or wheel input behave incorrectly, check the terminal's own shortcuts, selection mode, and whether it supports the required key sequences. Resize the terminal and reopen Crew after updating its code. Report the terminal application, dimensions, key pressed, expected behavior, and observed result. Do not use repeated Enter presses to diagnose input because they may send duplicate work.

## Commands, teammates, and presets

For unknown or malformed commands, run `/help QUERY` and copy the documented syntax. Some commands reject extra arguments rather than silently ignoring them. Use exact lowercase teammate IDs from `/crew list`; display capitalization does not change those IDs.

Teammate names must start with a lowercase letter and contain at most 32 lowercase letters, digits, or hyphens. Duplicate names are rejected. A workflow requires a lead, another teammate, and a read-only reviewer. The designated reviewer cannot receive writer access, and coordination members cannot simply be removed.

Finish or cancel affected work before changing the roster, applying/restoring presets, or undoing configuration changes. Inspect pending tasks before using `/stop all`, since it cancels work and pauses dispatch.

Built-in presets cannot be overwritten or deleted; save a custom preset under another valid name. Preset application changes the active team and sessions while preserving project files. Deleted custom preset definitions have no dedicated undo; save the current roster again if it still represents the desired team. Preset archives require `/preset restore ARCHIVE_ID`, rather than an individual teammate restore.

## GitHub imports and external services

GitHub import commands require an installed, authenticated GitHub CLI and access to the requested repository. Check the exact service error, `OWNER/REPO` spelling, and positive issue or PR number. A malformed or mismatched response is rejected rather than used as another repository's task.

Imports do not automatically grant authorization to publish, push, or merge. If another service or external build is the blocker, identify the missing credential, account access, artifact, or service result. Crew cannot generate a real approval, production credential, or successful remote build merely by retrying a local assignment.

## Diagnostic checklist for an unlisted problem

Before retrying, collect:

1. The target folder from `/folder`, the workflow/task ID, and the latest error from the detail panel.
2. The command or message that triggered the failure and whether it ran in Crew or an external terminal.
3. Current queue state, task dependencies, and whether another writer, waiting question, or app instance is involved.
4. The teammate's role, requested task access, permission mode, and model override where relevant.
5. Actual tool output, exit code, and checks already attempted. Distinguish an observed failure from an assistant's interpretation.
6. Changes already made and what should be preserved before any retry, new workflow, or source restoration.
7. Node/Codex version and doctor results for startup or runtime problems; terminal details and a screenshot for display/input problems.

Redact credentials, account details, private paths, and sensitive transcript content before sharing diagnostics. Share the smallest relevant excerpt rather than the entire saved state. If no safe next action is evident, preserve the project and history and report the evidence instead of deleting data, changing global permissions, or repeatedly dispatching identical work.
