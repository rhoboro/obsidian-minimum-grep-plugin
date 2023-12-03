import {App, FileSystemAdapter, Plugin, SuggestModal, TFile} from 'obsidian';
import {spawn} from "child_process";
import {MinimumGrepPluginSettingTab} from "./settings";

export interface MinimumGrepSettings {
	rgLocation: string;
	maxFiles: number;
	minQueryLength: number;
}

const DEFAULT_SETTINGS: MinimumGrepSettings = {
	rgLocation: '/opt/homebrew/bin/rg',
	maxFiles: 50,
	minQueryLength: 2,
}

class Match {
	num: number;
	line: string;

	constructor(num: string, line: string) {
		this.num = Number(num);
		this.line = line;
	}
}

class RgResult {
	name: string;
	path: string;
	line: string;
	matches: Match[];
	searchPath: string;
	title: string;
	file: TFile;

	constructor(path: string, num: string, line: string, searchPath: string) {
		this.path = path;
		this.name = path.replace(searchPath + '/', '');
		this.line = line;
		this.matches = [new Match(num, line)]
		this.searchPath = searchPath;
	}
}


export class GrepModal extends SuggestModal<RgResult> {
	settings: MinimumGrepSettings;

	constructor(app: App, settings: MinimumGrepSettings) {
		super(app);
		this.settings = settings;
	}

	async getSuggestions(query: string): Promise<RgResult[]> {
		if (query.length <= this.settings.minQueryLength && /^[\x20-\x7e]*$/.test(query)) {
			return []
		}
		const adapter = this.app.vault.adapter;
		const searchPath = (adapter instanceof FileSystemAdapter) ? adapter.getBasePath() : '';
		let results: RgResult[] = [];
		const proc = spawn(this.settings.rgLocation, ['-i', '-n', '--no-heading', query, searchPath], {stdio: ['ignore', 'pipe', 'pipe']});
		for await (const result of proc.stdout) {
			results = results.concat(result.toString().split('\n').map((value: string) => {
				const matched = value.match(/(.*):(\d+):(.*)/);
				if (matched && matched.length == 4 && /.md$/.test(matched[1]) && !/^- \[\[.*]]$/.test(matched[3])) {
					return new RgResult(matched[1], matched[2], matched[3], searchPath);
				} else {
					return null;
				}
			}).filter((value: RgResult | null) => !!value))
		}
		return results.reduce((x: RgResult[], current) => {
			if (x.length > this.settings.maxFiles) {
				return x;
			}
			const exists = x.find(value => value.path == current.path);
			if (exists) {
				if (exists.matches.length < 5) {
					exists.matches.push(current.matches[0]);
				}
			} else {
				const file = this.app.vault.getAbstractFileByPath(current.name);
				if (file instanceof TFile) {
					current.file = file;
					const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter
					if (frontMatter) {
						if ('title' in frontMatter && frontMatter['title']) {
							current.title = frontMatter['title'];
							x.push(current);
						}
					}
				}
			}
			return x;
		}, []).sort((a, b) => {
			const q = query.toLowerCase();
			if (a.title.toLowerCase().includes(q) && b.title.toLowerCase().includes(q)) {
				return Number((a.title.toLowerCase() <= b.title.toLowerCase()));
			} else if (a.title.toLowerCase().includes(q)) {
				return -1;
			} else if (b.title.toLowerCase().includes(q)) {
				return 1
			}
			if (a.matches.length == b.matches.length) {
				return Number((a.title.toLowerCase() <= b.title.toLowerCase()));
			}
			return Number(a.matches.length > b.matches.length);
		});
	}

	renderSuggestion(result: RgResult, el: HTMLElement) {
		el.createEl("h1", {text: result.title})
		const content = result.matches.reduce((v, m) => {
			return v ? `${v}\n${m.num}: ${m.line}` : `${m.num}: ${m.line}`;
		}, '');
		el.createEl("small", {text: content});
	}

	onChooseSuggestion(result: RgResult, evt: MouseEvent | KeyboardEvent) {
		const file = this.app.vault.getAbstractFileByPath(result.name);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			if (leaf) {
				return leaf.openFile(file);
			}
		}
	}
}

export default class MinimumGrepPlugin extends Plugin {
	settings: MinimumGrepSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MinimumGrepPluginSettingTab(this.app, this));

		this.addCommand({
			id: 'open-minimum-grep-modal',
			name: 'Open minimum grep modal',
			callback: () => {
				new GrepModal(this.app, this.settings).open();
			},
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

