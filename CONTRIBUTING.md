# Contributing

Keep changes focused, explain their effect, and report your checks.

## Before you start

- Read the [README](README.md) and [command reference](docs/COMMANDS.md).
- Use the [Codex comparison](docs/CODEX_COMPARISON.md) to distinguish native capabilities from Crew's orchestration features.
- Discuss substantial changes in an issue first.
- Exclude credentials and `.pongkan-crew` conversation data.
- Submit only material you may contribute under the MIT License.

## Local development

Use Node.js 22 or newer. No npm runtime dependencies are needed; `npm ci` installs the locked development tools for linting and formatting.

```powershell
npm ci
node --test
node .\scripts\preview-display.js
node .\scripts\preview-display.js --activity
node .\scripts\check-syntax.js
npm run lint
npm run format:check
```

These checks run offline. Optional [live checks](README.md#development-checks) require Codex CLI and use your signed-in account.

Ordinary-message tests use the real delivery path and mock the Codex runner when execution is needed. `test/semantic-routing.test.js` also exercises retained semantic-router compatibility, schema parsing, request persistence, conversation isolation, access checks, and outcome verification. Ordinary sends bypass that interpreter. Keep all default tests offline. Dispatcher tests declare explicit mocked AI responses in `test/helpers/intent-decisions.json`, keyed by test scenario and response order. These fixtures never classify message text; missing responses fail instead of guessing an action. Do not reintroduce action-keyword matching or a silent discussion fallback. Keep saved history complete when limiting prompt context.

On Windows, `node scripts/check-terminal-input.js` checks wheel scrolling, Page Up/Down,
prompt history, Home/End and Space in a real terminal using synthetic console events
and a temporary project. It requires a working Codex login for app startup but sends
no agent tasks. Physical touchpad gestures still need a manual check.

## Pull requests

- Explain the problem and resulting behavior.
- Report check results and anything not checked. Automated CI runs tests and both offline previews across Linux and Windows on Node 22 and 24; linting, formatting, syntax, and repository hygiene run separately on Ubuntu with Node 22.
- Update usage docs when behavior changes.
- Keep the README, command reference, walkthrough, and recovery guidance consistent. Document handoff context, task-boundary corrections, review semantics, and session sharing. Update the [Markdown export contract](docs/MARKDOWN_SAVING_CONTRACT.md) when exports change. Historical audits must retain their original scope and date.
- Exclude generated output, local state, installed dependencies, and secrets.

## Security-sensitive changes

Read [SECURITY.md](SECURITY.md) before changing filesystem operations, process arguments or permissions. Preserve shell-free subprocess invocation, read-only task retries, private state handling, built-in preset protection and recoverable history. Add regression tests for path redirection and permission regressions using temporary fixtures; never use real system files or credentials. Update [command documentation](docs/COMMANDS.md) and in-app examples when changing commands.

Coordinator and state-migration changes must cover fresh default crews, older saved state, renamed coordinators, restart, preset restore and undo. Reject malformed destructive commands before mutating archives or saving state. Document migration and recovery steps in [UPGRADING.md](docs/UPGRADING.md). Keep migration fixtures synthetic and never commit a real `.pongkan-crew/state.json`.

## Preparing a public release

Follow the [public release checks](SECURITY.md#public-release-checks) and review the [release security audit](docs/RELEASE_SECURITY_AUDIT.md). Ignored files can still exist in old commits. Never run a contributor's scripts on a machine containing production credentials; review executable changes first and use a clean environment. Keep optional live Codex checks separate from offline CI.
