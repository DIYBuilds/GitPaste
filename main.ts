import { GitHub } from "lib/github";
import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface GitPasteSettings {
	githubSession: string; // Store the GitHub session cookie
}

export default class GitPaste extends Plugin {
	settings: GitPasteSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new GitPasteSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("editor-paste", (event: ClipboardEvent) => {
				if (event.clipboardData) {
					const items = event.clipboardData.items;
					for (let i = 0; i < items.length; i++) {
						const item = items[i];
						if (item.type.startsWith("image/")) {
							const file = item.getAsFile();
							this.handleImagePaste(file);
						}
					}
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-drop", (event: DragEvent) => {
				event.preventDefault();
				event.stopPropagation();

				const files = event.dataTransfer?.files;
				if (files) {
					// Handle the files dropped
					Array.from(files).forEach((file) => {
						if (file.type.startsWith("image/")) {
							// If it's an image, handle the image file
							this.handleImagePaste(file);
						}
					});
				}
			})
		);
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = data || { githubSession: "" };
	}

	// Save plugin settings to storage
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		console.log("unloading plugin");
	}

	async handleImagePaste(file: File | null) {
		if (file) {
			// // Save the image file to the vault in the 'attachments' folder

			if (this.settings.githubSession.length < 1) {
				new Notice("GitPaste: Please Add Github Session to use this.");
			}
			const gh = new GitHub(this.settings.githubSession);

			const { awsLink, githubLink } = await gh.upload(file.name, file.size, file);

			console.log(awsLink, githubLink)

			const filePath = githubLink;

			// // Get the current active markdown view
			const markdownView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			if (markdownView) {
				const editor = markdownView.editor;

				const originMarkdown = `![${file.name}](${file.webkitRelativePath})`;
				const imageMarkdown = `![${file.name}](${filePath})`;
				editor.replaceSelection(imageMarkdown);
			}
		}
	}
}

class GitPasteSettingTab extends PluginSettingTab {
	plugin: GitPaste;

	constructor(app: App, plugin: GitPaste) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Add the GitHub session setting UI
		new Setting(containerEl)
			.setName("GitHub Session")
			.setDesc(
				"Enter your GitHub session cookie. For more information, visit: https://github.com/keptcodes/gitpaste"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter GitHub session")
					.setValue(this.plugin.settings.githubSession)
					.onChange(async (value) => {
						this.plugin.settings.githubSession = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
