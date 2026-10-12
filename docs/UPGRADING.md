# Upgrading and recovering saved crews

[README](../README.md) | [Command reference](COMMANDS.md) | [Security](../SECURITY.md)

## State location and safe upgrades

Each target project stores its crew in `<project>/.pongkan-crew/state.json`. This directory contains private conversations, task results, archives and session IDs. Keep it ignored in the target project's Git repository. Updating Pongkan Crew's source does not require deleting this directory or reinstalling dependencies.

Close Pongkan Crew before replacing its source or backing up state. Keep a private backup of the target project's `.pongkan-crew` directory, then reopen the app for the same target folder. The source repository and target folder may be different. From the Pongkan Crew repository, for example:

```powershell
node .\src\cli.js --folder ..\todo-app
```

The app uses a folder lock and atomic state replacement. Do not edit state while it is running. History recovery restores conversations and configuration, not project file contents; keep project version control and backups separately.

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

Existing version-1 state remains supported. Conversation and schedule collections default to empty; original member transcripts and Codex session IDs remain the default individual chats. Named chats use separate saved histories and session IDs. `/conversation default NAME` returns to original history, and `/conversation default group` opens the original shared chat and project-wide workflow feed.

The workflow feed is derived from existing task records and needs no backfill. Named chats, worktree paths/branches, schedule claims, and steering instructions persist in `state.json`; explicit project memory is stored separately in `.pongkan-crew/project-memory.json`. Worktrees are retained and never automatically merged or removed. Legacy workflows keep their execution folder; only `--isolated` workflows use new worktrees. Interrupted work retains the existing explicit-recovery behavior.
