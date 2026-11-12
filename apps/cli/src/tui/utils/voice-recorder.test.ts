import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
	resolveRecordingCommand,
	startAudioRecording,
	transcribeAudioFile,
} from "./voice-recorder";

describe("voice recorder", () => {
	it("resolves a recording command on the current platform", () => {
		const tool = resolveRecordingCommand();
		expect(tool).not.toBeNull();
		expect(typeof tool?.command).toBe("string");
		expect(typeof tool?.args).toBe("function");

		const args = tool?.args("/tmp/test.wav");
		expect(args).toContain("/tmp/test.wav");
	});

	it("records audio and produces a valid wav file upon stop", async () => {
		const session = startAudioRecording();
		expect(session).toBeDefined();
		expect(session.filePath).toBeDefined();

		// Record for 600ms
		await new Promise((r) => setTimeout(r, 600));

		const recordedPath = await session.stop();
		expect(fs.existsSync(recordedPath)).toBe(true);
		const stats = fs.statSync(recordedPath);
		expect(stats.size).toBeGreaterThan(44);

		// Clean up
		fs.unlinkSync(recordedPath);
	});

	it("cancels recording and deletes the temporary file", async () => {
		const session = startAudioRecording();
		const filePath = session.filePath;

		await new Promise((r) => setTimeout(r, 200));
		await session.cancel();

		// Wait briefly for cleanup
		await new Promise((r) => setTimeout(r, 150));
		expect(fs.existsSync(filePath)).toBe(false);
	});
});
