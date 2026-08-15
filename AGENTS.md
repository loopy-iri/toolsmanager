# Repository Guidelines

## Project Structure & Module Organization

ToolManager is a two-package Vue and Express application. `client/src/App.vue` contains the application shell, authentication screens, dashboard, inventory and request workflows. Its shared RTL design tokens and responsive rules live in `client/src/style.css`. Vite proxies `/api` to the local server during development and emits `client/dist` for production.

`server/src/index.js` owns the HTTP API, session authentication, role authorization, state transitions, SQLite persistence, security headers and production static-file serving. Operational state is stored as a transactional snapshot in `app_state`; credentials and sessions use separate SQLite tables. Do not trust client-supplied actor or requester identifiers. Runtime data under `server/data/`, the legacy `server/data.json`, `.env`, logs and build output are intentionally ignored by Git.

## Build, Test, and Development Commands

- `npm install && npm run install:all`: install root, server and client dependencies.
- `npm run dev`: run the Express watcher and Vite dev server together.
- `npm test`: run all server tests with Node's built-in test runner.
- `node --test server/test/logic.test.js --test-name-pattern="training"`: run one matching test.
- `npm run build`: create the production Vue bundle.
- `npm run check`: run tests and the client build.
- `npm start`: serve the API and existing `client/dist` bundle.

Node.js 24 or newer is required because persistence uses `node:sqlite`.

## Testing Guidelines

API behavior is covered in `server/test/logic.test.js`. Tests create an isolated SQLite database in the OS temporary directory, authenticate through the public API and remove database files after completion. Add focused coverage for new authorization rules, validation branches or request status transitions. Use future dates in request fixtures so time-dependent tests stay deterministic.

## Commit & Pull Request Guidelines

This repository began without commit history, so no established message convention exists. Use short imperative commits such as `Add password rotation endpoint`. Pull requests should state the operational behavior changed, verification performed and any environment, database or deployment impact. Never include production data or secrets.
