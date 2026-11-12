#!/usr/bin/env bun

import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	chmodSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { $ } from "bun";

const cliDir = resolve(import.meta.dir, "..");
const rootDir = resolve(cliDir, "../..");
process.chdir(cliDir);

const pkg = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf-8"));
const version: string = pkg.version;

console.log(`Building Termux package and repository for xro v${version}...`);

const distDir = join(cliDir, "dist-termux");
const stagingDir = join(distDir, "staging");
const repoDir = join(distDir, "repo");

await $`rm -rf ${distDir}`;

const prefix = "data/data/com.termux/files/usr";
const stagingPrefix = join(stagingDir, prefix);
const stagingBin = join(stagingPrefix, "bin");
const stagingLib = join(stagingPrefix, "lib/xro");
const stagingDebian = join(stagingDir, "DEBIAN");

mkdirSync(stagingBin, { recursive: true });
mkdirSync(stagingLib, { recursive: true });
mkdirSync(stagingDebian, { recursive: true });
mkdirSync(repoDir, { recursive: true });

// 1. Bundle CLI entrypoint with Bun targeting bun runtime
console.log("Bundling CLI entrypoint for Termux...");

const BUILD_TIME_INLINED_ENV_VARS = [
	"TELEMETRY_SERVICE_API_KEY",
	"ERROR_SERVICE_API_KEY",
	"OTEL_TELEMETRY_ENABLED",
	"OTEL_LOGS_EXPORTER",
	"OTEL_METRICS_EXPORTER",
	"OTEL_TRACES_EXPORTER",
	"CLINE_TRACE_SAMPLE_PERCENT",
	"CLINE_TRACE_RECORD_CONTENT",
	"OTEL_EXPORTER_OTLP_PROTOCOL",
	"OTEL_EXPORTER_OTLP_ENDPOINT",
	"OTEL_EXPORTER_OTLP_HEADERS",
] as const;

function buildInlinedEnvDefines(): Record<string, string> {
	const defines: Record<string, string> = {};
	for (const name of BUILD_TIME_INLINED_ENV_VARS) {
		defines[`process.env.${name}`] = JSON.stringify(process.env[name] ?? "");
	}
	return defines;
}

const buildResult = await Bun.build({
	entrypoints: [join(cliDir, "src/index.ts")],
	outdir: stagingLib,
	target: "bun",
	minify: true,
	external: ["@anthropic-ai/vertex-sdk"],
	define: {
		"process.env.NODE_ENV": '"production"',
		...buildInlinedEnvDefines(),
	},
	throw: false,
});

if (!buildResult.success) {
	console.error("Bun bundle failed:");
	for (const log of buildResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

// 2. Copy extensions & webview assets
const coreBootstrapPath = join(
	rootDir,
	"sdk/packages/core/dist/extensions/plugin-sandbox-bootstrap.js",
);
if (existsSync(coreBootstrapPath)) {
	const destExt = join(stagingLib, "extensions");
	mkdirSync(destExt, { recursive: true });
	cpSync(coreBootstrapPath, join(destExt, "plugin-sandbox-bootstrap.js"));
}

const hubWebviewDist = join(cliDir, "../cline-hub/dist/webview");
if (existsSync(hubWebviewDist)) {
	const destWebview = join(stagingLib, "cline-hub/webview");
	mkdirSync(join(stagingLib, "cline-hub"), { recursive: true });
	cpSync(hubWebviewDist, destWebview, { recursive: true });
}

const localParserWorker = resolve(
	cliDir,
	"node_modules/@opentui/core/parser.worker.js",
);
const rootParserWorker = resolve(
	rootDir,
	"node_modules/@opentui/core/parser.worker.js",
);
const parserWorker = existsSync(localParserWorker)
	? localParserWorker
	: rootParserWorker;
if (existsSync(parserWorker)) {
	cpSync(parserWorker, join(stagingLib, "parser.worker.js"));
}

writeFileSync(
	join(stagingLib, "package.json"),
	JSON.stringify(
		{
			name: "@ultraxas/xro",
			version,
			description: "Xro 8.6 Autonomous coding agent CLI for Termux",
			bin: { xro: "bin/xro" },
		},
		null,
		2,
	),
);

// 3. Create wrapper script in /data/data/com.termux/files/usr/bin/xro
const wrapperScript = `#!/data/data/com.termux/files/usr/bin/sh
set -e
PREFIX="\${PREFIX:-/data/data/com.termux/files/usr}"
XRO_LIB="$PREFIX/lib/xro"
BUN_BIN="$PREFIX/bin/bun"

if [ ! -x "$BUN_BIN" ]; then
    if command -v bun >/dev/null 2>&1; then
        BUN_BIN="$(command -v bun)"
    else
        echo "Error: 'bun' runtime is required by Xro CLI on Termux." >&2
        echo "Please run: pkg install bun" >&2
        exit 1
    fi
fi

exec "$BUN_BIN" "$XRO_LIB/index.js" "$@"
`;

const wrapperPath = join(stagingBin, "xro");
writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });
chmodSync(wrapperPath, 0o755);

// Calculate installed size in KB
function getDirSizeKb(dir: string): number {
	let totalBytes = 0;
	function walk(d: string) {
		for (const entry of new Bun.Glob("**/*").scanSync({ cwd: d, dot: true })) {
			const full = join(d, entry);
			try {
				const st = statSync(full);
				if (st.isFile()) {
					totalBytes += st.size;
				}
			} catch {}
		}
	}
	walk(dir);
	return Math.ceil(totalBytes / 1024);
}

const installedSizeKb = getDirSizeKb(stagingPrefix);

const architectures = ["aarch64", "all"] as const;
const builtDebs: { arch: string; filename: string; path: string; size: number }[] = [];

for (const arch of architectures) {
	console.log(`\nGenerating .deb for architecture: ${arch}...`);
	const controlContent = `Package: xro
Version: ${version}
Architecture: ${arch}
Maintainer: ULTRAXAS <contact@ultraxas.com>
Installed-Size: ${installedSizeKb}
Depends: bun
Section: utils
Priority: optional
Homepage: https://ultraxas.com
Description: Xro 8.6 Autonomous coding agent CLI
 Xro is an advanced autonomous AI coding assistant in your terminal by ULTRAXAS.
 Multi-model reasoning, interactive TUI, voice dictation, and autonomous tool execution.
`;

	writeFileSync(join(stagingDebian, "control"), controlContent);

	const debFileName = `xro_${version}_${arch}.deb`;
	const debOutPath = join(distDir, debFileName);

	await $`dpkg-deb --build --root-owner-group ${stagingDir} ${debOutPath}`;
	const size = statSync(debOutPath).size;
	builtDebs.push({ arch, filename: debFileName, path: debOutPath, size });
	console.log(`  Created ${debOutPath} (${(size / (1024 * 1024)).toFixed(2)} MB)`);
}

// 4. Construct APT Repository Structure
console.log("\nConstructing APT Repository layout in dist-termux/repo...");

const poolDir = join(repoDir, "pool/main/x/xro");
mkdirSync(poolDir, { recursive: true });

for (const deb of builtDebs) {
	// Copy to pool
	cpSync(deb.path, join(poolDir, deb.filename));
	// Also copy to repo root for flat repo access
	cpSync(deb.path, join(repoDir, deb.filename));
}

// Helpers for hashes
function hashFile(path: string, algo: "md5" | "sha1" | "sha256"): string {
	const buf = readFileSync(path);
	return createHash(algo).update(buf).digest("hex");
}

function hashBuffer(buf: Buffer | Uint8Array | string, algo: "md5" | "sha1" | "sha256"): string {
	return createHash(algo).update(buf).digest("hex");
}

function makePackageEntry(debPath: string, relativeFilename: string, arch: string): string {
	const size = statSync(debPath).size;
	const md5 = hashFile(debPath, "md5");
	const sha1 = hashFile(debPath, "sha1");
	const sha256 = hashFile(debPath, "sha256");

	return `Package: xro
Version: ${version}
Architecture: ${arch}
Maintainer: ULTRAXAS <contact@ultraxas.com>
Installed-Size: ${installedSizeKb}
Depends: bun
Filename: ${relativeFilename}
Size: ${size}
MD5sum: ${md5}
SHA1: ${sha1}
SHA256: ${sha256}
Section: utils
Priority: optional
Homepage: https://ultraxas.com
Description: Xro 8.6 Autonomous coding agent CLI
 Xro is an advanced autonomous AI coding assistant in your terminal by ULTRAXAS.
 Multi-model reasoning, interactive TUI, voice dictation, and autonomous tool execution.
`;
}

// Create dists/stable/main/binary-<arch>
const distsStableDir = join(repoDir, "dists/stable");
const releaseFiles: { relPath: string; size: number; md5: string; sha1: string; sha256: string }[] = [];

for (const arch of ["aarch64", "all"]) {
	const binDir = join(distsStableDir, `main/binary-${arch}`);
	mkdirSync(binDir, { recursive: true });

	// Filter debs that match this arch or all
	const debsForArch = builtDebs.filter((d) => d.arch === arch || d.arch === "all");
	const entries = debsForArch.map((d) =>
		makePackageEntry(d.path, `pool/main/x/xro/${d.filename}`, d.arch),
	);
	const packagesContent = entries.join("\n") + "\n";
	const packagesPath = join(binDir, "Packages");
	writeFileSync(packagesPath, packagesContent);

	// Gzip Packages
	await $`gzip -9 -k -f ${packagesPath}`;
	const packagesGzPath = join(binDir, "Packages.gz");

	const relPkg = `main/binary-${arch}/Packages`;
	const relPkgGz = `main/binary-${arch}/Packages.gz`;

	releaseFiles.push({
		relPath: relPkg,
		size: statSync(packagesPath).size,
		md5: hashFile(packagesPath, "md5"),
		sha1: hashFile(packagesPath, "sha1"),
		sha256: hashFile(packagesPath, "sha256"),
	});
	releaseFiles.push({
		relPath: relPkgGz,
		size: statSync(packagesGzPath).size,
		md5: hashFile(packagesGzPath, "md5"),
		sha1: hashFile(packagesGzPath, "sha1"),
		sha256: hashFile(packagesGzPath, "sha256"),
	});
}

// Generate dists/stable/Release
const releaseDate = new Date().toUTCString();
let releaseContent = `Origin: ULTRAXAS
Label: ULTRAXAS Termux Repository
Suite: stable
Codename: stable
Version: 1.0
Architectures: aarch64 all
Components: main
Description: Official Termux APT repository for ULTRAXAS Xro CLI
Date: ${releaseDate}
MD5Sum:
${releaseFiles.map((f) => ` ${f.md5} ${f.size} ${f.relPath}`).join("\n")}
SHA1:
${releaseFiles.map((f) => ` ${f.sha1} ${f.size} ${f.relPath}`).join("\n")}
SHA256:
${releaseFiles.map((f) => ` ${f.sha256} ${f.size} ${f.relPath}`).join("\n")}
`;

const releasePath = join(distsStableDir, "Release");
writeFileSync(releasePath, releaseContent);

// Also generate flat repo files at repoDir (for deb https://... ./)
const flatEntries = builtDebs.map((d) => makePackageEntry(d.path, d.filename, d.arch));
const flatPackagesContent = flatEntries.join("\n") + "\n";
const flatPackagesPath = join(repoDir, "Packages");
writeFileSync(flatPackagesPath, flatPackagesContent);
await $`gzip -9 -k -f ${flatPackagesPath}`;
const flatPackagesGzPath = join(repoDir, "Packages.gz");

let flatReleaseContent = `Origin: ULTRAXAS
Label: ULTRAXAS Termux Repository
Suite: stable
Codename: stable
Architectures: aarch64 all
Description: Official Termux APT repository for ULTRAXAS Xro CLI
Date: ${releaseDate}
MD5Sum:
 ${hashFile(flatPackagesPath, "md5")} ${statSync(flatPackagesPath).size} Packages
 ${hashFile(flatPackagesGzPath, "md5")} ${statSync(flatPackagesGzPath).size} Packages.gz
SHA1:
 ${hashFile(flatPackagesPath, "sha1")} ${statSync(flatPackagesPath).size} Packages
 ${hashFile(flatPackagesGzPath, "sha1")} ${statSync(flatPackagesGzPath).size} Packages.gz
SHA256:
 ${hashFile(flatPackagesPath, "sha256")} ${statSync(flatPackagesPath).size} Packages
 ${hashFile(flatPackagesGzPath, "sha256")} ${statSync(flatPackagesGzPath).size} Packages.gz
`;
writeFileSync(join(repoDir, "Release"), flatReleaseContent);

// 5. GPG Signing
console.log("\nSigning repository with GPG key...");
const gpgKeyId = "2322A20D6849026CDAFF441637A36F75A347BF08";

// Export public keys
await $`gpg --export ${gpgKeyId} > ${join(repoDir, "ultraxas-archive-keyring.gpg")}`;
await $`gpg --armor --export ${gpgKeyId} > ${join(repoDir, "ultraxas-archive-keyring.asc")}`;
cpSync(join(repoDir, "ultraxas-archive-keyring.gpg"), join(distsStableDir, "ultraxas-archive-keyring.gpg"));

// Sign dists/stable/Release
await $`gpg --batch --yes --pinentry-mode loopback -u ${gpgKeyId} -abs -o ${join(distsStableDir, "Release.gpg")} ${releasePath}`;
await $`gpg --batch --yes --pinentry-mode loopback -u ${gpgKeyId} --clearsign -o ${join(distsStableDir, "InRelease")} ${releasePath}`;

// Sign flat Release
await $`gpg --batch --yes --pinentry-mode loopback -u ${gpgKeyId} -abs -o ${join(repoDir, "Release.gpg")} ${join(repoDir, "Release")}`;
await $`gpg --batch --yes --pinentry-mode loopback -u ${gpgKeyId} --clearsign -o ${join(repoDir, "InRelease")} ${join(repoDir, "Release")}`;

// 6. Create setup.sh & install.sh
const installScriptContent = `#!/data/data/com.termux/files/usr/bin/sh
# ULTRAXAS Termux Repository Setup & Xro CLI Installer
# Usage: curl -fsSL https://ultraxas.com/termux/install.sh | bash
set -e

echo "✨ Setting up ULTRAXAS Termux repository for Xro CLI..."

PREFIX="\${PREFIX:-/data/data/com.termux/files/usr}"
KEYRINGS_DIR="$PREFIX/etc/apt/keyrings"
SOURCES_DIR="$PREFIX/etc/apt/sources.list.d"

mkdir -p "$KEYRINGS_DIR" "$SOURCES_DIR"

# Download repository signing key
if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://ultraxas.com/termux/ultraxas-archive-keyring.gpg -o "$KEYRINGS_DIR/ultraxas-archive-keyring.gpg" 2>/dev/null || true
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$KEYRINGS_DIR/ultraxas-archive-keyring.gpg" https://ultraxas.com/termux/ultraxas-archive-keyring.gpg 2>/dev/null || true
fi

# Configure apt source
if [ -s "$KEYRINGS_DIR/ultraxas-archive-keyring.gpg" ]; then
    echo "deb [signed-by=$KEYRINGS_DIR/ultraxas-archive-keyring.gpg] https://ultraxas.com/termux stable main" > "$SOURCES_DIR/ultraxas.list"
else
    echo "deb [trusted=yes] https://ultraxas.com/termux stable main" > "$SOURCES_DIR/ultraxas.list"
fi

echo "📦 Updating Termux package lists..."
apt update -y 2>/dev/null || pkg update -y

echo "🚀 Installing Xro CLI..."
pkg install -y xro

echo ""
echo "🎉 Xro CLI installation successful!"
echo "Run 'xro' to launch the autonomous terminal coding assistant."
`;

writeFileSync(join(repoDir, "install.sh"), installScriptContent, { mode: 0o755 });
writeFileSync(join(repoDir, "setup.sh"), installScriptContent, { mode: 0o755 });

// 7. Create static web page at dist-termux/repo/index.html
const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Xro CLI on Termux (Android) - ULTRAXAS</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --accent: #58a6ff;
      --code-bg: #030407;
      --green: #3fb950;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
      border: 1px solid rgba(88, 166, 255, 0.3);
      margin-bottom: 1rem;
    }
    h1 {
      color: var(--heading);
      font-size: 2.2rem;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    p.lead {
      font-size: 1.1rem;
      color: #8b949e;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      color: var(--heading);
      font-size: 1.3rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      color: #58a6ff;
      margin-bottom: 0.75rem;
    }
    code {
      font-family: var(--font-mono);
      background: rgba(110,118,129,0.2);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.85em;
    }
    ol, ul {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    li { margin-bottom: 0.5rem; }
    .download-links {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .btn {
      display: inline-block;
      padding: 0.6rem 1.2rem;
      background: #238636;
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      border-radius: 6px;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .btn:hover { background: #2ea043; }
    .btn-secondary {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: #30363d; }
    footer {
      text-align: center;
      margin-top: 3rem;
      color: #8b949e;
      font-size: 0.85rem;
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">Official Termux Repository</div>
      <h1>Xro CLI on Termux (Android)</h1>
      <p class="lead">Autonomous terminal AI coding assistant in your pocket by ULTRAXAS</p>
    </header>

    <div class="card">
      <h2>⚡ 1-Step Automatic Install</h2>
      <p style="margin-bottom: 0.75rem;">Run this inside Termux to configure the ULTRAXAS repository and install Xro CLI automatically:</p>
      <pre>curl -fsSL https://ultraxas.com/termux/install.sh | bash</pre>
      <p>Then launch:</p>
      <pre>xro</pre>
    </div>

    <div class="card">
      <h2>🛠️ Manual Package-Manager Install (&grave;pkg install xro&grave;)</h2>
      <p style="margin-bottom: 0.75rem;">If you prefer configuring your Termux APT sources manually:</p>
      <ol>
        <li>Add the ULTRAXAS Termux repository:
          <pre>echo "deb [trusted=yes] https://ultraxas.com/termux stable main" > $PREFIX/etc/apt/sources.list.d/ultraxas.list</pre>
        </li>
        <li>Update package lists:
          <pre>pkg update</pre>
        </li>
        <li>Install Xro CLI:
          <pre>pkg install xro</pre>
        </li>
      </ol>
      <p>Verify installation:</p>
      <pre>xro -V</pre>
    </div>

    <div class="card">
      <h2>📥 Direct .deb Package Downloads</h2>
      <p>Offline Debian packages for manual installation via <code>dpkg -i</code>:</p>
      <div class="download-links">
        <a class="btn btn-secondary" href="xro_${version}_aarch64.deb">Download aarch64 .deb (v${version})</a>
        <a class="btn btn-secondary" href="xro_${version}_all.deb">Download all-arch .deb (v${version})</a>
      </div>
      <p style="margin-top: 1rem; font-size: 0.9rem; color: #8b949e;">Requires <code>pkg install bun</code> to run.</p>
    </div>

    <div class="card">
      <h2>🔐 Repository Verification Details</h2>
      <p><strong>Package Name:</strong> <code>xro</code></p>
      <p><strong>Version:</strong> <code>${version}</code></p>
      <p><strong>Architectures:</strong> <code>aarch64</code>, <code>all</code></p>
      <p><strong>Dependencies:</strong> <code>bun</code></p>
      <p><strong>GPG Fingerprint:</strong> <code>2322 A20D 6849 026C DAFF  4416 37A3 6F75 A347 BF08</code></p>
      <p style="margin-top: 0.5rem;"><a href="ultraxas-archive-keyring.gpg" style="color: var(--accent);">Download GPG Keyring (.gpg)</a> | <a href="ultraxas-archive-keyring.asc" style="color: var(--accent);">ASCII Armored Key (.asc)</a></p>
    </div>

    <footer>
      <p>&copy; 2026 ULTRAXAS. All rights reserved. <a href="https://ultraxas.com">ultraxas.com</a></p>
    </footer>
  </div>
</body>
</html>
`;

writeFileSync(join(repoDir, "index.html"), indexHtmlContent);

console.log("\nAPT Repository generation complete!");
console.log(`Repository ready at ${repoDir}`);
