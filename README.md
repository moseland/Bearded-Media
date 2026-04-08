# Bearded Media

Bearded Media is a WordPress plugin designed to improve media management through AI-powered optimization and vision-based automation. It streamlines the workflow for uploading, tagging, and editing media directly within the WordPress dashboard.

## Key Features

-   **Client-Side Optimization**: Automatically optimize images before they are uploaded to the server, reducing server load and storage requirements.
-   **Vision-Based Auto-Tagging**: Leverages AI to analyze images during upload and automatically generate descriptive alt text, titles, and tags.
-   **Generative Editing**: Advanced generative AI tools integrated into the media editor for seamless background removal, content-aware fills, and style adjustments.
-   **High-Volume Readiness**: Built for performance with asynchronous processing and robust error handling for large media libraries.
-   **Developer Friendly**: Fully extensible via hooks and filters, with a clean PSR-4 compliant architecture.

## Requirements

-   **WordPress**: 6.0 or higher
-   **PHP**: 8.2 or higher
-   **Node.js**: 18.x or higher (for development/building assets)
-   **Composer**: For dependency management

## Installation (Development)

1.  Clone the repository into your WordPress plugins directory:
    ```bash
    cd wp-content/plugins
    git clone https://github.com/your-username/bearded-media.git
    ```
2.  Install PHP dependencies:
    ```bash
    composer install
    ```
3.  Install JavaScript dependencies:
    ```bash
    npm install
    ```
4.  Activate the plugin through the WordPress admin dashboard.

## Development Workflow

### Build Commands
-   **`npm run start`**: Start the development server for real-time asset compilation and hot reloading.
-   **`npm run build`**: Compile and minify all frontend assets (JS/CSS) for production.
-   **`npm run lint:js`**: Lint JavaScript files using ESLint.

### Testing & Code Quality
-   **`composer analyze`**: Run PHPStan for static analysis at level 5.
-   **`composer format`**: Check and fix code style issues using PHP_CodeSniffer (WordPress standard).
-   **`composer test`**: Run the test suite (Pest/PHPUnit).
-   **`npm test`**: Runs both JS lints and PHP tests in a single command.
-   **`npm run prepare`**: Manually initialize Husky git hooks.

### Git Hooks (Husky)
This project uses **Husky**. The following checks run automatically on every `git commit`:
-   **PHP Checkstyle**: `composer format`
-   **Static Analysis**: `composer analyze`
-   **JavaScript Linting**: `npm run lint:js`

If any of these checks fail, the commit will be blocked until the issues are resolved.

## Deployment Instructions

To prepare the plugin for a production environment, follow these steps:

### 1. Build Frontend Assets
Ensure all React components and styles are compiled and minified:
```bash
npm run build
```

### 2. Prepare Production Dependencies
Remove development packages and optimize the Composer autoloader:
```bash
composer install --no-dev --optimize-autoloader
```

### 3. Package the Plugin
You can use the built-in script to generate a production-ready zip file:
```bash
npm run plugin-zip
```
This script automates the build process, respects `.distignore`, and generates `bearded-media.zip`.

### 4. Automated GitHub Releases
This project is configured with GitHub Actions to automate releases. When you are ready to publish:
1.  Push a new tag following the versioning format (e.g., `v2.0.1`):
    ```bash
    git tag v2.0.1
    git push origin v2.0.1
    ```
2.  The `release.yml` workflow will automatically:
    -   Run the full test suite.
    -   Build all frontend assets.
    -   Package the plugin into a zip file named `bearded-media-v2.0.1.zip`.
    -   Create a new GitHub Release with the zip asset attached.

### 5. Manual Upload
If not using GitHub releases, upload the resulting `bearded-media` folder or zip to your server's `wp-content/plugins/` directory.

---

## License
This project is licensed under the GPL-2.0-or-later License.
