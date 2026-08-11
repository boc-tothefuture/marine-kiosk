# Development & Debugging Guidelines

- **Version Control System (VCS)**: ALWAYS use `jj` (Jujutsu) for version control operations instead of `git` commands directly.
- **Remote Debugging**: You are allowed to SSH into remote hosts (e.g., `10.100.0.6`) to view logs (`journalctl`), check service status (`systemctl`), or diagnose issues.
- **Local Code Editing**: Always apply code fixes locally in this repository workspace. Do NOT modify code directly on remote target hosts.
- **Version Management**: Always bump the patch/minor version in `src/marine_kiosk/__init__.py` and `pyproject.toml` whenever fixing bugs or introducing new features.
- **Python Linting & Type Checking**: `ruff` and `pyright` are dev dependencies (`[dependency-groups].dev` in `pyproject.toml`, pulled in via `uv sync`). Always run both as part of your Python coding practice before considering a change done:
  - `uv run ruff check .` (add `--fix` to apply safe auto-fixes)
  - `uv run pyright`
- **JavaScript / TypeScript Linting & Type Checking**: `biome` and `typescript` are dev dependencies in `web/package.json`. Always run both for frontend code:
  - `npm --prefix web run lint` (or `npx biome check src/` in `web`)
  - `npm --prefix web run typecheck` (or `npx tsc --noEmit` in `web`)
  - `npm --prefix web run build` (to compile `src/app.ts` to `app.js` when modifying frontend code)
- **Commit & Push Workflow**:
  1. Make local code edits and bump version.
  2. Always lint and type check any changed files before committing/pushing (`uv run ruff check .`, `uv run pyright`, `npm --prefix web run lint`, `npm --prefix web run typecheck`).
  3. Set commit message using `jj describe -m "<commit message>"`.
  4. Move bookmark if needed and push changes using `jj bookmark set main -r @` and `jj git push`.
  5. Create a new clean working copy using `jj new`.


