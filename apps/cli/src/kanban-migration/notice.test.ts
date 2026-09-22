import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	getClineCliMigrationNotice,
	markClineCliMigrationNoticeShown,
	resolveCliNoticeStatePath,
	shouldSuppressClineCliMigrationNoticeForActiveProvider,
} from "./notice";

const tempDirs: string[] = [];

function createTempDataDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "cline-cli-notice-"));
	tempDirs.push(dir);
	return dir;
}

describe("migration notice", () => {
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("never shows the upstream ClinePass/Cline Desktop promo notices", () => {
		const dataDir = createTempDataDir();

		expect(getClineCliMigrationNotice(dataDir)).toBeUndefined();
	});

	it("stays disabled even when the force env var is set", () => {
		const dataDir = createTempDataDir();

		expect(
			getClineCliMigrationNotice(dataDir, {
				CLINE_FORCE_CLINE_PASS_NOTICE: "1",
			}),
		).toBeUndefined();
	});

	it("stays disabled regardless of active provider", () => {
		const dataDir = createTempDataDir();

		expect(
			getClineCliMigrationNotice(
				dataDir,
				{},
				{ activeProviderId: "cline-pass" },
			),
		).toBeUndefined();
	});

	it("suppresses the active ClinePass provider even when the provider id has surrounding whitespace", () => {
		expect(
			shouldSuppressClineCliMigrationNoticeForActiveProvider(" cline-pass "),
		).toBe(true);
	});

	it("does not suppress the active ClinePass provider when forced", () => {
		expect(
			shouldSuppressClineCliMigrationNoticeForActiveProvider("cline-pass", {
				CLINE_FORCE_CLINE_PASS_NOTICE: "1",
			}),
		).toBe(false);
	});

	it("marks the notice as shown", () => {
		const dataDir = createTempDataDir();

		markClineCliMigrationNoticeShown(dataDir);

		const rawState = readFileSync(resolveCliNoticeStatePath(dataDir), "utf8");
		expect(rawState).toContain("cline-cli-cline-pass-intro");
		expect(getClineCliMigrationNotice(dataDir)).toBeUndefined();
	});
});
