export interface VoiceControlBarProps {
	status: "idle" | "recording" | "finalizing" | "error";
	elapsedSeconds: number;
	errorMessage?: string;
	onStop: () => void;
	onCancel: () => void;
	accent?: string;
}

function formatElapsed(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function VoiceControlBar(props: VoiceControlBarProps) {
	const { status, elapsedSeconds, errorMessage, accent = "cyan" } = props;

	if (status === "idle") {
		return null;
	}

	if (status === "recording") {
		return (
			<box
				flexDirection="row"
				alignItems="center"
				justifyContent="space-between"
				paddingX={1}
				paddingY={0}
				border={["bottom"]}
				borderStyle="single"
				borderColor="gray"
			>
				<box flexDirection="row" gap={1} alignItems="center">
					<text fg="red">● Recording</text>
					<text fg="white">[{formatElapsed(elapsedSeconds)}]</text>
					<text fg={accent}>🎙️ Streaming to composer...</text>
				</box>
				<box flexDirection="row" gap={2} alignItems="center">
					<text fg="white">
						<strong>[Enter]</strong> Stop & Insert
					</text>
					<text fg="gray">
						<strong>[Esc]</strong> Cancel
					</text>
					<text fg="gray">
						<strong>[Opt+V]</strong> Stop
					</text>
				</box>
			</box>
		);
	}

	if (status === "finalizing") {
		return (
			<box
				flexDirection="row"
				alignItems="center"
				gap={1}
				paddingX={1}
				paddingY={0}
				border={["bottom"]}
				borderStyle="single"
				borderColor="gray"
			>
				<text fg={accent}>⌛ Finalizing transcript with Xro ASR...</text>
			</box>
		);
	}

	if (status === "error") {
		return (
			<box
				flexDirection="row"
				alignItems="center"
				justifyContent="space-between"
				paddingX={1}
				paddingY={0}
				border={["bottom"]}
				borderStyle="single"
				borderColor="red"
			>
				<text fg="red">⚠️ {errorMessage || "Voice transcription error"}</text>
				<text fg="gray">[Esc] Dismiss</text>
			</box>
		);
	}

	return null;
}
