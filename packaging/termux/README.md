# Official Termux Packages Submission Recipe for Xro CLI

This directory contains the recipe for submitting the `xro` package upstream to [`termux/termux-packages`](https://github.com/termux/termux-packages).

## Package Details
- **Package**: `xro`
- **Version**: `3.0.0`
- **Description**: `Xro 8.6 Autonomous AI coding agent CLI by ULTRAXAS`
- **Homepage**: `https://ultraxas.com`
- **License**: `Apache-2.0`
- **Runtime Dependency**: `bun` (available in official Termux repositories)
- **Architecture**: `all` (platform independent JS/asset bundle executed by Termux's native `bun`)

## Submission Steps to termux/termux-packages

1. Fork `termux/termux-packages` on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/xason0/termux-packages.git
   cd termux-packages
   ```
3. Create a feature branch:
   ```bash
   git checkout -b add-xro-package
   ```
4. Copy the package directory:
   ```bash
   mkdir -p packages/xro
   cp /home/ultraxas/Projects/xrocli/packaging/termux/packages/xro/build.sh packages/xro/
   ```
5. Test build inside the Termux Docker environment:
   ```bash
   ./scripts/run-docker.sh ./build-package.sh xro
   ```
6. Commit and create Pull Request:
   ```bash
   git add packages/xro
   git commit -m "xro: new package at version 3.0.0"
   gh pr create --repo termux/termux-packages --title "xro: new package at version 3.0.0" --body "Xro is an advanced autonomous coding agent CLI developed by ULTRAXAS."
   ```

Once merged by the Termux maintainers, users will be able to run `pkg install xro` directly without adding any third-party repository.
