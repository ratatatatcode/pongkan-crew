# Upgrading and recovering saved crews

[README](../README.md) | [Command reference](COMMANDS.md) | [Security](../SECURITY.md)

## State location and safe upgrades

Older active and archived teammate records without `codexPermissions` receive the legacy default `approve` on load. Explicit permission modes and role write/read settings are preserved. This includes history created by fresh-chat and isolation operations; those archives do not need to be deleted to reopen a project. Invalid explicit modes still fail validation.

Each target project stores its crew in `<project>/.pongkan-crew/state.json`. This directory contains private conversations, task results, archives and session IDs. Keep it ignored in the target project's Git repository. Updating Pongkan Crew's source does not require deleting this directory or reinstalling dependencies.

Close Pongkan Crew before replacing its source or backing up state. Keep a private backup of the target project's `.pongkan-crew` directory, then reopen the app for the same target folder. The source repository and target folder may be different. From the Pongkan Crew repository, for example:

```powershell
node .\src\cli.js --folder ..\todo-app
```

The app uses a folder lock and atomic state replacement. Do not edit state while it is running. History recovery restores conversations and configuration, not project file contents; keep project version control and backups separately.

Ordinary sends now bypass intent interpretation entirely. Crew Chat goes to the designated lead; `@NAME` goes to the named teammate; private Chat goes to the selected teammate. Direct Developer turns retain write access. No automatic plan, revision, review, or summary is scheduled. Explicit workflow commands remain available. Restart after updating source; existing saved tasks, workflows, and messages remain intact. Old router input records remain readable but new sends use durable task and conversation records.

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

The workflow feed is derived from existing task records and needs no backfill. Named chats, worktree paths/branches, schedule claims, and steering instructions persist in `state.json`; explicit project memory is stored separately in `.pongkan-crew/project-memory.json`. Worktrees are retained and never automatically merged or removed. Legacy workflows keep their execution folder; only `--isolated` workflows use new worktrees. Use `/workflow resume ID` to continue an interrupted workflow while retaining its completed steps. `/queue resume` dispatches queued work; failed standalone tasks use `/queue retry ID`.

## Plain messages and recovery

Workflow handoffs use saved completed task results, available changed-file names, and clarification answers. These records preserve the execution chain; they do not merge private chats or guarantee that all earlier text fits into each Codex request. Full results remain in saved history. Crew Chat executions use separate execution sessions and include briefing, feedback, and worker-response turns alongside implementation.

Corrections saved during execution apply at task boundaries. A completed workflow may still contain unresolved review findings; start a follow-up request for those findings rather than trying to resume an already completed workflow. Recovery never restores or rolls back project files.

Restart the CLI from the updated Pongkan Crew source repository, targeting the same project folder. An already-running Node process keeps using the code it loaded before the update. You do not need to delete saved state.

Type normally: each message goes to its recipient AI, which interprets the full request. Individual Chat addresses the selected teammate; Crew Chat and Activity address the lead unless you use `@NAME`. Use `/crew-task` after a discussion finishes for coordinated execution, `/steer ID TEXT` for a workflow correction, and `/answer TASK_ID TEXT` for a waiting assignment. No particular action verb is required.

After a failure or restart, inspect `/queue list` and `/workflow show ID`. `/workflow resume ID` resumes unfinished steps using existing workflow and task IDs, preserving completed steps and partial findings while leaving unrelated paused assignments paused. Use `/queue resume` to release all eligible queued work. Restart an interrupted discussion with `/discuss TOPIC` or send a new direct message. `/workflow retry ID` starts a new attempt that may repeat completed work. Plain `continue` reaches the recipient AI and does not mutate workflow status.

Older group workflow messages are retained but isolated from personal transcripts on load. Personal sessions containing those old group turns are reset so later private turns do not resume the mixed context. Existing private messages remain available. New group workflows use separate execution sessions and show replies in Crew Chat, with future assignments in Activity.

Changing a teammate's model affects future turns and preserves previous errors in saved history. It does not automatically resume a failed workflow. After changing the affected teammate's model, use `/workflow resume ID` for the affected workflow. If the same capacity error occurs on the new attempt, it remains a service/model availability blocker; resuming does not guarantee it has cleared.

## Bounded workflow recovery

`/recovery [WORKFLOW_ID]` is an explicit request for fresh diagnosis. It renews the two-attempt budget and bypasses obsolete recovery branches while retaining completed original assignments and saved findings. Without an ID, selection stays within the current conversation. Active and completed workflows are rejected. Ordinary `/workflow resume ID` retains its existing budget and dependency behavior.

See [Troubleshooting blocked workflows](WORKFLOW_TROUBLESHOOTING.md) for symptoms, recovery commands, and manual handoff examples.

Existing workflow records remain compatible; an absent recovery-attempt count means zero attempts. New workflows can insert coordinator recovery decisions and prerequisite assignments after a `PONGKAN_BLOCKED` report, with two automatic attempts before stopping. An explicit /recovery request renews this budget. Review handoffs remain read-only; prerequisite edits require an existing implementation assignment and retain the selected teammate's permissions. Recovery metadata and the existing dependency chain are saved together. Restart still marks unfinished workflows interrupted and requires explicit `/workflow resume ID`; recovery never silently restores or rolls back source files. Completed steps and configured permissions remain intact.
