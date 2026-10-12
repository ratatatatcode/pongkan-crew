# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting if enabled. Otherwise, ask maintainers for a secure channel through a private contact listed on their GitHub profile. Exclude credentials and personal crew state.

Do not post exploit details publicly, even if no private contact is available. Response times are not guaranteed.

## Supported versions

Security fixes target the latest published version. Separate long-term support branches are not promised.

## Trust boundaries and file safety

Pongkan Crew is a local orchestrator, not an operating-system security boundary. Use an unprivileged account and a dedicated project folder. Run only trusted Codex executables; `PONGKAN_CODEX_BIN` and PATH select executable code. Repository instructions, custom roles, model replies, and tool output can contain malicious instructions. Role text and safety prompts do not enforce filesystem permissions.

Readers, discussions, planning and description assistance request Codex read-only access. Writers can select per-teammate Codex modes for future turns: Ask for approval uses workspace-write and requests approval for eligible access outside it; Approve for me uses Codex automatic review within workspace-write; Full Access removes the sandbox and runs without approval; Read Only blocks edits and escalation. Crew's noninteractive runner cannot answer live user approval prompts. A teammate's read-only role overrides modes that otherwise permit writing. Host Codex configuration, installed tools and approved escalations affect effective permissions. Review them before using an untrusted repository. No application-level promise can guarantee that an approved agent action never changes a system file. Use an isolated OS account or container for stronger separation.

Built-in UI commands for deleting presets or removing members only update local metadata. Preset deletion preserves the current crew and project files; member removal archives conversation history. Writer assignments may edit or delete project files. Stop/cancel preserves edits; history recovery does not roll back files.

Default and preset crews record explicit lead/reviewer identities. Coordinator renames preserve these identities; removal is rejected, and the designated reviewer cannot receive writer access through access or catalog-role commands. Invalid extra arguments to `/crew remove` are rejected before archiving or saving. Older default crews with both standard coordinator names acquire explicit coordination on load or preset-archive recovery; a formerly writable default Reviewer becomes read-only. This narrows access and preserves conversations. Customized legacy identities are not inferred. See [upgrade behavior](docs/UPGRADING.md).

State writes and folder locks reject symlink/junction state directories and linked or non-regular state files. State replacement uses an exclusively created random temporary file and atomic rename; rename failures never delete the existing state as a workaround. New directories/files request owner-only modes on platforms supporting Unix permissions. Windows permissions follow inherited ACLs. These checks defend against pre-existing redirected paths, not concurrent path replacement by another process with the same account privileges. Do not share a writable workspace with untrusted processes.

## Shared context and review

Ordinary messages go directly to the selected recipient with their configured permissions. The AI interprets the full request and conversation; no action-keyword classifier changes access or starts an automatic workflow. `@NAME` selects a recipient, and `/share` explicitly copies private context. Historical semantic-router records and validation remain for compatibility checks; ordinary sends do not invoke that interpreter. Read-only execution relies on Codex's sandbox; prompt instructions alone are not a tool-isolation boundary.

Historical edit workflows marked `requiresWrite` require a writable implementer and an independent outcome report; retries preserve that requirement. Ordinary direct turns and explicit workflows without that marker do not receive this additional structured verdict. A claimed passing report without a recorded successful reviewer inspection is marked unverified. Inspection activity and model judgments are evidence to assess, not a guarantee against defects or fabricated reasoning.

Workflow handoffs forward earlier completed task results, available changed-file names, and clarification answers to later Codex requests. Explicit sharing copies the latest private exchange into a shared discussion. Inspect what you share or export; separate chat sessions do not make shared project files private from other teammates. Corrections apply at task boundaries, and a completed workflow is not a security approval or a guarantee that review findings were resolved.

## Sensitive data and open-source contributions

Keep `.pongkan-crew/` out of version control in every target project: transcripts, task prompts/results, archives, session IDs and captured diffs can contain private data. Writer snapshots and untracked-file diff collection omit common credential filenames (`.env*`, private-key extensions, credential files) and credential/tool configuration directories. This is filename filtering, not secret detection. Explicit Git diffs can still show tracked secrets. Agent output and arbitrary source files can contain secrets too. Inspect and redact before sharing.

Never commit tokens, login files, private keys or personal state. Use synthetic fixtures in tests and report vulnerabilities privately as described above. The app uses the installed Codex login; it does not ask contributors to commit credentials. Run `node --test` before proposing changes to permission flags, subprocess invocation, path handling, state persistence or recovery.

## Public release checks

Before publishing a repository snapshot or release:

- Review tracked files and every reachable Git commit for secrets and private data. Ignoring a file does not remove earlier commits. If a credential was exposed, revoke or rotate it before considering history cleanup.
- Keep local crew state, environment files, private keys, and account configuration ignored. `.env.example` must contain placeholders only.
- Inspect screenshots, every animation/video scene, and media metadata for names, account details, private paths, tokens, or personal work. Text scans cannot read text rendered inside media.
- Review dependency and lifecycle-script changes. This repository currently has no npm dependencies or install hooks; `npm start` launches the application and `npm test` runs local tests. Optional live check scripts contact Codex using the user's account and are not part of `npm test`.
- Keep `private: true` until npm publication is intentional. Publishing the source on GitHub does not require changing it.
- If adding CI, give the workflow only the permissions it needs, pin external actions to reviewed full commit hashes, and never expose secrets or privileged execution to untrusted pull requests. Tests and package scripts from a pull request are executable code; use a clean runner without personal credentials.
- Enable GitHub private vulnerability reporting, secret scanning and push protection where available in repository settings. These settings are controlled on GitHub and are not enabled by this document.

See the [local release audit](docs/RELEASE_SECURITY_AUDIT.md) for the reviewed scope, results and remaining limits. Repeat the checks after adding files, changing history, updating dependencies or replacing demo media.

Context optimization is opt-in, local and does not grant additional permissions or call an external summarizer. Shortened context remains untrusted evidence, not authorization. Full original records remain private in local state; clipping is not redaction or a secret filter. Inspect original evidence when omissions could affect a safety or correctness decision.
