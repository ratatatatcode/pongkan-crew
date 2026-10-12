# Markdown saving implementation contract

This contract covers the requested `/markdown on` and `/markdown off` feature and its implementation decisions.

## Commands and persistence

- `/markdown on` enables automatic Markdown exports for the selected project and creates `<selected-project>/docs/pongkan-docs/` recursively if missing. Repeating it is safe.
- `/markdown off` disables subsequent Markdown exports. Existing exported files and folders remain.
- `/markdown` reports the current mode and destination without changing either. Invalid arguments show usage without changing the mode.
- Store a boolean `markdownEnabled` in the application's existing per-project state. Missing values default to `false`; non-boolean values fail state validation. Restarting the application preserves the setting; another project has its own setting.
- Check the current mode when exporting, rather than capturing it when a task starts. A result arriving after `/markdown off` is not exported. Results arriving after `/markdown on` are exported even if their task started earlier.
- Enabling does not backfill existing history. The next change to an existing record exports its current complete snapshot, including earlier context belonging to that record.

## What is saved

Researcher's corrected scope treats “add” as adding the Markdown commands, not a new `/add` command or a change to `/crew add`. `/crew add` continues to add a teammate and does not create a Markdown result by itself.

- Export task records for individual assignments and workflow plan, work, review, and summary tasks. Include the task ID, member, kind, status, timestamps, original assignment, current response, clarification questions and answers, error when present, and captured changed-file names when available. Preserve available responses for failed, cancelled, interrupted, and waiting tasks.
- Export Crew Chat discussion records with discussion ID, status, timestamp, and the ordered user and assistant messages, with their speaker labels. Save incremental completed replies, not streamed tokens.
- Group replies with their assigned user prompt, even when another prompt was queued before those replies arrived. For new user messages, include Enter versus Shift+Left submission labels, submission timestamps, actual start timestamps when available, and a waiting status for queued prompts. Older messages without submission metadata retain their existing labels.
- Task exports can include discussion tasks as separate task records; discussion exports provide the complete ordered conversation view. This duplication is deliberate and each file identifies its record type.
- Do not export credentials, session identifiers, private state files, raw execution logs, or full captured diffs. Preserve the response's Markdown and avoid context-optimization clipping in exports.
- Do not create additional agent turns or change task/review success semantics. Export errors are separate from task failures.

## Filenames and iteration

- Task: `docs/pongkan-docs/task-<task-id>.md`.
- Discussion: `docs/pongkan-docs/discussion-<discussion-id>.md`.
- Use validated eight-character hexadecimal record IDs, never prompt text, member names, or user-supplied paths to construct filenames.
- Rewrite the same file with a complete snapshot whenever its record changes while enabled. Clarification continuations retain the task ID and update that task file. Repeated saves do not append duplicate content.
- Follow-ups queued during an active discussion retain its discussion ID and update the same export. They begin only after all turns for the earlier prompt finish. Follow-ups after completion create a new discussion ID and copy conversation history; earlier files remain historical snapshots.
- Task and workflow retries already create new task IDs, producing separate files. `/new` produces a separate discussion record and preserves earlier exports.
- Export after authoritative state saving succeeds. Changes to unrelated settings do not rewrite all historical exports. On restart, export records whose status is changed to interrupted when enabled; do not backfill unchanged records.

## Filesystem and failures

- Resolve exports against the application's canonical selected project folder. Create missing directories again when an enabled export needs them.
- Validate containment and reject symlinks/junctions or other redirection that would permit writes outside that folder. Reject unsafe destination files rather than following links.
- Windows exports hold read-access directory handles without delete sharing from the filesystem root through the export directory during creation, writing, replacement, and cleanup. Metadata-only handles do not provide the required rename protection. A PowerShell/.NET helper owns those handles for the entire operation.
- Linux exports traverse ancestors without following symlinks and use pinned directory descriptors via `/proc/self/fd`. This prevents path replacement from redirecting operations to a junction/symlink target. It does not prevent a process with the same filesystem permissions from moving the original opened directory elsewhere. Platforms without these supported primitives report an error rather than falling back to path-based writes.
- Only replace a destination identified as an exporter-owned file for that record, using a recognizable format marker and record ID. Report a conflict if an unrelated file occupies its filename.
- Write UTF-8 Markdown using a temporary sibling file and atomic replacement where supported. Preserve the previous complete export if writing fails. Never remove unrelated files or existing documents when turning saving off.
- If initial directory preparation fails, leave the toggle unchanged and show the error. If an enabled export later fails, retain authoritative task/discussion results and the enabled setting, and visibly report the failed path and reason. The next change to that record may retry; automatic historical recovery is outside this scope.

## Verification required for implementation

1. Default off, valid toggle commands, invalid arguments, repeated commands, and project-specific persistence across reload.
2. Recursive creation of missing `docs/pongkan-docs`; off retains existing files and prevents later writes, including active tasks completing after the toggle.
3. Stable task filenames, in-place continuation updates, distinct retry files, complete unclipped responses, and accurate failed/waiting/cancelled/interrupted status.
4. Incremental discussion replies, ordered speaker labels, follow-up snapshots, and separation after `/new`.
5. Enabling does not backfill unchanged history; a later changed record includes its complete current snapshot.
6. Visible directory/write errors without loss of authoritative results; unrelated filename conflicts and redirected paths cannot overwrite unrelated files or escape the project.

## Handoff

Completed: source inspection and implementation contract. Deliverable: this document. Assumptions: automatic saving covers task and discussion results; “add” introduces the commands; exports are snapshots rather than a manually curated journal. These follow Researcher's corrected scope. No material clarification remains under that scope.

Recommended next teammate: Chief to use this contract for the implementation assignment, then Developer to implement and Reviewer to verify. Runtime code and `.pongkan-crew` are unchanged by this assignment.
