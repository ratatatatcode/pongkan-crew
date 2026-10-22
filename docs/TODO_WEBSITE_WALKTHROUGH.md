# Todo Website Walkthrough

[Back to README](../README.md)

Build the sample todo app in the `todo-app` folder with Next.js, shadcn/ui preset `b0`, and browser storage. The default Pongkan Crew (Chief, Researcher, Developer, Reviewer) was used.

![Todo app walkthrough](../assets/images/todo-result.gif)

[Download the full MP4](../assets/video/todo-result.mp4)

## 1. Create the Next.js app

Keep `pongkan-crew` and `todo-app` as sibling folders. Open PowerShell in the empty `todo-app` folder and run:

```powershell
npx.cmd create-next-app@latest . --use-npm --yes
```

The `.` means use the current folder. Wait for setup to finish before continuing.

## 2. Start Pongkan Crew for `todo-app`

From inside `todo-app`, run:

```powershell
node ..\pongkan-crew\src\cli.js --folder .
```

In the CLI, check the target and crew:

```text
/folder
/crew list
```

Use the default crew; no preset change is needed for this walkthrough.

Developer has write access and Reviewer is read-only by default. To set the modes explicitly for future turns, use `/permissions approve developer` and `/permissions read-only reviewer`. Approve for me uses Codex's workspace-write sandbox with automatic review; it does not grant Full Access. Crew's noninteractive runner may stop if a request needs a live approval prompt.

Crew interprets ordinary messages and routes them to a reply, assignment, discussion, or workflow based on your request. For a direct implementation request, send `@developer Replace the toggle labels with Show summary and Hide summary.` To coordinate implementation and independent review, use `/task` or `/crew-task`, or ask for it in plain language in Crew Chat.

If you update Crew while this terminal is open, restart when the source-change notice appears. Saved conversations remain available. A request interrupted before dispatch stays saved and can be resent; dispatched work can be resumed without repeating completed steps.

Add `.pongkan-crew/` to the todo project's `.gitignore` before committing project files. This folder holds private conversations and workflow state. To export finished discussions and work, enter `/markdown on`; Markdown files go to `docs/pongkan-docs/` and should be inspected before sharing.

## 3. Discuss the todo plan

Use F2 or Tab to open Crew Chat, then type this and press Enter:

```text
/discuss Plan our local todo app in this Next.js project using shadcn/ui preset b0 and browser localStorage. Agree on a responsive accessible interface with add, edit, complete, delete, All/Active/Completed filters, and a remaining count. Cover safe loading, invalid saved data, and visible storage errors. No backend or cloud services. Chief, summarize the plan and handoff. Do not edit files yet.
```

This starts a read-only shared discussion. When ready, address Developer to implement the agreed build, or use `/crew-task` for an explicit coordinated workflow. You can also approve the plan in your own words in Crew Chat, for example: `Proceed with what you've discussed.` Crew uses the recent discussion to interpret that follow-up. Directed messages sent while shared turns are active queue after them.

## 4. Build and review

### Option A: Give a complete build request

In Crew Chat, type this and press Enter. This request repeats the requirements so it can stand on its own:

```text
/task Build the local todo app in this existing Next.js folder. Chief: assign setup, implementation, README instructions, and checks to Developer, then request an independent review from Reviewer. Inspect existing files first. If shadcn is not configured, initialize it in this project with npx.cmd shadcn@latest init --preset b0; do not create another Next.js project or nested folder. Install any missing dependencies. Preserve the generated b0 theme and use its components and design tokens. Implement add/edit/complete/delete, All/Active/Completed filters, remaining count, blank-title rejection, responsive layout, and keyboard access. Store todos in browser localStorage with safe startup, invalid-data preservation, and visible storage errors. No backend, database, login, cloud sync, or remote runtime assets. Document how to run the app, run relevant checks, and report actual results and anything not checked. Do not commit, push, or deploy.
```

### Option B: Execute the discussed plan

In Crew Chat, use either example to start the implementation from the plan in step 3. Choose one; do not send both.

```text
/crew-task
# Or approve the plan in plain language:
Proceed with what you've discussed.
```

The `/crew-task` command uses the saved Crew Chat findings, so you do not need to repeat the agreed requirements. Wait for the discussion to finish before starting. The plain-language example works as a follow-up in Crew Chat; you do not need to type `/crew-task` with it. These are examples, not required phrases. Use one build option per run.

To approve the plan without a command, send this as its own message in Crew Chat:

```text
Proceed with what you've discussed.
```

### Follow progress

The lead selects one next action at a time, such as delegating a bounded implementation task or requesting independent review. Review findings can send specific work back to the responsible teammate. The lead summarizes only after an independent reviewer verifies the requested outcome; unresolved or unavailable checks remain visible. Actual teammate replies appear in the originating Crew Chat.

A **handoff** is the context passed between assignments: earlier findings, reported changes and checks, available changed-file names, and clarification answers. Teammates inspect the same project files; their private conversations are separate. Put decisions in Crew Chat or the build request so execution receives them.

Follow the work with:

```text
/activity
```

Use Tab or F2 to switch between Chat, Crew Chat, and Activity. Workflows explicitly started from Crew Chat keep the plan, live teammate replies, review, and final summary there. Activity lists task status and future assignments. Ask `What have you finished so far?` for a lead reply, use `/steer TASK_OR_WORKFLOW_ID Preserve keyboard access` to queue a workflow correction, and `/stop` to cancel current work. After a failure or restart, inspect `/workflow list` and use `/workflow resume ID` to continue unfinished steps without repeating completed ones.

Corrections take effect at the next task boundary. Stopping preserves file edits. `/workflow retry ID` starts a new attempt and can repeat completed steps, so use `/workflow resume ID` for recovery. For a reply from only Chief, use `@chief` in Crew Chat.

Before running the app, inspect `/changes` or `/diff` and read the final review. A completed workflow can still report unresolved defects or checks that were not run. Ask for a follow-up fix when needed.

### Optional isolated build

To execute the saved discussion in a separate Git worktree, use `/crew-task --isolated` after discussion finishes. Commit the todo project's baseline first: isolation starts from committed `HEAD`, so existing uncommitted changes are not copied. Inspect the retained worktree and branch afterward; Crew does not automatically commit, merge, push, or deploy. Run the commands in step 5 from that worktree if the implementation was isolated.

## 5. Run the app

Open a second terminal in `todo-app` and follow its README. For the npm setup above, run:

```powershell
npm.cmd run dev
```

Open the local address printed by Next.js, usually `http://localhost:3000`. Try adding, editing, completing, filtering, deleting, and refreshing todos in the same browser profile.

## What the sample uses

- Next.js, initialized in `todo-app` with `npx.cmd create-next-app@latest . --use-npm --yes`.
- The default Pongkan Crew, with Chief coordinating Developer and Reviewer.
- shadcn/ui preset `b0`, initialized by Developer in the existing Next.js project if needed.
- Browser `localStorage`; no backend or cloud service.
- Plain messages for direct teammate conversation; `/discuss`, `/crew-task`, `/steer`, and `/workflow resume` for explicit team orchestration.
