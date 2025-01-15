import * as fs from "fs";
import * as path from "path";
import * as mime from "mime-types";
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

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
  private client: AxiosInstance;
  private repo: string;
  private repoId: number | null;
  private userSession: string;

  constructor(userSession: string, repo: string = "cli/cli") {
    this.repo = repo || "cli/cli";
    this.repoId = this.repo === "cli/cli" ? 212613049 : null;
    this.userSession = userSession;

    const jar = new CookieJar(); // Initialize a new cookie jar

    jar.setCookieSync(
      `user_session=${userSession}; Secure; SameSite=Lax`,
      "https://github.com"
    );
    jar.setCookieSync(
      `__Host-user_session_same_site=${userSession}; Secure; SameSite=Lax`,
      "https://github.com"
    );

    this.client = wrapper(
      axios.create({
        baseURL: "https://github.com",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "X-Requested-With": "XMLHttpRequest",
        },
        jar, // Attach CookieJar
        withCredentials: true, // Allow cookies to be sent with requests
      })
    );

    this.client.interceptors.request.use((config) => {
      const cookies = jar.getCookiesSync("https://github.com");
      return config;
    });

    // Fallback: Manually add cookies if needed
    this.client.interceptors.request.use((config) => {
      const cookies = jar
        .getCookiesSync("https://github.com")
        .map((cookie) => cookie.cookieString())
        .join("; ");
      config.headers["Cookie"] = cookies;
      return config;
    });
  }

  private async getRepoId(): Promise<number | null> {
    if (this.repoId) return this.repoId;

    try {
      const response = await this.client.get(
        `https://api.github.com/repos/${this.repo}`
      );
      this.repoId = response.data.id;
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


      const response = await this.client.post<UploadPolicy>(
        "https://github.com/upload/policies/assets",
        formData.toString(),
        {
          headers: {
            "Github-Verified-Fetch": "true",
            Origin: "https://github.com",
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const policy: UploadPolicy = response.data;
      return policy;
    } catch (error: any) {
      console.log(error)
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
      await this.client.put(
        `https://github.com${policy.asset_upload_url}`,
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
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
    const fileBuffer = await file.arrayBuffer();

    try {
      const boundary =
        "----WebKitFormBoundary" +
        Math.random().toString(36).substring(2);

      // Manually construct multipart form data
      const parts: (ArrayBuffer | string)[] = [];

      // Add form fields
      Object.entries(policy.form).forEach(([key, value]) => {
        parts.push(
          Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
            `${value}\r\n`
          )
        );
      });

      // Add file
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${name}"\r\n` +
          `Content-Type: ${contentType}\r\n\r\n`
        )
      );
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      // Combine all parts into a single ArrayBuffer
      const textEncoder = new TextEncoder();
      const buffers = parts.map(part =>
        typeof part === 'string' ? textEncoder.encode(part) : new Uint8Array(part)
      );

      const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
      const body = new Uint8Array(totalLength);

      let offset = 0;
      buffers.forEach(buf => {
        body.set(buf, offset);
        offset += buf.length;
      });


      const response = await this.client.post(policy.upload_url, body, {
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
          Accept: "*/*",
          Connection: "keep-alive",
          Host: new URL(policy.upload_url).host,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        // Prevent axios from modifying the request
        // transformRequest: [(data) => data],
      });

      const awsLink = response.headers.location || "";

      await this.markUploadComplete(policy);

      return {
        githubLink: policy.asset.href,
        awsLink,
      };
    } catch (error) {
      console.log(error);
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
