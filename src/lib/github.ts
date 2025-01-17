import * as fs from "fs";
import * as path from "path";
import * as mime from "mime-types";
import { requestUrl } from "obsidian";
import { payloadGenerator } from "./payload-gen";

interface UploadPolicy {
	upload_url: string;
	upload_authenticity_token: string;
	asset_upload_url: string;
	asset_upload_authenticity_token: string;
	asset: {
		id: number;
		name: string;
		size: number;
		content_type: string;
		href: string;
		original_name: string;
	};
	form: Record<string, string>;
	header: any;
	same_origin: boolean;
}

interface UploadResult {
	githubLink: string;
	awsLink: string;
}

export class GitHub {
	private repo: string;
	private repoId: number | null;
	private userSession: string;

	constructor(userSession: string, repo: string = "cli/cli") {
		this.repo = repo || "cli/cli";
		this.repoId = this.repo === "cli/cli" ? 212613049 : null;
		this.userSession = userSession;
	}

	private async getRepoId(): Promise<number | null> {
		if (this.repoId) return this.repoId;

		try {
			const response = await requestUrl({
				url: `https://api.github.com/repos/${this.repo}`,
				method: 'GET',
			})
			const data = response.json
			this.repoId = data.id;
			return this.repoId;
		} catch (error) {
			throw new Error(`Failed to get repo ID: ${error}`);
		}
	}

	private async getPolicy(
		name: string,
		size: number,
		contentType: string
	): Promise<UploadPolicy> {
		if (!this.repoId) {
			await this.getRepoId();
		}

		const formData = new URLSearchParams();
		formData.append("repository_id", this.repoId!.toString());
		formData.append("name", name);
		formData.append("size", size.toString());
		formData.append("content_type", contentType);

		try {

			const response = await requestUrl({
				url: "https://github.com/upload/policies/assets",
				method: "POST",
				headers: {
					"Github-Verified-Fetch": "true",
					"Origin": "https://github.com",
					"Content-Type": "application/x-www-form-urlencoded",
					"Cookie": `user_session=${this.userSession}; __Host-user_session_same_site=${this.userSession};`, // Manually add cookies to the header
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
					"X-Requested-With": "XMLHttpRequest",

				},
				body: formData.toString(),
			});

			if (response.status != 201) {
				console.error(response.text)
				throw new Error("Your Github session is expired. Add again");
			}

			const policy: UploadPolicy = response.json;
			return policy;
		} catch (error: any) {
			throw new Error(`Failed to get upload policy: ${error}`);
		}
	}

	private async markUploadComplete(policy: UploadPolicy): Promise<void> {
		const formData = new URLSearchParams();
		formData.append(
			"authenticity_token",
			policy.asset_upload_authenticity_token
		);

		try {
			await requestUrl({
				url: `https://github.com${policy.asset_upload_url}`,
				method: "PUT",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"Cookie": `user_session=${this.userSession}; __Host-user_session_same_site=${this.userSession};`, // Manually add cookies to the header
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
					"X-Requested-With": "XMLHttpRequest",
				},
				contentType: "application/x-www-form-urlencoded",
				body: formData.toString(),
				throw: false
			});
		} catch (error) {
			throw new Error(`Failed to mark upload as complete: ${error}`);
		}
	}

	async upload(
		name: string,
		size: number,
		file: File
	): Promise<UploadResult> {
		const ext = path.extname(name);
		const contentType = mime.lookup(ext) || "application/octet-stream";
		const policy = await this.getPolicy(name, size, contentType);


		try {
			const payload_data = {
				...policy.form, // Spread all the form fields from the policy
				file: file,
			};


			const [request_body, boundary_string] = await payloadGenerator(
				payload_data
			);
			const response = await requestUrl({
				url: policy.upload_url,
				method: 'POST',
				headers: {
					contentType: `multipart/form-data; boundary=----${boundary_string}`,
					Accept: "*/*",
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
					"X-Requested-With": "XMLHttpRequest",
				},
				contentType: `multipart/form-data; boundary=----${boundary_string}`,
				body: request_body,
			});

			if (![201, 204].includes(response.status)) {
				throw new Error(`Upload failed with status: ${response.status}`);
			}

			const awsLink = response.headers.location || "";

			await this.markUploadComplete(policy);

			return {
				githubLink: policy.asset.href,
				awsLink,
			};
		} catch (error) {
			throw new Error(`Failed to upload file: ${error}`);
		}
	}

	async uploadFromPath(filePath: string): Promise<UploadResult> {
		try {
			const stats = fs.statSync(filePath);
			const file = await this.createFileFromPath(filePath);
			return this.upload(path.basename(filePath), stats.size, file);
		} catch (error) {
			throw new Error(`Failed to upload file from path: ${error}`);
		}
	}

	async createFileFromPath(filepath: string): Promise<File> {
		// Read the file
		const buffer = await fs.promises.readFile(filepath);

		// Get the filename
		const filename = path.basename(filepath);

		// Detect mime type
		const mimeType = mime.lookup(filepath) || 'application/octet-stream';

		// Convert Buffer to Blob
		const blob = new Blob([buffer], { type: mimeType });

		// Create File object
		return new File([blob], filename, { type: mimeType });
	}


}
