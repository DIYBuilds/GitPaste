import { GitHub } from "./lib/github";
import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,

} from "obsidian";

interface GitPasteSettings {
	githubSession: string;
	deleteLocalImage: boolean;
	showNotices: boolean; // Toggle notices
	enableLogging: boolean; // Toggle URL logging
	logFilePath: string; // Path to the database file for logging
}

const DEFAULT_SETTINGS: GitPasteSettings = {
	githubSession: "",
	deleteLocalImage: false,
	showNotices: true,
	enableLogging: false,
	logFilePath: "uploaded-images.md",
};

export default class GitPaste extends Plugin {
	settings: GitPasteSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new GitPasteSettingTab(this.app, this));


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



		this.registerEvent(
			this.app.vault.on("create", async (file: TFile) => {
				if (file.extension && file.extension.match(/png|jpg|jpeg|gif|bmp/i)) {
					const data = await this.app.vault.readBinary(file);
					const blob = new Blob([data], { type: `image/${file.extension}` });
					const uploadedFile = new File([blob], file.name, {
						type: `image/${file.extension}`,
					});
					await this.handleImagePaste(uploadedFile);

					if (this.settings.deleteLocalImage) {
						await this.app.fileManager.trashFile(file)
						this.showNotice("Local Image is trashed");
					}
				}
			})
		);
	}

	async handleImagePaste(file: File | null) {
		if (!file) return;


		if (this.settings.githubSession.length < 1) {
			this.showNotice("GitPaste: Please Add GitHub Session to use this.");
			return;
		}
		const gh = new GitHub(this.settings.githubSession);


		try {
			const { githubLink } = await gh.upload(file.name, file.size, file);

			const filePath = githubLink;

			// // Get the current active markdown view
			const markdownView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			if (markdownView) {
				const editor = markdownView.editor;
				const cursorPosition = editor.getCursor();
				const lineContent = editor.getLine(cursorPosition.line);
				const localMarkdownRegex = new RegExp(
					`!\\[\\[${file.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\]\\]`
				);

				if (localMarkdownRegex.test(lineContent)) {
					// Replace local markdown with GitHub markdown
					const updatedLine = lineContent.replace(
						localMarkdownRegex,
						`![${file.name}](${filePath})`
					);
					editor.setLine(cursorPosition.line, updatedLine);
					this.showNotice("Replaced local image link with GitHub URL.");
				} else {
					// Insert new image markdown at the cursor position
					const imageMarkdown = `![${file.name}](${filePath})`;
					editor.replaceRange(imageMarkdown, cursorPosition);
					this.showNotice("Inserted GitHub image link.");
				}
			}

			// Log the uploaded URL
			if (this.settings.enableLogging) {
				await this.logImageURL(file.name, githubLink);
			}


		} catch (error) {
			console.error("Error uploading image:", error);
			this.showNotice(`${error.message}. Please check the console for details.`);
		}
	}

	async logImageURL(fileName: string, githubLink: string) {
		const logFilePath = this.settings.logFilePath;
		let file = this.app.vault.getAbstractFileByPath(logFilePath);

		if (!file) {
			file = await this.app.vault.create(logFilePath, "");
		}

		if (file instanceof TFile) {
			const currentContent = await this.app.vault.read(file);
			const newContent = `${currentContent}\n- ${fileName}: ${githubLink}`;
			await this.app.vault.modify(file, newContent);
		}
	}

	showNotice(message: string) {
		if (this.settings.showNotices) {
			new Notice(`GitPaste: ${message}`);
		}
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	// Save plugin settings to storage
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		console.log("GitPaste plugin unloaded.");
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


		new Setting(containerEl)
			.setName("Delete Local Image")
			.setDesc("Delete the local image after uploading it to GitHub.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.deleteLocalImage)
					.onChange(async (value) => {
						this.plugin.settings.deleteLocalImage = value;
						await this.plugin.saveSettings();
					})
			);



		new Setting(containerEl)
			.setName("Show Notices")
			.setDesc("Enable or disable notices for actions.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showNotices)
					.onChange(async (value) => {
						this.plugin.settings.showNotices = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable Logging")
			.setDesc("Log all uploaded image URLs to a specified file.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableLogging)
					.onChange(async (value) => {
						this.plugin.settings.enableLogging = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Log File Path")
			.setDesc("Specify the path for the log file.")
			.addText((text) =>
				text
					.setPlaceholder("e.g., uploaded-images.md")
					.setValue(this.plugin.settings.logFilePath)
					.onChange(async (value) => {
						this.plugin.settings.logFilePath = value;
						await this.plugin.saveSettings();
					})
			);



	}
}
