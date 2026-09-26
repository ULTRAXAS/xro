import { describe, expect, it } from "vitest";
import {
	buildSlashCommandRegistry,
	getVisibleSystemSlashCommands,
} from "../../commands/slash-command-registry";
import {
	buildCommandPaletteItems,
	type CommandPaletteAction,
	filterCommandPaletteItems,
	findCommandPaletteShortcut,
} from "./command-palette-items";

describe("command palette", () => {
	it("builds action-only palette items with shortcuts", () => {
		const items = buildCommandPaletteItems({
			canForkSession: false,
		});
		const labels = items.map((item) => item.label);

		expect(labels).toContain("Change Theme");
		expect(labels).toContain("Compact Context");
		expect(labels).not.toContain("/settings");
		expect(labels).not.toContain("Toggle Plan/Act Mode");
		expect(labels).not.toContain("Toggle Auto-Approve");
		expect(labels).not.toContain("Create Session Fork");
		expect(items.every((item) => item.shortcut.startsWith("Opt+"))).toBe(true);
		expect(items.map((item) => item.shortcut)).not.toContain("Opt+?");
	});

	it("covers visible local slash commands with palette wording", () => {
		const registry = buildSlashCommandRegistry({
			canFork: true,
		});
		const slashCommands = getVisibleSystemSlashCommands(registry).filter(
			(command) => command.source === "tui",
		);
		const items = buildCommandPaletteItems({
			canForkSession: true,
		});
		const paletteByCommandName = new Map(
			items.map((item) => [item.result.action, item]),
		);

		for (const command of slashCommands) {
			expect(
				paletteByCommandName.has(command.name as CommandPaletteAction),
			).toBe(true);
		}
		expect(paletteByCommandName.get("account")?.description).toBe(
			"View Xro account and credits",
		);
	});

	it("ranks direct actions over lower confidence matches", () => {
		const items = buildCommandPaletteItems({
			canForkSession: true,
		});

		expect(filterCommandPaletteItems(items, "theme")[0]?.label).toBe(
			"Change Theme",
		);
		expect(filterCommandPaletteItems(items, "opt t")[0]?.label).toBe(
			"Change Theme",
		);
	});

	it("finds opt shortcut matches without using searchable text input keys", () => {
		const items = buildCommandPaletteItems({
			canForkSession: true,
		});

		expect(
			findCommandPaletteShortcut(items, {
				name: "t",
				meta: true,
				option: false,
				shift: false,
			})?.label,
		).toBe("Change Theme");
		expect(
			findCommandPaletteShortcut(items, {
				name: "t",
				meta: false,
				option: true,
				shift: false,
			})?.label,
		).toBe("Change Theme");
		expect(
			findCommandPaletteShortcut(items, {
				name: "t",
				meta: false,
				option: false,
				shift: false,
			}),
		).toBeUndefined();
		expect(
			findCommandPaletteShortcut(items, {
				name: "k",
				meta: true,
				option: false,
				shift: false,
			})?.label,
		).toBe("Open Help");
	});
});
