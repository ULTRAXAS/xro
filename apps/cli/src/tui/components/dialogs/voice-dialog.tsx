// @jsxImportSource @opentui/react
import type { ChoiceContext } from "@opentui-ui/dialog";
import { useDialogKeyboard } from "@opentui-ui/dialog/react";
import "opentui-spinner/react";
import { useEffect, useRef, useState } from "react";
import { useDialogPalette } from "../../hooks/use-theme";
import {
	startAudioRecording,
	transcribeAudioFile,
	type VoiceRecordingSession,
} from "../../utils/voice-recorder";

export interface VoiceDialogResult {
	ok: boolean;
	text: string;
}

export function VoiceDialogContent(props: ChoiceContext<VoiceDialogResult>) {
	const { resolve, dismiss, dialogId } = props;
	const palette = useDialogPalette();
	const [status, setStatus] = useState<"recording" | "transcribing" | "error">(
		"recording",
	);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [errorMessage, setErrorMessage] = useState("");

	const sessionRef = useRef<VoiceRecordingSession | null>(null);
	const statusRef = useRef(status);
	statusRef.current = status;

	useEffect(() => {
		let isCancelled = false;
		let intervalId: NodeJS.Timeout | null = null;

		try {
			const session = startAudioRecording();
			sessionRef.current = session;

			intervalId = setInterval(() => {
				setElapsedSeconds((s) => s + 1);
			}, 1000);
		} catch (err) {
			setStatus("error");
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Could not initialize microphone recording.",
			);
		}

		return () => {
			isCancelled = true;
			if (intervalId) clearInterval(intervalId);
			if (sessionRef.current) {
				void sessionRef.current.cancel();
			}
		};
	}, []);

	useDialogKeyboard(async (key) => {
		if (statusRef.current === "recording") {
			if (
				key.name === "return" ||
				key.name === "enter" ||
				key.name === "space"
			) {
				key.preventDefault();
				setStatus("transcribing");

				const session = sessionRef.current;
				if (!session) {
					setStatus("error");
					setErrorMessage("No active recording session.");
					return;
				}

				try {
					const audioPath = await session.stop();
					sessionRef.current = null;
					const text = await transcribeAudioFile(audioPath);
					resolve({ ok: true, text });
				} catch (err) {
					setStatus("error");
					setErrorMessage(
						err instanceof Error
							? err.message
							: "Failed to transcribe recorded audio.",
					);
				}
				return;
			}

			if (key.name === "escape" || (key.ctrl && key.name === "c")) {
				key.preventDefault();
				if (sessionRef.current) {
					void sessionRef.current.cancel();
					sessionRef.current = null;
				}
				dismiss();
				return;
			}
		}

		if (statusRef.current === "error") {
			if (
				key.name === "escape" ||
				key.name === "return" ||
				key.name === "enter" ||
				key.name === "space"
			) {
				key.preventDefault();
				dismiss();
			}
		}
	}, dialogId);

	const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
	const ss = String(elapsedSeconds % 60).padStart(2, "0");
	const timeDisplay = `${mm}:${ss}`;

	return (
		<box flexDirection="column" paddingX={1} gap={1}>
			<box flexDirection="row" gap={1}>
				<text fg={palette.act}>🎙️  Voice Transcription (Speech-to-Text)</text>
			</box>

			{status === "recording" && (
				<box
					flexDirection="column"
					border
					borderColor="red"
					paddingX={1}
					gap={1}
				>
					<box flexDirection="row" gap={1}>
						<text fg="red">● Recording</text>
						<text fg="white">[{timeDisplay}]</text>
					</box>
					<text fg="gray">Speak clearly into your microphone...</text>
					<box flexDirection="column" marginTop={0}>
						<text fg="white">
							[Enter] or [Space] Stop recording and transcribe
						</text>
						<text fg="gray">[Esc] Cancel</text>
					</box>
				</box>
			)}

			{status === "transcribing" && (
				<box
					flexDirection="column"
					border
					borderColor="cyan"
					paddingX={1}
					gap={1}
				>
					<box flexDirection="row" gap={1}>
						<spinner name="dots" color={palette.act} />
						<text fg="cyan">Transcribing speech with Xro ASR...</text>
					</box>
					<text fg="gray">
						Processing microphone audio buffer, please wait...
					</text>
				</box>
			)}

			{status === "error" && (
				<box
					flexDirection="column"
					border
					borderColor="red"
					paddingX={1}
					gap={1}
				>
					<text fg="red">Recording / Transcription Notice</text>
					<text fg="yellow">{errorMessage}</text>
					<text fg="gray">Press [Esc] or [Enter] to dismiss</text>
				</box>
			)}
		</box>
	);
}
