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

`/discuss` is a read-only shared conversation. Its messages do not automatically become the next `/task` instructions, so the build request below repeats the requirements.

## 4. Build and review

In Chat, send this to Chief:

```text
/task Build the local todo app in this existing Next.js folder. Chief: assign setup, implementation, README instructions, and checks to Developer, then request an independent review from Reviewer. Inspect existing files first. If shadcn is not configured, initialize it in this project with npx.cmd shadcn@latest init --preset b0; do not create another Next.js project or nested folder. Install any missing dependencies. Preserve the generated b0 theme and use its components and design tokens. Implement add/edit/complete/delete, All/Active/Completed filters, remaining count, blank-title rejection, responsive layout, and keyboard access. Store todos in browser localStorage with safe startup, invalid-data preservation, and visible storage errors. No backend, database, login, cloud sync, or remote runtime assets. Document how to run the app, run relevant checks, and report actual results and anything not checked. Do not commit, push, or deploy.
```

Follow the work with:

```text
/activity
```

Use Tab or F2 to switch between Chat, Crew Chat, and Activity. `/task` work and teammate handoffs appear in individual chats and Activity; they are not copied into Crew Chat.

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
- `/discuss` for planning and `/task` for implementation and review.
