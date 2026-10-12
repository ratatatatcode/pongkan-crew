# Todo Website Walkthrough

[Back to README](README.md)

Build the sample todo app in the `todo-app` folder with Next.js, shadcn/ui preset `b0`, and browser storage. The default Pongkan Crew (Chief, Researcher, Developer, Reviewer) was used.

![Todo app walkthrough](assets/images/todo-result.gif)

[Download the full MP4](assets/video/todo-result.mp4)

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

## 3. Discuss the todo plan

At the CLI prompt, enter this in Chat:

```text
/discuss Plan our local todo app in this Next.js project using shadcn/ui preset b0 and browser localStorage. Agree on a responsive accessible interface with add, edit, complete, delete, All/Active/Completed filters, and a remaining count. Cover safe loading, invalid saved data, and visible storage errors. No backend or cloud services. Chief, summarize the plan and handoff. Do not edit files yet.
```

`/discuss` is a read-only shared conversation. Wait for it to finish before starting the build. Choose `/task` below for a self-contained build request, or `/crew-task` to build from the latest Crew Chat plan.

## 4. Build and review

### Option A: Use `/task`

In Chat, send this to Chief. This request repeats the requirements so it can stand on its own:

```text
/task Build the local todo app in this existing Next.js folder. Chief: assign setup, implementation, README instructions, and checks to Developer, then request an independent review from Reviewer. Inspect existing files first. If shadcn is not configured, initialize it in this project with npx.cmd shadcn@latest init --preset b0; do not create another Next.js project or nested folder. Install any missing dependencies. Preserve the generated b0 theme and use its components and design tokens. Implement add/edit/complete/delete, All/Active/Completed filters, remaining count, blank-title rejection, responsive layout, and keyboard access. Store todos in browser localStorage with safe startup, invalid-data preservation, and visible storage errors. No backend, database, login, cloud sync, or remote runtime assets. Document how to run the app, run relevant checks, and report actual results and anything not checked. Do not commit, push, or deploy.
```

### Option B: Use `/crew-task`

After the discussion in step 3 finishes, run this from any tab to use its plan as context:

```text
/crew-task Build the agreed local todo app in this existing Next.js folder. Chief: assign setup, implementation, README instructions, and checks to Developer, then request an independent review from Reviewer. Inspect existing files first. If shadcn is not configured, initialize it here with npx.cmd shadcn@latest init --preset b0; do not create another Next.js project or nested folder. Install missing dependencies and preserve the generated b0 theme, components, and design tokens. Reject blank titles and preserve invalid saved data. No backend, database, login, cloud sync, or remote runtime assets. Document how to run the app, run relevant checks, and report actual results and anything not checked. Do not commit, push, or deploy.
```

You can also enter `/crew-task` without a goal to ask Chief to implement the agreed plan. The explicit goal above adds setup details and constraints to that plan. Use one build option per run.

### Follow progress

Follow the work with:

```text
/activity
```

Use Tab or F2 to switch between Chat, Crew Chat, and Activity. The `/task` option above opens Chief's individual Chat, with work and teammate handoffs in individual chats and Activity. `/crew-task` opens Crew Chat, where the lead's plan, teammate replies, review, and final summary appear as turns finish.

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
- `/discuss` for planning, then either `/task` or `/crew-task` for implementation and review.
