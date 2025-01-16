# GitPaste Plugin for Obsidian

GitPaste is an Obsidian plugin designed to simplify handling and managing images in your notes. With GitPaste, you can easily upload images to GitHub, replace local references with GitHub URLs, and organize your image management workflow more efficiently.

---

## 🎯 Features

1. **Drag-and-Drop Upload**:

    - Drag and drop images into Obsidian to automatically upload them to GitHub.

2. **Clipboard Integration**:

    - Paste images directly into your notes and upload them seamlessly.

3. **Local Image Replacement**:

    - Automatically replace local image links with their GitHub URLs in Markdown.

4. **Delete Local Images** _(Optional)_:

    - Automatically delete local images after uploading them to GitHub.

5. **Image URL Logging** _(Optional)_:

    - Save all uploaded image URLs to a user-specified database file.

6. **Customizable Settings**:
    - Configure GitHub session, toggle deletion of local images, and manage logging preferences.

---

## 🚀 Installation

1. Clone or download the repository.
2. Place the plugin in your Obsidian plugins folder:
    ```
    <Your Vault>/.obsidian/plugins/gitpaste
    ```
3. Restart Obsidian and enable **GitPaste** in the plugin settings.

---

## ⚙️ Configuration

### 1. **GitHub Session**

-   **Description**: Required for uploading images to GitHub.
-   **How to Add**:
    -   Copy your GitHub session cookie (see the instructions below).
    -   Paste it into the "GitHub Session" field in the plugin settings.

### 2. **Delete Local Images**

-   **Description**: When enabled, deletes the local image file after uploading it to GitHub.
-   **How to Use**:
    -   Enable or disable it from the plugin settings.

### 3. **Log Uploaded Image URLs**

-   **Description**: Save URLs of uploaded images to a database file.
-   **How to Set Up**:
    -   Toggle logging in the plugin settings.
    -   Specify the path to the database file (e.g., `attachments/image_urls.md`).

---

## 🛠️ How to Get Your GitHub Session Cookie

1. Open your browser and go to [GitHub.com](https://github.com/).
2. Log into your GitHub account.
3. Open the **Developer Tools** (usually accessible via `F12` or `Ctrl+Shift+I`).
4. Navigate to the **Application** tab (or **Storage** in some browsers).
5. Look for the **Cookies** section and find the `github.com` domain.
6. Locate the cookie named `user_session` (or a similar session key like `__Host-user_session_same_site`).
7. Copy its value and paste it into the "GitHub Session" field in the plugin settings.

> ⚠️ **Warning**: Your GitHub session cookie is sensitive information. Do not share it publicly or with untrusted individuals.

---

## 📝 Usage

### Uploading and Replacing Images

1. **Drag and Drop**:

    - Drag any image file into your note.
    - GitPaste will upload the image to GitHub and replace the local reference with the GitHub URL.

2. **Pasting from Clipboard**:

    - Copy an image (e.g., using Snipping Tool).
    - Paste it directly into your note.

3. **Automatic Replacement**:

    - Local references like `![[image.png]]` will be replaced with GitHub links like:
        ```markdown
        ![image.png](https://github.com/user-attachments/assets/7e2baacd-21b1-4f8f-b502-32d2cbd5)
        ```

4. **Logging Uploaded URLs** _(Optional)_:
    - If enabled, GitPaste saves all uploaded URLs to a file for future reference.

---

## 🔧 Settings Overview

| Setting                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| **GitHub Session**     | Required to upload images to GitHub.                    |
| **Delete Local Image** | Toggle whether to delete local images after uploading.  |
| **Enable Logging**     | Save uploaded image URLs to a user-specified file.      |
| **Database File Path** | Path to the file where URLs will be saved (if enabled). |

---

## 📂 Example Log File (Database File)

If logging is enabled, GitPaste will save URLs to the specified file. Example file content:

```markdown
# Uploaded Images

-   **[2025-01-16]** ![example.png](https://github.com/user-attachments/assets/7e2baacd-21b1-4f8f-b502-32d2cbd5)
-   **[2025-01-17]** ![diagram.jpg](https://github.com/user-attachments/assets/7e2baacd-21b1-4f8f-b502)
```

---

## 📜 License

This plugin is open-source and distributed under the [MIT License](LICENSE).

---

## 🛠️ Contributing

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a detailed description of your changes.

---

## 💬 Support

For questions, issues, or suggestions, open an issue on the [GitHub repository](https://github.com/keptcodes/gitpaste).
