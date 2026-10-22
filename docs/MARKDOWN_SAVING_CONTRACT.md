# Markdown saving implementation contract

This contract describes the current finished-record exporter in `src/markdown-export.js`. It supersedes the earlier incremental, per-task export design. See the [command reference](COMMANDS.md) for usage.

## Commands and persistence

- `/markdown on` enables automatic Markdown exports for the selected project and creates `<selected-project>/docs/pongkan-docs/` recursively if missing. Repeating it is safe.
- `/markdown off` disables subsequent Markdown exports. Existing exported files and folders remain.
- `/markdown` reports the current mode and destination without changing either. Invalid arguments show usage without changing the mode.
- `/markdown refresh` requires saving to be enabled. It regenerates finished exports and consolidates older exporter-owned task duplicates only after their combined document is safely written. It reports written/failed counts and preserves unrelated files.
- Store a boolean `markdownEnabled` in the application's existing per-project state. Missing values default to `false`; non-boolean values fail state validation. Restarting the application preserves the setting; another project has its own setting.
- Check the current mode when exporting, rather than capturing it when a task starts. A result arriving after `/markdown off` is not exported. Results arriving after `/markdown on` are exported even if their task started earlier.
- Enabling does not backfill existing history. The next change to an existing record exports its current complete snapshot, including earlier context belonging to that record.

## What is saved

`/crew add` adds a teammate. It is separate from the `/markdown` commands and does not create a Markdown export by itself.

`/briefing` is a local saved-state view. Watch alerts and daily briefing snapshots persist in the notification inbox in private `.pongkan-crew/state.json`; `/watch inbox` reads them. They do not create task records or separate Markdown exports, and `/markdown refresh` does not backfill them. `/watch clear` only clears the inbox. Finished standalone scheduled inspections are normal task records and follow the export rules below. Watch settings and `/markdown` settings remain independent.

- Export one combined document per finished workflow containing its goal, plan, assignments, coordination/revision turns, final review, and summary. Use one document title, task headings beneath it, and assignment/response subsections beneath each task; preserve response Markdown as supplied. Include available task IDs, members, kinds, statuses, timestamps, assignments, responses, clarification questions and answers, errors, and captured changed-file names.
- Export finished standalone assignments as task documents. Completed, failed, cancelled, and interrupted records preserve available results. Running, queued, and waiting records are not exported; workflows and discussions also wait for their associated tasks to settle.
- Export finished Crew Chat discussions with discussion ID, status, timestamp, and ordered user/assistant messages with speaker labels. Live progress stays in the app; exports do not stream incremental replies.
- Group replies with their assigned user prompt, even when another prompt was queued before those replies arrived. For new user messages, include Enter versus Shift+Left submission labels, submission timestamps, actual start timestamps when available, and a waiting status for queued prompts. Older messages without submission metadata retain their existing labels.
- Workflow steps and discussion turns do not create separate task exports. Refresh can remove older owned task duplicates after writing their combined workflow/discussion document.
- Do not add session identifiers, private state files, raw execution logs, or full captured diffs to exports. Preserve full response Markdown without context-optimization clipping. Prompts and responses can contain sensitive information; inspect before sharing. Exporting is not secret detection or redaction, and exports are not automatically supplied as model context.
- Do not create additional agent turns or change task/review success semantics. Export errors are separate from task failures.

## Filenames and iteration

- Task: `docs/pongkan-docs/task-<task-id>.md`.
- Workflow: `docs/pongkan-docs/workflow-<workflow-id>.md`.
- Discussion: `docs/pongkan-docs/discussion-<discussion-id>.md`.
- Use validated eight-character hexadecimal record IDs, never prompt text, member names, or user-supplied paths to construct filenames.
- Rewrite the same file with a complete snapshot when its eligible finished record changes while enabled. Workflow resume and clarification continuations retain IDs; the export updates when work finishes again. Repeated saves do not append duplicate content. Refresh explicitly regenerates unchanged finished records.
- Follow-ups queued during an active discussion retain its discussion ID and update the same export. They begin only after all turns for the earlier prompt finish. Follow-ups after completion create a new discussion ID and copy conversation history; earlier files remain historical snapshots.
- Task and workflow retries already create new task IDs, producing separate files. `/new` produces a separate discussion record and preserves earlier exports.
- Export after authoritative state saving succeeds. Changes to unrelated settings do not rewrite all historical exports. On restart, export records whose status is changed to interrupted when enabled; do not backfill unchanged records.

## Filesystem and failures

Historical semantic-routing records remain in authoritative state; ordinary sends use task and conversation records directly. Linked workflow exports include original submitted requests, their submission metadata (label missing legacy submission methods as not recorded), and the requested-outcome verdict and criteria when available. A blocked or interrupted routing request is not a completed workflow and does not create its own Markdown file. Prompt context may use bounded excerpts without truncating saved records or exports.

- Resolve exports against the application's canonical selected project folder. Create missing directories again when an enabled export needs them.
- Validate containment and reject symlinks/junctions or other redirection that would permit writes outside that folder. Reject unsafe destination files rather than following links.
- Windows exports hold read-access directory handles without delete sharing from the filesystem root through the export directory during creation, writing, replacement, and cleanup. Metadata-only handles do not provide the required rename protection. A PowerShell/.NET helper owns those handles for the entire operation.
- Linux exports traverse ancestors without following symlinks and use pinned directory descriptors via `/proc/self/fd`. This prevents path replacement from redirecting operations to a junction/symlink target. It does not prevent a process with the same filesystem permissions from moving the original opened directory elsewhere. Platforms without these supported primitives report an error rather than falling back to path-based writes.
- On Linux, enabling exports restricts `docs/pongkan-docs/` to owner-only access (`0700`), including when the directory already exists. New or replaced export files are owner-only (`0600`). This also restricts access to unrelated files placed inside that export directory. Existing export files retain their individual modes until replaced, but the directory restriction applies immediately. Windows exports use inherited ACLs; Crew does not change them.
- Only replace a destination identified as an exporter-owned file for that record, using a recognizable format marker and record ID. Report a conflict if an unrelated file occupies its filename.
- Write UTF-8 Markdown using a temporary sibling file and atomic replacement where supported. Preserve the previous complete export if writing fails. Never remove unrelated files or existing documents when turning saving off.
- If initial directory preparation fails, leave the toggle unchanged and show the error. If an enabled export later fails, retain authoritative results and the enabled setting, and visibly report the failed path and reason. Use refresh to retry without requiring a result change.

## Verification required for implementation

1. Default off, valid toggle commands, invalid arguments, repeated commands, and project-specific persistence across reload.
2. Recursive creation of missing `docs/pongkan-docs`; off retains existing files and prevents later writes, including active tasks completing after the toggle.
3. Stable filenames, continuation updates after completion, distinct retry files, complete unclipped responses, and accurate failed/cancelled/interrupted status. Running/waiting work produces no exports.
4. Combined workflow/discussion records after associated tasks settle, ordered speaker labels, submission metadata, follow-up snapshots, and separation after `/new`.
5. Enabling does not backfill unchanged history; a later changed record includes its complete current snapshot.
6. Visible directory/write errors without loss of authoritative results; unrelated filename conflicts and redirected paths cannot overwrite unrelated files or escape the project.

7. Refresh regenerates historical finished records and consolidates only exporter-owned task duplicates after a successful combined write.
8. Linux export directory and file permissions are owner-only; Windows continues to use inherited ACLs.

These expectations describe behavior to verify, not a new test report. See [Contributing](../CONTRIBUTING.md) for current development checks.
