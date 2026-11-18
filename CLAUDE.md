# Project rules

## Secrets (this repo is public)
- Never write an API key, token, password or private key into any file in this repo, including code, config, README, tests or commit messages.
- Read secrets only from environment variables (`process.env.NAME`). Locally they live in `.env` (git-ignored); in production they're set in the Render dashboard under Environment.
- Never put a secret in client code (`client/`, `shared/`). Everything there is shipped to every player's browser. Any call that needs a key must go through the server.
- Document new variables in `.env.example` with a placeholder value, never the real one.
- Never bypass the pre-commit hook (`--no-verify`). If it blocks a commit, remove the secret instead.
- If a secret is ever committed, treat it as leaked: revoke and rotate it at the provider first, then clean history.
