import { describe, expect, it } from "vitest";
import {
	buildSlashCommandRegistry,
	expandUserCommandPrompt,
	formatSlashCommandAutocompleteValue,
	getInvokableUserSlashCommands,
	getVisibleSystemSlashCommands,
	getVisibleUserSlashCommands,
	resolveSlashCommand,
} from "./slash-command-registry";

describe("slash command registry", () => {
	it("keeps TUI-local commands local even when runtime also advertises them", () => {
		const registry = buildSlashCommandRegistry({
			canFork: true,
			workflowSlashCommands: [
				{
					name: "settings",
					instructions: "",
					description: "Runtime settings",
				},
				{
					name: "team",
					instructions: "/team [prompt]",
					description: "Start a task with agent team",
				},
				{
					name: "mcp",
					instructions: "",
					description: "Runtime MCP",
				},
			],
		});

		expect(resolveSlashCommand(registry, "settings")).toMatchObject({
			source: "runtime",
			execution: "runtime",
			description: "Runtime settings",
			visible: true,
		});
		expect(resolveSlashCommand(registry, "team")).toMatchObject({
			source: "runtime",
			execution: "runtime",
		});
		expect(resolveSlashCommand(registry, "mcp")).toMatchObject({
			source: "runtime",
			execution: "runtime",
			description: "Runtime MCP",
			visible: true,
		});
	});

	it("surfaces plugin commands as runtime-executable commands", () => {
		const registry = buildSlashCommandRegistry({
			additionalSlashCommands: [
				{
					name: "/Echo",
					instructions: "",
					description: "Echo input",
				},
			],
		});
		const command = resolveSlashCommand(registry, "echo");

		expect(command).toMatchObject({
			name: "echo",
			source: "plugin",
			execution: "runtime",
			visible: true,
			selectable: true,
		});
		expect(command ? formatSlashCommandAutocompleteValue(command) : "").toBe(
			"/echo ",
		);
	});

	it("surfaces skills and workflows in autocomplete and the skills picker", () => {
		const registry = buildSlashCommandRegistry({
			workflowSlashCommands: [
				{
					name: "review",
					instructions: "Review carefully",
					description: "Review files",
					kind: "skill",
				},
				{
					name: "release",
					instructions: "Prepare release",
					description: "Release workflow",
					kind: "workflow",
				},
			],
		});

		expect(
			getVisibleSystemSlashCommands(registry).map((cmd) => cmd.name),
		).toEqual(expect.arrayContaining(["account", "quit"]));
		expect(resolveSlashCommand(registry, "skills")).toBeUndefined();
		expect(resolveSlashCommand(registry, "quit")).toMatchObject({
			source: "tui",
			execution: "local",
			description: "Exit Xro cli",
			visible: true,
		});
		expect(
			getVisibleUserSlashCommands(registry).map((cmd) => cmd.name),
		).toEqual(["review", "release"]);
		expect(
			getInvokableUserSlashCommands(registry).map((cmd) => cmd.name),
		).toEqual(["review", "release"]);
		const review = resolveSlashCommand(registry, "review");
		expect(review).toMatchObject({
			source: "skill",
			execution: "user-command",
			visible: true,
			selectable: true,
		});
		expect(review ? formatSlashCommandAutocompleteValue(review) : "").toBe(
			"/review ",
		);
		expect(resolveSlashCommand(registry, "release")).toMatchObject({
			source: "workflow",
			execution: "user-command",
			visible: true,
			selectable: true,
		});
	});

	it("expands user command tokens and manually typed user commands before submission", () => {
		const registry = buildSlashCommandRegistry({
			workflowSlashCommands: [
				{
					name: "review",
					instructions: "Review carefully",
					description: "Review files",
					kind: "skill",
				},
			],
		});

		expect(expandUserCommandPrompt("/review this file", registry)).toBe(
			'<user_command slash="review">Review carefully</user_command> this file',
		);
		expect(expandUserCommandPrompt("please /review this file", registry)).toBe(
			'please <user_command slash="review">Review carefully</user_command> this file',
		);
		expect(
			expandUserCommandPrompt(
				'<user_command slash="review">Review carefully</user_command> this file',
				registry,
			),
		).toBe(
			'<user_command slash="review">Review carefully</user_command> this file',
		);
		expect(expandUserCommandPrompt("/settings", registry)).toBe("/settings");
	});

	it("keeps skill commands typed when skill expansion is off, but still wraps workflows", () => {
		const registry = buildSlashCommandRegistry({
			workflowSlashCommands: [
				{
					name: "review",
					instructions: "Review carefully",
					description: "Review files",
					kind: "skill",
				},
				{
					name: "release",
					instructions: "Run the release workflow",
					description: "Release",
					kind: "workflow",
				},
			],
		});
		const options = { expandSkillCommands: false };

		// The skills tool delivers the instructions; the transcript keeps the
		// typed command.
		expect(
			expandUserCommandPrompt("/review this file", registry, options),
		).toBe("/review this file");
		expect(
			expandUserCommandPrompt("please /review this file", registry, options),
		).toBe("please /review this file");
		// Workflows are not served by the skills tool and keep expanding.
		expect(expandUserCommandPrompt("/release now", registry, options)).toBe(
			'<user_command slash="release">Run the release workflow</user_command> now',
		);
	});

	it("does not expand commands omitted from a refreshed user-command registry", () => {
		const staleRegistry = buildSlashCommandRegistry({
			workflowSlashCommands: [
				{
					name: "find-skills",
					instructions: "Find installable skills.",
					description: "Find skills",
					kind: "skill",
				},
			],
		});
		const refreshedRegistry = buildSlashCommandRegistry({
			workflowSlashCommands: [],
		});

		expect(
			expandUserCommandPrompt("/find-skills what can u do?", staleRegistry),
		).toContain("<user_command");
		expect(
			resolveSlashCommand(refreshedRegistry, "find-skills"),
		).toBeUndefined();
		expect(
			expandUserCommandPrompt("/find-skills what can u do?", refreshedRegistry),
		).toBe("/find-skills what can u do?");
	});

	it("has no local fork command", () => {
		const emptySessionRegistry = buildSlashCommandRegistry({ canFork: false });
		const activeSessionRegistry = buildSlashCommandRegistry({ canFork: true });

		expect(resolveSlashCommand(emptySessionRegistry, "fork")).toBeUndefined();
		expect(resolveSlashCommand(activeSessionRegistry, "fork")).toBeUndefined();
		expect(
			getVisibleSystemSlashCommands(emptySessionRegistry).map(
				(command) => command.name,
			),
		).not.toContain("fork");
		expect(
			getVisibleSystemSlashCommands(activeSessionRegistry).map(
				(command) => command.name,
			),
		).not.toContain("fork");
	});

	it("has no local skills command", () => {
		const emptyRegistry = buildSlashCommandRegistry({});

		expect(resolveSlashCommand(emptyRegistry, "skills")).toBeUndefined();
		expect(
			getVisibleSystemSlashCommands(emptyRegistry).map(
				(command) => command.name,
			),
		).not.toContain("skills");
	});

	it("has no local plugins, mcp, or model command", () => {
		const registry = buildSlashCommandRegistry({});
		const commandNames = getVisibleSystemSlashCommands(registry).map(
			(command) => command.name,
		);

		expect(resolveSlashCommand(registry, "plugins")).toBeUndefined();
		expect(resolveSlashCommand(registry, "mcp")).toBeUndefined();
		expect(resolveSlashCommand(registry, "model")).toBeUndefined();
		expect(commandNames).not.toContain("plugins");
		expect(commandNames).not.toContain("mcp");
		expect(commandNames).not.toContain("model");
		expect(commandNames).not.toContain("skills");
	});

	it("has no local config or settings command", () => {
		const registry = buildSlashCommandRegistry({ canFork: true });

		expect(resolveSlashCommand(registry, "config")).toBeUndefined();
		expect(resolveSlashCommand(registry, "settings")).toBeUndefined();
		const commandNames = getVisibleSystemSlashCommands(registry).map(
			(command) => command.name,
		);
		expect(commandNames).not.toContain("config");
		expect(commandNames).not.toContain("settings");
	});

	it("always exposes the account command", () => {
		const registry = buildSlashCommandRegistry({});

		expect(resolveSlashCommand(registry, "account")).toMatchObject({
			source: "tui",
			execution: "local",
			visible: true,
		});
		expect(
			getVisibleSystemSlashCommands(registry).map((command) => command.name),
		).toContain("account");
	});
});
