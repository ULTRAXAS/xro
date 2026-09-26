# Xro CLI Documentation & Reference

This document provides details on where the Xro CLI source code resides, execution paths, installation locations, and deployment endpoints.

---

## 1. Source Code Location (Local Machine)
- **Repository Path**: `/home/ultraxas/Projects/xrocli`
- **CLI App Path**: `/home/ultraxas/Projects/xrocli/apps/cli`
- **Main Entrypoint**: [`/home/ultraxas/Projects/xrocli/apps/cli/src/main.ts`](file:///home/ultraxas/Projects/xrocli/apps/cli/src/main.ts)
- **Onboarding UI**: [`/home/ultraxas/Projects/xrocli/apps/cli/src/tui/views/onboarding/screens.tsx`](file:///home/ultraxas/Projects/xrocli/apps/cli/src/tui/views/onboarding/screens.tsx)
- **Auth Guard & Menu**: [`/home/ultraxas/Projects/xrocli/apps/cli/src/tui/views/onboarding/model.ts`](file:///home/ultraxas/Projects/xrocli/apps/cli/src/tui/views/onboarding/model.ts)
- **Update Command**: [`/home/ultraxas/Projects/xrocli/apps/cli/src/commands/update.ts`](file:///home/ultraxas/Projects/xrocli/apps/cli/src/commands/update.ts)

---

## 2. Installation & Binary Execution Paths
- **Installed Binary Path**: `$HOME/.xro/bin/xro` (`/home/ultraxas/.xro/bin/xro`)
- **Shell PATH Requirement**: `export PATH="$HOME/.xro/bin:$PATH"`
- **Config & Auth Storage Path**: `$HOME/.xro/` or `$HOME/.xrocli/`

---

## 3. Remote VPS & Website Hosting Paths
- **VPS Host**: `87.106.69.120` (User: `automation`)
- **Web Root Directory**: `/home/automation/icon-drift-main/dist/xro-cli/`
- **Public Assets & Downloads**:
  - Installer: `https://ultraxas.com/xro-cli/install.sh`
  - Linux Binary: `https://ultraxas.com/xro-cli/xro-linux-x64`
  - Version File: `https://ultraxas.com/xro-cli/version.txt`

---

## 4. Useful Commands

### Recompile Linux Standalone Binary
```bash
cd /home/ultraxas/Projects/xrocli/apps/cli
bun build --compile --target=bun-linux-x64 ./src/main.ts --outfile xro-linux-x64
```

### Install / Re-install CLI
```bash
curl -fsSL https://ultraxas.com/xro-cli/install.sh | bash
```

### Check Version & Test Update
```bash
xro --version
xro update
```
