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
When deploying, exclude files and directories that are not required for the production environment. 

**Recommended exclusions:**
-   `.git/`
-   `.husky/`
-   `node_modules/`
-   `src/` (Source files are compiled into `build/`)
-   `tests/`
-   `.eslintrc.js`
-   `babel.config.js`
-   `composer.json` & `composer.lock`
-   `package.json` & `package-lock.json`
-   `phpstan.neon.dist`
-   `phpunit.xml`
-   `webpack.config.js`

### 4. Upload to Server
Upload the resulting `bearded-media` folder to your server's `wp-content/plugins/` directory via SFTP or your preferred CI/CD pipeline.

---

## Directory Structure

```text
bearded-media/
├── build/             # Compiled production assets
├── includes/          # PHP core logic (Namespaced: BeardedMedia\)
│   ├── API/           # REST API Handlers
│   ├── Core/          # Plugin initialization and core hooks
│   └── Media/         # AI Processing and Vision logic
├── src/               # React and SCSS source files
├── tests/             # Pest and PHPUnit tests
├── bearded-media.php  # Main plugin entry point
└── vendor/            # Composer dependencies
```

## License
This project is licensed under the GPL-2.0-or-later License.
