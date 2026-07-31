# Development & Debugging Guidelines

- **Version Control System (VCS)**: ALWAYS use `jj` (Jujutsu) for version control operations instead of `git` commands directly.
- **Remote Debugging**: You are allowed to SSH into remote hosts (e.g., `10.100.0.6`) to view logs (`journalctl`), check service status (`systemctl`), or diagnose issues.
- **Local Code Editing**: Always apply code fixes locally in this repository workspace. Do NOT modify code directly on remote target hosts.
- **Version Management**: Always bump the patch/minor version in `src/marine_kiosk/__init__.py` and `pyproject.toml` whenever fixing bugs or introducing new features.
- **Commit & Push Workflow**:
  1. Make local code edits and bump version.
  2. Set commit message using `jj describe -m "<commit message>"`.
  3. Push changes using `jj git push`.
