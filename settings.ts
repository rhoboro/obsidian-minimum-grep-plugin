import MinimumGrepPlugin from "./main";
import {App, PluginSettingTab, Setting} from "obsidian";


export class MinimumGrepPluginSettingTab extends PluginSettingTab {
	plugin: MinimumGrepPlugin;

	constructor(app: App, plugin: MinimumGrepPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		new Setting(containerEl).setName('rgLocation').addText(
			(text) => text.setPlaceholder('rg').setValue(this.plugin.settings.rgLocation).onChange(async (value) => {
				this.plugin.settings.rgLocation = value;
				await this.plugin.saveSettings()
			}));
		new Setting(containerEl).setName('maxFiles').addText(
			(text) => text.setPlaceholder('50').setValue(`${this.plugin.settings.maxFiles}`).onChange(async (value) => {
				this.plugin.settings.maxFiles = Number(value);
				await this.plugin.saveSettings()
			}));
		new Setting(containerEl).setName('minQueryLength').addText(
			(text) => text.setPlaceholder('2').setValue(`${this.plugin.settings.minQueryLength}`).onChange(async (value) => {
				this.plugin.settings.minQueryLength = Number(value);
				await this.plugin.saveSettings()
			}));
	}
}
