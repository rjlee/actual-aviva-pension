# actual-aviva-pension

Sync your Aviva pension value to an Actual Budget account.

## Features

- Scrape Aviva pension value from the Aviva website via headless Chrome (Puppeteer).
- Web UI to log in, submit SMS 2FA code, map pension to an Actual Budget account, and trigger sync manually.
- Cron-based daemon mode for automated syncing.
- Docker build and GitHub Actions workflows for CI, release, and Docker image publishing.

## Quick Start

_Before you begin, please review the [Security Considerations](#security-considerations) section below._

1. Copy `.env.example` to `.env` and fill in your Aviva credentials and Actual Budget settings:

```bash
# Aviva settings
AVIVA_EMAIL=you@example.com
AVIVA_PASSWORD=yourAvivaPassword
AVIVA_COOKIES_FILE=./data/aviva_cookies.json
AVIVA_2FA_TIMEOUT=60

# Actual Budget API configuration
ACTUAL_SERVER_URL=https://your-actual-server
ACTUAL_PASSWORD=yourBudgetPassword
ACTUAL_SYNC_ID=yourBudgetSyncID
ACTUAL_BUDGET_ENCRYPTION_PASSWORD=yourBudgetFileEncryptionPassword

# Web UI session auth (disable login with UI_AUTH_ENABLED=false)
UI_AUTH_ENABLED=true
SESSION_SECRET=someLongRandomString

# TLS/HTTPS (optional)
SSL_KEY=/path/to/privkey.pem
SSL_CERT=/path/to/fullchain.pem
# Disable TLS verification for self-signed certificates (insecure; development only)
# NODE_TLS_REJECT_UNAUTHORIZED=0
```

2. Copy `config.example.yaml` to `config.yaml` if you need to override defaults (schedule, HTTP_PORT, DATA_DIR, BUDGET_DIR).

3. Build and run with Docker Compose:

   By default the Docker image installs Debian’s `chromium` package (so Puppeteer uses system Chromium
   instead of downloading its own) and sets `CHROME_DISABLE_SANDBOX=true` so Puppeteer can run headlessly
   inside the container.

```bash
docker-compose up --build -d
```

_or_ run locally:

```bash
npm install
npm run daemon -- --ui [--verbose]
```

4. Open your browser to <http://localhost:3000> (or configured `HTTP_PORT`) and:
   - **Log in to Aviva**: click **Login Aviva**, then enter your Aviva credentials.
   - **Enter SMS code**: when prompted, enter the SMS code for 2FA.
   - **Save mapping**: select your Actual Budget account to sync your pension value to, then click **Save Mapping**.
   - **Sync Now**: click **Sync Now** to immediately update your Actual Budget account.
   - The daemon will also periodically sync based on your cron schedule.

## Security Considerations

_Web UI security:_

- **Session-based UI authentication** uses a signed session cookie (`cookie-session`) secured by `SESSION_SECRET`.
  To disable login entirely (open access), set `UI_AUTH_ENABLED=false`.
- **Aviva session cookies** are stored in `AVIVA_COOKIES_FILE` to avoid repeated SMS codes.
  Protect this file with appropriate filesystem permissions to prevent unauthorized access.
- **TLS/HTTPS:** strongly recommended in production:

```bash
SSL_KEY=/path/to/privkey.pem
SSL_CERT=/path/to/fullchain.pem
```

- **Self-signed certificates:** to bypass TLS verification in development only (insecure):

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

- **Disable Web UI:** omit the `--ui` flag or remove the HTTP_PORT setting to run one-shot sync (`npm run sync`).

## Configuration

See `.env.example` and `config.example.yaml` for available options.

## GitHub Actions & Releases

We use GitHub Actions + semantic-release to automate version bumps, changelogs, GitHub releases, and Docker image publishing:

- **CI & Release** (`.github/workflows/release.yml`) runs on push to `main`: lint, format-check, test, and `semantic-release`.
- **Docker Build & Publish** (`.github/workflows/docker.yml`) runs on push to `release`: builds and publishes the Docker image to GitHub Container Registry (`ghcr.io/<owner>/actual-aviva-pension:<version>` and `:latest`).

Ensure your repository has the `GITHUB_TOKEN` secret configured.

## Development

We use ESLint, Prettier, Husky (Git hooks), lint-staged, and Jest to enforce code quality.

```bash
npm install
npm run prepare
```

Lint, format, and test:

```bash
npm run lint
npm run lint:ejs
npm run format
npm run format:check
npm test
```

## Run tests in constrained environments

If your environment restricts opening sockets (e.g., some sandboxes), run unit tests only:

```bash
npm run test:unit
```

## License

<Add license or disclaimer as needed>

## Troubleshooting

- Chrome/Puppeteer error `net::ERR_INSUFFICIENT_RESOURCES` during logout:
  - Cause: Chromium inside containers can hit `/dev/shm` limits or run out of ephemeral resources on extra navigations.
  - Fixes implemented: the scraper now saves cookies before attempting logout and ignores logout navigation errors; Puppeteer launches with `--disable-dev-shm-usage` by default.
  - Additional hardening: increase container shared memory. In Docker Compose, add `shm_size: '1gb'` to the service. For `docker run`, use `--shm-size=1g`.

- Actual API `SqliteError: database or disk is full`:
  - Cause: the budget cache directory has run out of space on the host or the container’s filesystem quota.
  - Verify free space on the host for the mapped path used as the budget cache. By default this is `./data/budget` inside the project directory (mounted at `/app/data/budget`).
  - Fix options:
    - Free disk space in `./data` (and `./data/budget`) or move them to a larger disk.
    - Point the cache elsewhere by setting `BUDGET_DIR` (for example `BUDGET_DIR=/app/budget`) and bind-mount that path to a large volume in Compose.
    - Ensure the mount is writable by the container user.
