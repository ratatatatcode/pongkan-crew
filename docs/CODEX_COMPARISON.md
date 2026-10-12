# Pongkan Crew and Codex CLI

[README](../README.md) | [Commands](COMMANDS.md) | [Walkthrough](TODO_WEBSITE_WALKTHROUGH.md)

Checked on 2026-10-12 against installed Codex CLI **0.162.1**, its command help, official documentation, and Crew's source. This is a capability comparison, not a quality, latency, or token-cost benchmark. Account, configuration, and version affect availability.

## Native capabilities and Crew's additions

Codex supplies code exploration, editing, shell tools, tests, image inputs, web search, skills, plugins, and MCP integration. Crew uses Codex for execution; it does not provide a separately trained coding engine. See the [official CLI overview](https://learn.chatgpt.com/docs/codex/cli).

| Area                        | Codex CLI                                                            | Crew's current behavior                                                                                           |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Planning and implementation | Agent plans and executes work                                        | Lead produces validated sequential assignments with saved dependencies                                            |
| Specialists                 | Native parallel subagents and custom agents                          | Named roster, role catalog, personalities, and team presets; members are instructed not to spawn agents           |
| Review                      | Dedicated review against changes, commits, or branches               | Read-only reviewer stage; Crew Chat adds feedback and worker response before final review                         |
| Sessions                    | Resume, fork, archive, unarchive, and delete                         | Own named private/shared conversations and archive management backed by Codex sessions; no session-fork interface |
| Queues and visibility       | Agent-session browser and message queue                              | Task queue, waiting questions, dependencies, Activity, and saved workflow progress                                |
| Isolation                   | Managed worktree option in installed `codex exec --help`             | Creates and retains workflow worktrees from committed HEAD                                                        |
| Automation                  | Non-interactive runs, JSON events, structured output, scripts and CI | Uses exec internally; adds recurring assignments and a worker process                                             |
| Project guidance            | Project instructions and custom configuration                        | Editable memory entries injected into assignments                                                                 |
| Integrations                | Plugin and MCP management                                            | Can inherit Codex configuration; no dedicated management interface                                                |
| Inputs and controls         | Image attachments, search, profiles, permissions, local providers    | Text composer and per-member model/effort controls; other features are not fully exposed                          |
| Context and usage           | Compaction and configurable context/token/rate-limit status          | Local handoff/history clipping and character statistics; no equivalent usage dashboard                            |
| Cloud and remote            | Cloud commands and remote server connections                         | No dedicated integration                                                                                          |
| Records                     | Saved sessions and machine-readable execution output                 | Combined finished workflow/discussion Markdown exports                                                            |
| Maintenance                 | Login, update, doctor, completion, feature and debug commands        | Runtime checks and own command completion; relies on an installed, signed-in Codex                                |

Codex's [command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli) documents native controls and automation. The installed CLI help additionally confirms agent browsing, message queues, and managed worktrees. Native [subagents and custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents) support specialization, parallel delegation, and per-agent configuration; those are not unique Crew features.

## Advantages

- A repeatable plan, assignment, review, and summary sequence without manually arranging every handoff.
- Saved workflow records and recovery of unfinished steps while preserving completed assignments.
- Shared discussions and private teammate conversations in one project workspace.
- Direct delivery of ordinary messages to the selected teammate AI, with shared conversation context and configured access. Explicit workflows provide saved assignments and task-boundary corrections.
- Ready-made teams and explicit lead/reviewer identities.
- Coordination of Crew-managed writers, with separate worktrees for isolated workflows.
- Combined Markdown records, editable project guidance, recurring assignments, and GitHub issue-to-workflow commands.

These advantages primarily reduce setup and coordination effort. Names and personalities aid navigation; they do not establish greater expertise.

## Disadvantages and limits

- Planned workflow steps are sequential. Independent eligible tasks or isolated workflows can run through the scheduler, but the plan is not a parallel dependency graph.
- Ordinary sends queue one recipient turn without an intent classifier or automatic workflow. Explicit crew discussions and workflows add turns. Their quality benefit and total cost have not been benchmarked.
- Private and group sessions have separate context. Handoffs carry findings, available changed-file names, and answers, not every conversation. Long context may be shortened.
- Corrections apply at task boundaries rather than interrupting the current Codex turn.
- Workflow completion means its turns finished. Historical edit workflows marked for outcome verification additionally report met, needs work, or unverified after independent review; incomplete evidence cannot establish success. Other explicit workflows retain their existing review reports.
- Image attachments, native session forking, usage dashboards, integration management, and cloud/remote controls are not exposed in Crew's interface.
- Schedules require the app or worker to run. History recovery does not roll back project files; isolated worktrees are not automatically merged or removed.
- Crew adds state, subprocess, and orchestration maintenance on top of Codex. Compatibility depends on its CLI flags and event protocol.
- The sandbox comes from Codex. Crew's coordination and prompts are not an operating-system security boundary; see [Security](../SECURITY.md).

## Positioning

Pongkan Crew is a persistent team workflow workspace powered by Codex. Its current value is making coordinated work easier to direct, inspect, document, and resume. Better coding results, lower consumption, and faster completion remain claims to measure rather than assumptions.
