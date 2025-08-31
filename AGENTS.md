# Repository Guidelines

## Project Structure & Module Organization
- `src/`: runtime code (`index.js`, `daemon.js`, `sync.js`, `aviva-client.js`, `web-ui.js`, `utils.js`, `views/`).
- `tests/`: Jest tests (`*.test.js`).
- `data/`: runtime state (cookies, caches). Contents ignored; `.gitkeep` only.
- Docker/CI: `Dockerfile`, `docker-compose.yml`, workflows in `.github/`.

## Build, Test, and Development Commands
- `npm start` or `npm run sync`: one‑shot sync.
- `npm run daemon -- --ui`: cron daemon + web UI.
- `npm test` | `npm run test:unit`: full suite or unit‑only.
- `npm run lint` | `npm run lint:ejs` | `npm run format[:check]`.
- `npm run prerelease` then `npm run release` (semantic‑release).

## Architecture Overview
- Entry: `src/index.js` parses `--mode` (`sync`, `daemon`, optional UI).
- Scraper: `src/aviva-client.js` (Puppeteer) with SMS 2FA and cookie persistence in `data/`.
- Orchestration/UI: `src/daemon.js` (node-cron) schedules; `src/web-ui.js` (Express + EJS) with `cookie-session`.
- Budget bridge: `@actual-app/api`; config via `.env` and `config.yaml` in `src/config.js`.

## Coding Style & Naming Conventions
- Node ≥ 20. ESLint `eslint:recommended` + Prettier.
- Format: 2 spaces, 100 cols, single quotes, semicolons, ES5 trailing commas.
- Files: kebab‑case modules (e.g., `aviva-client.js`); tests `*.test.js`.
- Names: `camelCase` vars/functions, `PascalCase` classes, `UPPER_SNAKE` constants.

## Testing Guidelines
- Jest in `tests/**/*.test.js`.
- Coverage on by default; thresholds: branches 50, functions 60, lines/statements 80.
- Unit‑only mode skips socket‑binding UI tests: `npm run test:unit`.
- Co‑locate new tests; keep fast and deterministic (use fixtures/mocks).

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) for semantic‑release.
- PRs: clear description, linked issue, screenshots for UI changes, call out config/env changes.
- Run `npm run prerelease` before pushing; target `main` with small, focused diffs.

## Security & Configuration Tips
- Secrets in `.env` (ignored). Start from `.env.example`; never commit credentials.
- Protect `data/` (Aviva cookies). Avoid logging secrets.
- Docker local run: `docker-compose up --build -d`.

## Docker-Specific Dev Tips
- Image vs build: default uses GHCR image; use `build: .` to test local changes.
- Volumes: `./data` and `./data/budget` are bind‑mounted; clear to reset sessions/cache.
- Chromium: system `chromium` installed; sandbox off (`CHROME_DISABLE_SANDBOX=true`). Add `shm_size: '1gb'` or `--shm-size=1g` for stability.
- Exec: `docker compose exec aviva-pension-sync sh` then `npm test` or `npm run sync`.
- TLS/Ports: mount certs (`SSL_KEY`, `SSL_CERT`); map `HTTP_PORT`.
