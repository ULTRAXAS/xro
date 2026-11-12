import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadXroAccount } from "../xro-account-manager";

export interface RecordingCommand {
	command: string;
	args: (outFile: string) => string[];
}

export interface VoiceRecordingSession {
	filePath: string;
	stop: () => Promise<string>;
	cancel: () => Promise<void>;
}

export const XRO_TRANSCRIBE_API_URL = "https://ai.ultraxas.com/transcribe";

function isCommandAvailable(cmd: string): boolean {
	try {
		const checkCmd = process.platform === "win32" ? "where" : "which";
		const res = spawnSync(checkCmd, [cmd], { stdio: "ignore" });
		return res.status === 0;
	} catch {
		return false;
	}
}

export function resolveRecordingCommand(): RecordingCommand | null {
	const platform = process.platform;
	if (platform === "linux") {
		if (isCommandAvailable("arecord")) {
			return {
				command: "arecord",
				args: (out) => ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", out],
			};
		}
		if (isCommandAvailable("rec")) {
			return {
				command: "rec",
				args: (out) => ["-q", "-c", "1", "-r", "16000", "-b", "16", out],
			};
		}
		if (isCommandAvailable("ffmpeg")) {
			return {
				command: "ffmpeg",
				args: (out) => [
					"-y",
					"-loglevel",
					"quiet",
					"-f",
					"pulse",
					"-i",
					"default",
					"-ac",
					"1",
					"-ar",
					"16000",
					out,
				],
			};
		}
	} else if (platform === "darwin") {
		if (isCommandAvailable("rec")) {
			return {
				command: "rec",
				args: (out) => ["-q", "-c", "1", "-r", "16000", "-b", "16", out],
			};
		}
		if (isCommandAvailable("sox")) {
			return {
				command: "sox",
				args: (out) => ["-d", "-q", "-c", "1", "-r", "16000", "-b", "16", out],
			};
		}
		if (isCommandAvailable("ffmpeg")) {
			return {
				command: "ffmpeg",
				args: (out) => [
					"-y",
					"-loglevel",
					"quiet",
					"-f",
					"avfoundation",
					"-i",
					":default",
					"-ac",
					"1",
					"-ar",
					"16000",
					out,
				],
			};
		}
	} else if (platform === "win32") {
		if (isCommandAvailable("ffmpeg")) {
			return {
				command: "ffmpeg",
				args: (out) => [
					"-y",
					"-loglevel",
					"quiet",
					"-f",
					"dshow",
					"-i",
					"audio=default",
					"-ac",
					"1",
					"-ar",
					"16000",
					out,
				],
			};
		}
		if (isCommandAvailable("sox")) {
			return {
				command: "sox",
				args: (out) => [
					"-t",
					"waveaudio",
					"default",
					"-c",
					"1",
					"-r",
					"16000",
					"-b",
					"16",
					out,
				],
			};
		}
	} else {
		if (isCommandAvailable("arecord")) {
			return {
				command: "arecord",
				args: (out) => ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", out],
			};
		}
		if (isCommandAvailable("ffmpeg")) {
			return {
				command: "ffmpeg",
				args: (out) => [
					"-y",
					"-loglevel",
					"quiet",
					"-i",
					"default",
					"-ac",
					"1",
					"-ar",
					"16000",
					out,
				],
			};
		}
	}
	return null;
}

export function startAudioRecording(): VoiceRecordingSession {
	const tool = resolveRecordingCommand();
	if (!tool) {
		throw new Error(
			`No audio recording utility found (${process.platform}). Please install arecord (alsa-utils), sox, or ffmpeg.`,
		);
	}

	const tempFile = path.join(
		os.tmpdir(),
		`xro_voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`,
	);

	const child = spawn(tool.command, tool.args(tempFile), {
		stdio: ["ignore", "ignore", "ignore"],
	});

	let stopped = false;

	return {
		filePath: tempFile,
		stop: async (): Promise<string> => {
			if (stopped) return tempFile;
			stopped = true;

			return new Promise<string>((resolve, reject) => {
				let finished = false;

				const complete = () => {
					if (finished) return;
					finished = true;
					setTimeout(() => {
						try {
							if (!fs.existsSync(tempFile)) {
								return reject(new Error("No audio file was created."));
							}
							const stats = fs.statSync(tempFile);
							if (stats.size <= 44) {
								try {
									fs.unlinkSync(tempFile);
								} catch {}
								return reject(
									new Error("No audio recorded (empty audio capture)."),
								);
							}
							resolve(tempFile);
						} catch (e) {
							reject(e);
						}
					}, 80);
				};

				const timeoutTimer = setTimeout(() => {
					try {
						child.kill("SIGKILL");
					} catch {}
					complete();
				}, 2500);

				child.once("close", () => {
					clearTimeout(timeoutTimer);
					complete();
				});

				child.once("error", (err) => {
					clearTimeout(timeoutTimer);
					if (!finished) {
						finished = true;
						try {
							fs.unlinkSync(tempFile);
						} catch {}
						reject(new Error(`Recording error: ${err.message}`));
					}
				});

				try {
					child.kill("SIGINT");
				} catch {
					child.kill();
				}
			});
		},
		cancel: async (): Promise<void> => {
			if (stopped) return;
			stopped = true;
			try {
				child.kill("SIGINT");
				setTimeout(() => {
					try {
						child.kill("SIGKILL");
					} catch {}
					if (fs.existsSync(tempFile)) {
						try {
							fs.unlinkSync(tempFile);
						} catch {}
					}
				}, 100);
			} catch {
				if (fs.existsSync(tempFile)) {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
				}
			}
		},
	};
}

export async function transcribeAudioFile(audioPath: string): Promise<string> {
	try {
		const audioBuffer = fs.readFileSync(audioPath);
		const headers: Record<string, string> = {
			"Content-Type": "audio/wav",
			"X-Audio-Mime": "audio/wav",
		};
		const account = loadXroAccount();
		if (account?.apiKey) {
			headers["Authorization"] = `Bearer ${account.apiKey}`;
		}

		const resp = await fetch(XRO_TRANSCRIBE_API_URL, {
			method: "POST",
			headers,
			body: audioBuffer,
		});

		if (!resp.ok) {
			const errBody = await resp.text().catch(() => "");
			throw new Error(
				`Transcription service returned status ${resp.status}: ${errBody || resp.statusText}`,
			);
		}

		const data = (await resp.json()) as { text?: string; error?: string };
		if (data.error) {
			throw new Error(`Transcription failed: ${data.error}`);
		}

		return (data.text || "").trim();
	} finally {
		try {
			if (fs.existsSync(audioPath)) {
				fs.unlinkSync(audioPath);
			}
		} catch {
			// Ignore temp file cleanup error
		}
	}
}
