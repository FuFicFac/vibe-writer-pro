# Codex Desktop Setup Guide for Vibe Writer

Use this guide (or paste the prompt at the bottom into Codex Desktop) to set up Vibe Writer on a new machine.

## Goal

Set up Vibe Writer so it can:

- run locally (`Vite` dev server)
- use local AI via `codex` CLI (OpenAI OAuth / ChatGPT session)
- export/import projects
- preserve work safely

## What Vibe Writer Checks on Startup

Vibe Writer's onboarding/startup check currently verifies:

- whether a local CLI is installed (`codex` preferred)
- whether CLI auth/session is available
- whether fallback CLIs are present (`openai`, `claude` if installed)

If the required CLI/auth is missing, the app can show prerequisite instructions in the onboarding UI.

## Prerequisites (Manual)

### 1. Install Node.js (if needed)

Check:

```bash
node --version
npm --version
```

If either command fails, install Node.js (LTS) first.

### 2. Install Codex CLI (preferred AI path)

Check:

```bash
codex --version
```

Install (if missing):

```bash
npm install -g @openai/codex
```

### 3. Log in to Codex CLI (OAuth/session)

```bash
codex login
codex login status
```

Expected result:

- `codex login status` shows you are authenticated

## Project Setup

### 4. Open the Vibe Writer project folder

```bash
cd "/Users/ekelloharrid/Downloads/Cowork/Why AI Matters Content /Why AI Matters Author Nation Content/Y AI/Vibe Writer"
```

### 5. Install dependencies

```bash
npm install
```

### 6. Start the app locally

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

- [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

## In-App Setup (First Launch)

### 7. Open Settings (gear icon)

Configure:

- `Local CLI (Codex / OpenAI)` -> Enabled
- `Appearance` -> `System`, `Dark`, or `Light (Seahawks)`
- `Quick AI Continue` -> optional (backtick shortcut)

### 8. Confirm startup checks are green

In onboarding/startup check, confirm:

- `codex` detected
- authenticated status is true

## Recommended Safety Steps

### 9. Create a Git backup (local + GitHub)

Check repo status:

```bash
git status
git remote -v
```

### 10. Use workspace backup JSON in-app

Use:

- `Backup` button (JSON workspace export)
- `Restore` button (non-destructive merge import)

This lets you move projects between browsers/machines.

## Troubleshooting

### Codex CLI installed but app says not authenticated

Run:

```bash
codex login
codex login status
```

Then restart the dev server.

### Localhost opens but app is blank/404

Usually means a stale Vite process is running from an old folder path.

Fix:

1. Stop the running Vite server
2. `cd` into the correct `Vibe Writer` folder
3. Start Vite again

### Theme button appears to do nothing

Use the `Appearance` buttons inside the gear/settings modal.

- `System` follows your OS theme
- `Light (Seahawks)` forces light mode
- `Dark` forces dark mode

## Codex Desktop Prompt (Copy/Paste)

Paste this into Codex Desktop on a fresh machine:

```md
Set up Vibe Writer on this machine.

Goals:
- Install/check Node + npm
- Install/check Codex CLI (`@openai/codex`)
- Log in to Codex CLI via OAuth/session
- Install project dependencies
- Start Vibe Writer locally on `127.0.0.1:5173`
- Verify the app startup check detects `codex` and authenticated CLI status

Project path:
`/Users/ekelloharrid/Downloads/Cowork/Why AI Matters Content /Why AI Matters Author Nation Content/Y AI/Vibe Writer`

Please:
1. Check what is already installed first.
2. Only install what is missing.
3. Do not expose any API keys in source files.
4. Prefer Codex CLI OAuth/session auth over browser-stored keys.
5. After setup, report the exact local URL and any remaining issues.
```

## Optional Next Improvement (App UX)

If you want this even smoother, add a button in the onboarding modal:

- `Show Codex Setup Guide`

That button could open this file (or copy the prompt text) directly from within the app.
