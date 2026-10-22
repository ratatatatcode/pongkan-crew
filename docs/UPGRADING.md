# Upgrading and recovering saved crews

[README](../README.md) | [Command reference](COMMANDS.md) | [Security](../SECURITY.md)

## Lead-led messages and incremental context

Restart with `/restart` after updating. Crew Chat and Activity interpret ordinary requests through the lead: advice, greetings, and status normally get one read-only reply; work requests start a lead-led workflow with useful bounded delegation and independent review. Approvals can execute a discussed plan, waiting for active discussion to finish. Use `/discuss TOPIC` for two full read-only rounds and a lead summary, or explicitly request multiple teammates' perspectives for one round. Private chats and `@NAME` keep their explicit recipient, with interpretation when unfinished workflow work needs coordination.

Resumed private sessions no longer replay their local transcript. Discussion and lead-workflow sessions skip unchanged shared records already supplied successfully to that session, while keeping the latest request, assignment, permissions, and clarification answers explicit. Optional per-session fingerprints persist in version-1 state; older state needs no migration and gets a normal snapshot first. Fresh or replaced sessions also get a snapshot. Full saved history and Markdown exports are preserved; clipping, session context, and token billing still apply. No sessions are reset automatically and no saved work resumes merely because source was updated.

Failed workflow status is shorter in Chat, with full errors retained in Activity/details. Unavailable-access blockers require post-review operation evidence from an authorized writer when one exists; a failed reviewer check alone is insufficient. Independent review stays read-only.

## Project briefings and watch settings

Restart Crew from the updated source, targeting the same project folder. `/briefing` is available immediately. State remains version 1: projects without watch settings load with watch off, a 09:00 machine-local briefing time, and empty notification and deduplication records. Existing tasks, conversations, schedules, and permissions are preserved; no history backfill or model call is needed.

Enable `/watch on [HH:MM]` per project. The enabled setting, chosen time, last briefing date, notification inbox, and deduplication records persist in `.pongkan-crew/state.json`. `/watch inbox` retains the latest 50 notifications after restart. Unchanged alerts and already delivered daily briefings are not repeated; enabling watch skips existing completions while leaving pending questions and failures eligible. Invalid explicit watch records fail state validation rather than being reset silently.

The app or worker must stay running to check watch state. Saved unfinished work still needs its normal explicit inspection and resume; enabling watch does not restart it. `/watch off` retains notifications and time settings and leaves recurring schedules enabled. Briefing snapshots are saved in the inbox, independently of `/markdown` exports. See the [command guide](COMMANDS.md#project-briefings-and-proactive-watch) for setup and limits.

## Reports, usage, templates, and command discovery

Restart with `/restart` after updating. `/commands` opens the searchable picker; `/workflow report ID` and `/workflow criteria ID` expose work and review evidence. `/search TEXT` searches saved history and memory without a model call. `/worktree review ID` previews readiness without merging branches.

State remains version 1. Older state loads with an empty template list and no usage totals. Existing conversations, tasks, and workflows are preserved. New templates and measured usage persist in `.pongkan-crew/state.json`; malformed template or usage records fail validation. Keep a private backup before repairing state manually.

Usage starts with newly measured turns, including routing. Historical token counts cannot be reconstructed and missing usage remains unavailable. Criteria need no backfill: reports use saved evidence and identify missing or invalidated acceptance. No state deletion, dependency installation, or model call is required to enable these views.

## State location and safe upgrades

Older active and archived teammate records without `codexPermissions` receive the legacy default `approve` on load. Explicit permission modes and role write/read settings are preserved. This includes history created by fresh-chat and isolation operations; those archives do not need to be deleted to reopen a project. Invalid explicit modes still fail validation.

Each target project stores its crew in `<project>/.pongkan-crew/state.json`. This directory contains private conversations, task results, archives and session IDs. Keep it ignored in the target project's Git repository. Updating Pongkan Crew's source does not require deleting this directory or reinstalling dependencies.

Close Pongkan Crew before replacing its source or backing up state. Keep a private backup of the target project's `.pongkan-crew` directory, then reopen the app for the same target folder. The source repository and target folder may be different. From the Pongkan Crew repository, for example:

```powershell
node .\src\cli.js --folder ..\todo-app
```

The app uses a folder lock and atomic state replacement. Do not edit state while it is running. History recovery restores conversations and configuration, not project file contents; keep project version control and backups separately.

After updating recovery code, restart the app to load it. Existing execution records remain readable, including older error-category fields, but those fields no longer select recovery actions. New direct-task recovery decisions and their evidence are saved with the original task. Saved work remains paused on restart, and cancelled work is not resurrected. During active execution, direct turns and workflows handle failed turns automatically through AI assessment while retaining their selected permission modes.

Private sends and explicit mentions normally bypass classification, preserving the selected recipient and access. Shared ordinary requests use semantic routing, and unfinished workflow follow-ups can resume or correct existing assignments. Explicit workflow commands remain available. Existing saved tasks, workflows, messages, and router input records remain readable.

## Default coordinator migration

Fresh crews explicitly designate `chief` as lead and `reviewer` as reviewer. Older state without explicit coordination upgrades automatically when both those teammates still exist. Their messages, roles and sessions remain intact. The Reviewer becomes read-only if an earlier version allowed write access. A saved explicit coordination configuration is validated and retained rather than replaced.

The same default-coordinator normalization applies when restoring or undoing an older complete-crew preset archive. Default coordinator renames remain saved: `/crew rename chief boss` keeps `/task` routed to Boss after restart, and the designated reviewer remains protected under its new name. Applying another preset selects its lead and reviewer.

Lead and reviewer must be different existing teammates; the reviewer must remain read-only. Neither coordinator can be removed directly. Regular teammate removal archives its conversation, and `/undo` can recover it. Removal commands accept exactly one teammate name; extra arguments cause a usage error without changing the crew or archives.

## Previously renamed or removed coordinators

If an older version renamed or removed a default coordinator before recording coordination, the app cannot safely infer whom you intended to appoint. It preserves the roster and history. `/task` may report an unknown default teammate until you select explicit coordinators.

First use `/crew list` and `/status` to inspect the actual names. Stop outstanding work with `/stop all`. For a legacy crew containing `boss` and a read-only `auditor`, enter these commands separately:

```text
/crew access auditor read
/preset save recovered-team boss auditor
/preset show recovered-team
/preset apply recovered-team
```

Choose an unused custom preset name and substitute your actual teammates. If the selected reviewer is missing, add one with `/crew add auditor --role qa-reviewer` first. Review the saved preset before applying it. Applying archives the current crew and starts fresh sessions; it does not modify project files. The old conversations remain in the complete-crew archive listed by `/archives`. Restoring an old customized archive without recorded coordination can require these recovery steps again.

## Invalid state

Malformed JSON or an invalid explicit coordinator configuration is rejected rather than overwritten. Keep the original file and a private backup; do not delete state or guess changes to session IDs. Reports to maintainers should include the error and a synthetic reproduction, not the private state file. Follow [SECURITY.md](../SECURITY.md) if the report involves sensitive information.

## Named conversations and workflow workspaces

Existing version-1 state remains supported. Conversation and schedule collections default to empty; original member transcripts and Codex session IDs remain the default individual chats. Named chats use separate saved histories and session IDs. `/conversation default NAME` returns to original history, and `/conversation default group` opens the original shared chat with its associated workflow replies.

The workflow feed is derived from existing task records and needs no backfill. Named chats, worktree paths/branches, schedule claims, and steering instructions persist in `state.json`; explicit project memory is stored separately in `.pongkan-crew/project-memory.json`. Worktrees are retained and never automatically merged or removed. Legacy workflows keep their execution folder; only `--isolated` workflows use new worktrees. When resumed or recovered, older unmarked workflow records adopt the persistent lead engine: completed task results and artifacts remain intact, while the lead reassesses unfinished work instead of replaying the old pipeline. Records explicitly marked legacy retain their original pipeline. `/workflow resume ID` continues unfinished work; `/queue resume` dispatches queued work, and failed standalone tasks use `/queue retry ID`.

## Plain messages and recovery

Workflow handoffs use saved completed task results, available changed-file names, and clarification answers. These records preserve the execution chain; they do not merge private chats or guarantee that all earlier text fits into each Codex request. Full results remain in saved history. New Crew Chat workflows keep real member replies visible while the persistent lead chooses the next action; workflow sessions remain separate from private chat sessions. Explicit legacy workflows can retain their briefing, feedback, and worker-response turns.

Corrections saved during execution apply at task boundaries. New lead workflows complete only after independent review verifies the requested outcome. Older explicit legacy workflows may complete with unresolved narrative review findings; inspect those reports before treating the work as accepted. Recovery never restores or rolls back project files.

Restart the CLI from the updated Pongkan Crew source repository, targeting the same project folder. An already-running Node process keeps using the code it loaded before the update. You do not need to delete saved state.

Type normally: each message goes to its recipient AI, which interprets the full request. Individual Chat addresses the selected teammate; Crew Chat and Activity address the lead unless you use `@NAME`. Use `/crew-task` after a discussion finishes for coordinated execution, `/steer ID TEXT` for a workflow correction, and `/answer TASK_ID TEXT` for a waiting assignment. No particular action verb is required.

After a failure or restart, inspect `/queue list` and `/workflow show ID`. `/workflow resume ID` resumes unfinished steps using existing workflow and task IDs, preserving completed steps and partial findings while leaving unrelated paused assignments paused. Use `/queue resume` to release all eligible queued work. Restart an interrupted discussion with `/discuss TOPIC` or send a new direct message. `/workflow retry ID` starts a new attempt that may repeat completed work. When unfinished workflow tasks belong to the current conversation, ordinary follow-ups are interpreted against that workflow and can resume it; unrelated conversations keep direct delivery.

Older group workflow messages are retained but isolated from personal transcripts on load. Personal sessions containing those old group turns are reset so later private turns do not resume the mixed context. Existing private messages remain available. New group workflows use separate execution sessions and show replies in Crew Chat, with future assignments in Activity.

Changing a teammate's model affects future turns and preserves previous errors in saved history. It does not automatically resume a failed workflow. After changing the affected teammate's model, use `/workflow resume ID` for the affected workflow. If the same capacity error occurs on the new attempt, it remains a service/model availability blocker; resuming does not guarantee it has cleared.

## Bounded workflow recovery

`/recovery [WORKFLOW_ID]` is an explicit request for fresh diagnosis. It renews the two-attempt budget and bypasses obsolete recovery branches while retaining completed original assignments and saved findings. Without an ID, selection stays within the current conversation. Active and completed workflows are rejected. Ordinary `/workflow resume ID` retains its existing budget and dependency behavior.

See [Troubleshooting blocked workflows](WORKFLOW_TROUBLESHOOTING.md) for symptoms, recovery commands, and manual handoff examples.

Existing workflow records remain compatible; an absent recovery-attempt count means zero attempts. New workflows can insert coordinator recovery decisions and prerequisite assignments after a `PONGKAN_BLOCKED` report, with two automatic attempts before stopping. An explicit /recovery request renews this budget. Review handoffs remain read-only; prerequisite edits require an existing implementation assignment and retain the selected teammate's permissions. Recovery metadata and the existing dependency chain are saved together. Restart still marks unfinished workflows interrupted and requires explicit `/workflow resume ID`; recovery never silently restores or rolls back source files. Completed steps and configured permissions remain intact.
