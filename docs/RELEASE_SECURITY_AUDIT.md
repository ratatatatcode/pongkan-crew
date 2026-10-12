# Open-source release security audit

Reviewed on 2026-10-11 against local HEAD `951ea57` and the current working tree, including the pending preset/help/security changes. This review did not publish, push, rewrite history, change GitHub settings, or inspect the ignored local conversation database.

## Outcome

No confirmed credential disclosure was detected in the checks below. The repository has no npm dependencies, install lifecycle hooks, active local Git hooks, or tracked GitHub Actions workflows. This is a scoped local review, not a security certification or exhaustive secret scan.

## Evidence and scope

| Area                      | Check                                                                                                                                     | Result                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git history               | All eight commits reachable from local refs; 78 distinct historical file blobs                                                            | No matches for the credential patterns checked; no historical paths for local crew state, environment secrets, private keys, or account configuration           |
| Current files             | 62 tracked/non-ignored files at scan time; local Git config also checked without printing its values                                      | No credential-pattern matches; one email match was the synthetic `test@example.invalid` fixture                                                                 |
| Secret patterns           | Private-key headers, AWS access keys, common GitHub/OpenAI/Slack tokens, credential-bearing HTTP URLs, and long quoted secret assignments | No matches; custom token formats, encoded/encrypted secrets, rendered media text and arbitrary high-entropy values are not comprehensively detected             |
| Personal paths            | Windows user-directory patterns in file content and history                                                                               | No matches; this does not cover every operating-system path format                                                                                              |
| Commit metadata           | Author/committer email metadata across local refs                                                                                         | One distinct non-noreply email is present. Public Git history exposes this metadata; it was not reproduced in this report or rewritten                          |
| Ignore rules              | Representative state, environment, account configuration and private-key paths checked with `git check-ignore`                            | All checked private paths ignored; `.env.example` remains available for placeholder templates                                                                   |
| npm dependencies          | `package.json`                                                                                                                            | No runtime, development, optional or bundled dependencies declared; no dependency lockfile needed for the current dependency-free package                       |
| Package scripts           | `start` and `test`; no `preinstall`, `install`, `postinstall` or other install hooks                                                      | Explicit start launches the app; tests run through Node's built-in runner. `private: true` prevents accidental npm publication                                  |
| Repository scripts        | Offline preview and optional live-check scripts inspected                                                                                 | Live checks use the user's Codex account and are explicitly separate from the test command; workflow live checks restrict work to a temporary read-only fixture |
| Git hooks and CI          | Local hooks and tracked workflow paths inspected                                                                                          | Only inactive `.sample` hooks; no workflow or submodule configuration tracked. No CI token permissions to tighten in this snapshot                              |
| Screenshot                | `assets/images/pongkan-crew-cli.png` visually reviewed                                                                                    | No obvious account information, credentials or personal absolute path visible                                                                                   |
| Animation                 | Nine evenly distributed samples from the 625-frame `todo-result.gif` visually reviewed                                                    | Samples show a generic todo demo with no obvious private information; not a frame-by-frame clearance                                                            |
| Video and binary metadata | Media included in raw-byte credential/email/path pattern scan                                                                             | No matches in available strings. MP4 playback/audio and complete structured media metadata were not reviewed; text scans do not inspect rendered video frames   |

The scan used local Git and Node tooling without sending repository data to an external service. Dedicated scanners such as Gitleaks and TruffleHog were not installed. It examined reachable history, not every unreachable object, reflog-only commit, external fork, remote-only branch, release attachment or hosted log.

## Changes made for release hygiene

- Extended `.gitignore` to cover common private keys, credential files, local account/agent configuration, and temporary audit output. Existing local data was preserved.
- Added release checks to `SECURITY.md` and contributor guidance to `CONTRIBUTING.md`.
- Kept `private: true` and the dependency-free package unchanged.
- Retained the earlier filesystem and permission hardening and its regression tests. See `SECURITY.md` for the runtime trust boundary; open-source publication does not make agent execution a sandbox by itself.

## Remaining release considerations

Before publication, decide whether the existing public author email is acceptable. Changing commit metadata would require deliberate history rewriting and coordination; this audit does not do that automatically. For future commits, configure a GitHub noreply address if desired.

Review the complete MP4, its audio if present, remaining GIF frames and structured media metadata before declaring all media cleared. The sampled animation and screenshot did not show an issue.

GitHub private vulnerability reporting, secret scanning, push protection and branch protection were not accessible through this local checkout. Enable the available protections in repository settings. Future CI should use minimal token permissions, reviewed actions pinned to full commit hashes, and no secrets in untrusted pull-request jobs.

Repeat secret/history checks before each release, especially after adding files or refs. Ignore rules do not retroactively remove committed material. If any real credential is found later, revoke/rotate it first and privately coordinate remediation.

## Validation

Ignore checks passed for `.pongkan-crew/state.json`, `.env`, `.env.local`, `.aws/credentials`, `.ssh/id_rsa`, `.codex/auth.json`, `.agents/settings.json`, `.npmrc`, `.pypirc`, `credentials.json` and `server.key`; `.env.example` is not ignored. The earlier implementation's full suite passed 112 tests, with 12 final focused checks also passing. This audit changes documentation and ignore configuration only; it does not change application behavior or rerun live Codex checks.

## Follow-up: coordinator and command validation fixes

A subsequent functional review found three pre-existing issues: renaming the default Chief broke task routing, the default Reviewer could gain writer access, and teammate removal ignored extra arguments. The current working tree fixes all three. Fresh and intact legacy default crews now record explicit coordination; renamed coordinators survive restart, reviewers remain read-only, and invalid removal syntax leaves members, archives and saved state unchanged.

Legacy default preset archives receive the same protection on restore and undo. Customized legacy identities are preserved without guessing; [UPGRADING.md](UPGRADING.md) documents an explicit recovery path and the private state-file location. README, command help, contributor guidance and the security policy describe the resulting behavior.

Follow-up verification: all 130 offline tests passed, including six coordinator regression tests. The live read-only workflow completed planning, research, independent review and summary against a temporary fixture, which remained unchanged. All 38 local Markdown links resolve, and the whitespace check passed. The earlier live connection and session-resume checks also passed. These checks do not change the original secret-scan scope, clear the remaining media/privacy considerations, or enable hosted GitHub security settings.

## Follow-up: CI/CD implementation and action hardening

Automated CI/CD workflows and Dependabot configuration were added under `.github/`. These changes follow the original audit snapshot above, which predates workflows and development dependencies:

- `.github/workflows/ci.yml`: Executes tests and both offline previews on `ubuntu-latest` and `windows-latest` with Node.js 22 and 24. A separate Ubuntu job with Node.js 22 installs development dependencies with `npm ci`, runs linting, formatting and JavaScript syntax validation, verifies `npm pack --dry-run`, and checks sensitive path ignore rules.
- `.github/workflows/release.yml`: Runs tests, builds a source archive and SHA-256 checksum, and publishes a GitHub release on version tags (`v*`) using GitHub's built-in CLI (`gh`). It does not create a draft or wait for the CI workflow to finish.
- `.github/dependabot.yml`: Tracks pinned GitHub Actions and npm development dependencies weekly. The app still has no npm runtime dependencies; `package-lock.json` locks the linting and formatting tools.

Security posture adheres to the guidelines in [SECURITY.md](../SECURITY.md):

- CI token permissions are restricted to `contents: read`.
- Both workflows pin external actions to full commit hashes: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1) and `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0). Pinning alone does not establish a security review of those revisions.
- The release workflow uses `contents: write` to publish release assets; the CI workflow retains read-only repository access.
- Offline CI runs without personal credentials or Codex secrets.
- Pull-request concurrency cancellation prevents stale redundant runs.
