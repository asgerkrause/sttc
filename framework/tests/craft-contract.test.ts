import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const src = join(import.meta.dir, "..", "..", "src");
const repo = join(import.meta.dir, "..", "..");

async function sourceText() {
	const files = [
		...new Bun.Glob("**/*.html").scanSync({ cwd: src, absolute: true }),
		...new Bun.Glob("**/*.css").scanSync({ cwd: src, absolute: true }),
	];
	return (await Promise.all(files.map((file) => Bun.file(file).text()))).join("\n");
}

async function htmlText() {
	const files = [...new Bun.Glob("**/*.html").scanSync({ cwd: src, absolute: true })];
	return (await Promise.all(files.map((file) => Bun.file(file).text()))).join("\n");
}

async function cssText() {
	const files = [...new Bun.Glob("**/*.css").scanSync({ cwd: src, absolute: true })];
	return (await Promise.all(files.map((file) => Bun.file(file).text()))).join("\n");
}

describe("Craft source contract", () => {
	test("uses full-word primitive classes", async () => {
		const source = await sourceText();
		const html = await htmlText();
		const css = await cssText();
		for (const legacy of ["c", "w", "crd", "btn", "btns", "lnk", "lnks", "img-w", "eb", "btn-vis-w", "btn-txt-w"]) {
			expect(html).not.toMatch(new RegExp(`class=["'][^"']*(?:^|\\s)${legacy}(?:\\s|$)[^"']*["']`));
			expect(css).not.toMatch(new RegExp(`(^|[\\s,{>+~])\\.${legacy}(?=[\\s,:.#>+~[{]|$)`, "m"));
		}
		for (const primitive of ["container", "stack", "card", "button", "buttons", "link", "links", "media", "eyebrow"]) {
			expect(source).toContain(`.${primitive}`);
		}
	});

	test("preserves unrelated words, hooks, and color utilities", async () => {
		const source = await sourceText();
		expect(source).toContain("Web Development");
		expect(source).toContain(".vid-w");
		for (const utility of ["c-ink", "c-mut", "c-bg", "c-acc", "c-sec"]) {
			expect(source).toContain(`.${utility}`);
		}
		expect(source).not.toContain("Weyebrow Development");
		expect(source).not.toContain(".container-ink");
	});

	test("imports the responsive utility layer after wrappers", async () => {
		const shell = await Bun.file(join(src, "styles.css")).text();
		expect(existsSync(join(src, "styles", "utilities.css"))).toBe(true);
		expect(shell).toContain("wrappers, utilities, motion");
		expect(shell).toContain('@import "utilities.css";');
	});

	test("supports token-bound responsive type and spacing attributes", async () => {
		const css = await Bun.file(join(src, "styles", "utilities.css")).text();
		for (const attribute of ["t", "gp", "mg", "mg-t", "mg-r", "mg-b", "mg-l", "mg-tb", "mg-lr", "pd", "pd-t", "pd-r", "pd-b", "pd-l", "pd-tb", "pd-lr"]) {
			expect(css).toContain(`[${attribute}]`);
		}
		for (const selector of ['[t$="lg"]', '[t*="-h4-"]', '[t^="h2"]', '[gp$="sm"]', '[gp*="-lg-"]', '[gp^="xl"]']) {
			expect(css).toContain(selector);
		}
		expect(css).toContain("var(--s-gp-xl)");
		expect(css).toContain("var(--s-pd-xl)");
		for (const token of ["--t-lg-ff", "--t-lg-fs", "--t-lg-fw", "--t-lg-lh", "--t-lg-ls", "--t-lg-mw", "--t-lg-tt"]) {
			expect(css).toContain(`var(${token})`);
		}
		expect(css).not.toContain("var(--t-lg)");
		expect(css).not.toContain("var(--t-md)");
		expect(css).not.toContain("var(--t-sm)");
		expect(css).not.toMatch(/\[(?:t|gp|mg[^\]]*|pd[^\]]*)[^\]]*=.*(?:px|rem)/);
	});

	test("orders spacing declarations from broad to specific", async () => {
		const css = await Bun.file(join(src, "styles", "utilities.css")).text();
		for (const [all, axis, side] of [
			[":where([mg])", ":where([mg-tb])", ":where([mg-t])"],
			[":where([mg])", ":where([mg-lr])", ":where([mg-l])"],
			[":where([pd])", ":where([pd-tb])", ":where([pd-t])"],
			[":where([pd])", ":where([pd-lr])", ":where([pd-l])"],
		]) {
			expect(css.indexOf(all)).toBeLessThan(css.indexOf(axis));
			expect(css.indexOf(axis)).toBeLessThan(css.indexOf(side));
		}
	});

	test("keeps directional spacing values independent", async () => {
		const css = await Bun.file(join(src, "styles", "utilities.css")).text();
		for (const selector of [
			'[mg-t$="xl"] { --u-mg-t: var(--s-gp-xl); }',
			'[mg-b$="sm"] { --u-mg-b: var(--s-gp-sm); }',
			'[mg-lr*="-0-"] { --u-mg-lr: 0; }',
			'[pd-t^="lg"] { --u-pd-t: var(--s-pd-lg); }',
			'[pd-b$="xs"] { --u-pd-b: var(--s-pd-xs); }',
		]) {
			expect(css).toContain(selector);
		}
	});

	test("keeps presets and author-facing docs on full-word primitives", async () => {
		const files = [
			"framework/build/component-presets.ts",
			"framework/docs/components.md",
			"framework/docs/agent-guide.md",
			"framework/docs/client-site-playbook.md",
			"framework/docs/framework/01-quickstart.md",
			"framework/docs/framework/05-components.md",
			"framework/docs/framework/06-css-system.md",
			"framework/docs/framework/08-content-and-cms.md",
			"framework/docs/framework/12-forms-and-embeds.md",
			"framework/docs/framework/15-agent-workflow.md",
			"framework/docs/framework/16-recipes.md",
			"framework/docs/decisions/component-styles.md",
			"README.md",
			".pi/domain.md",
		];
		const legacy = /class=["'][^"']*(?:^|\s)(?:c|w|crd|btn|btns|lnk|lnks|img-w|eb)(?:\s|$)[^"']*["']|\.(?:btns|lnks|img-w)(?=[\s,:.#>+~[{]|$)/m;
		for (const file of files) {
			const content = await Bun.file(join(repo, file)).text();
			expect(content).not.toMatch(legacy);
		}
		const readme = await Bun.file(join(repo, "README.md")).text();
		expect(readme).not.toContain("data-accent=");
		for (const file of [
			"framework/docs/components.md",
			"framework/docs/framework/06-css-system.md",
			"framework/docs/agent-guide.md",
		]) {
			expect(await Bun.file(join(repo, file)).text()).toContain("utilities.css");
		}
	});
});
