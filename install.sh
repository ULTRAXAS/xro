#!/usr/bin/env bash
set -euo pipefail

# Xro CLI Installer
# Usage: curl -fsSL https://ultraxas.com/xro-cli/install.sh | bash

INSTALL_DIR="${XRO_INSTALL_DIR:-$HOME/.xro/bin}"
BINARY_URL="https://ultraxas.com/xro-cli/xro-linux-x64"

echo "✨ Installing Xro CLI..."

mkdir -p "$INSTALL_DIR"

rm -f "$INSTALL_DIR/xro.tmp" "$INSTALL_DIR/xro" 2>/dev/null || true

if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$BINARY_URL" -o "$INSTALL_DIR/xro.tmp"
    mv "$INSTALL_DIR/xro.tmp" "$INSTALL_DIR/xro"
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$INSTALL_DIR/xro.tmp" "$BINARY_URL"
    mv "$INSTALL_DIR/xro.tmp" "$INSTALL_DIR/xro"
else
    echo "❌ Error: curl or wget is required to download Xro CLI." >&2
    exit 1
fi

chmod +x "$INSTALL_DIR/xro"

echo "✅ Xro CLI binary installed to: $INSTALL_DIR/xro"

# Check if PATH contains install dir
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    SHELL_NAME="$(basename "${SHELL:-bash}")"
    RC_FILE=""
    if [[ "$SHELL_NAME" == "zsh" ]]; then
        RC_FILE="$HOME/.zshrc"
    elif [[ "$SHELL_NAME" == "bash" ]]; then
        RC_FILE="$HOME/.bashrc"
    fi

    if [[ -n "$RC_FILE" ]]; then
        if ! grep -q "$INSTALL_DIR" "$RC_FILE" 2>/dev/null; then
            echo "" >> "$RC_FILE"
            echo "# Xro CLI" >> "$RC_FILE"
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$RC_FILE"
            echo "💡 Added $INSTALL_DIR to PATH in $RC_FILE"
        fi
    fi
    echo "👉 Run 'export PATH=\"\$PATH:$INSTALL_DIR\"' or restart your terminal to start using 'xro'."
fi

echo ""
echo "🎉 Xro CLI installation complete! Run 'xro --version' or 'xro' to get started."
