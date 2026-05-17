# Bearded Media

[![WordPress Version](https://img.shields.io/badge/WordPress-6.0%2B-blue.svg?style=flat-square)](https://wordpress.org/)
[![PHP Version](https://img.shields.io/badge/PHP-8.2%2B-purple.svg?style=flat-square)](https://www.php.net/)
[![Node Version](https://img.shields.io/badge/Node.js-18.x%2B-green.svg?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-GPL--2.0--or--later-orange.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-2.0.html)

**Bearded Media** is a modern WordPress plugin designed to seamlessly bring state-of-the-art Generative AI capabilities, including Image, Video and Text generation, to your media library and block editor workspace. It includes advanced AI image editing, auto-tagging, optimization, and stock asset discovery tools.

---

## Key Features

### AI Video Generation (New!)
Generate cinematic and high-quality AI video clips directly within your editor.
- **Multi-Provider Support**: Create clips using **OpenRouter**, **OpenAI**, or **Google Gemini**.
- **Interactive Preview Workspace**: A responsive preview interface with full HTML5 video playback and status polling before importing.
- **Reference Seed Frames**: Upload a local reference image or select any asset from the WordPress Media Library to act as the initial seed/reference frame for image-to-video pipelines.
- **Configurable Settings**: Custom controls for frame rate (24 FPS Cinematic / 30 FPS Standard), aspect ratio (16:9, 9:16, 1:1), motion scale, and speed parameters.
- **Block Integration**: Generate and insert video assets directly into supported core blocks (Video, Cover, Media & Text, File).

### Inline AI Text Generation (New!)
Speed up content creation with rich, on-demand text generation inside the Gutenberg Block Editor.
- **Formatting Toolbar Integration**: Registers a rich text formatting extension (`bearded-media/text-generator`) represented by a custom **Bearded AI Text** icon in the editor toolbar.
- **Flexible Model Selection**: Instantly prompt and generate content using configured LLMs (e.g. Gemini, OpenRouter-hosted models).
- **In-Place Insertion**: Review the generated content inside a dedicated overlay and insert it directly into the block editor at your current cursor position with a single click.

### Generative Image Editing & SAM Segmentation
Enhance and modify existing imagery in-place without external design tools.
- **Generative Fills & Styles**: Inpaint, outpaint, remove backgrounds, or alter styles using advanced generative models (Stability AI, Flux/Black Forest Labs, Gemini).
- **Segment Anything Model (SAM)**: Uses Meta's SAM VPS pipeline to calculate precise, click-to-select mask boundaries dynamically on a visual canvas.
- **AI Upscaling**: Automatically or manually upscale low-resolution image files to high-fidelity versions.

### Vision-Based Auto-Tagging & Accessibility
Generate accessibility descriptions and search parameters automatically.
- **Gemini Vision Pipeline**: Analyzes physical images on upload to write descriptive titles, tags, and SEO-friendly `alt` attributes.
- **Bulk Operations**: An interactive bulk-processing tool inside the media list dashboard to batch-generate accessibility text or physical file renames for dozens of selected items at once.

### Client-Side Bandwidth Optimization
Save server resources and improve loading speeds by optimizing images *before* they travel over the wire.
- **In-Browser Compression**: Automatically convert high-resolution files to highly compressed WebP format on the client side.
- **Client-Side Resizing**: Resize giant raw uploads to configurable maximum width and height bounds in the browser.
- **Metadata Stripping**: Automatically strip sensitive EXIF metadata (GPS locations, camera specs) for privacy and optimization.

---

## Settings Dashboard

Configure Bearded Media under the custom settings dashboard inside the WordPress Admin Panel, split logically across four powerful tabs:

1. **Pipelines**: Toggle automatic upload hooks such as Gemini Vision Alt-Text, physical SEO file renaming, client-side WebP compression, EXIF metadata stripping, and background AI Upscaling.
2. **Constraints**: Define client-side maximum width and height limits, along with upscaling restrictions (minimum triggers, and crop modes like *Contain*, *Cover*, and *Generative Fill*).
3. **Models**: A manual model registration interface that allows admins to register, catalog, and remove provider-agnostic models. Easily associate a custom display label and API slug with a specific capability (Text, Image, Video) across various engines.
4. **Credentials**: Securely persist keys and API endpoints for:
   - **Google Gemini** (Vision, text generation, and alt-tagging)
   - **Stability AI** (Generative editing, upscaling, and video)
   - **Pexels API** (Direct inline search for stock photos/videos)
   - **Black Forest Labs (BFL)** (Flux image generation)
   - **OpenRouter** (Unified LLM and async video generation access)

---

## Requirements

- **WordPress**: 6.0 or higher (Optimized for modern block APIs)
- **PHP**: 8.2 or higher
- **Node.js**: 18.x or higher (For compiling JavaScript/SCSS assets)
- **Composer**: For managing backend dependency autoloading

---

## Installation (Development)

1. **Clone the repository** into your WordPress plugins directory:
   ```bash
   cd wp-content/plugins
   git clone https://github.com/moseland/Bearded-Media.git bearded-media
   ```

2. **Install PHP dependencies**:
   ```bash
   composer install
   ```

3. **Install JavaScript packages**:
   ```bash
   npm install
   ```

4. **Activate the plugin** through the WordPress Admin Plugins dashboard.

---

## Development Workflow

### Build Commands
- **`npm run start`**: Start the development server for real-time asset compiling and hot-reloading.
- **`npm run build`**: Compile and minify frontend assets (`/build/index.js`, `/build/index.css`) for production deployment.
- **`npm run lint:js`**: Run ESLint checks against JavaScript and JSX components.

### Testing & Code Quality
- **`composer format`**: Check and automatically fix code style issues to comply with WordPress PHP Coding Standards (`wp-scripts format` style rules).
- **`composer analyze`**: Run PHPStan static analysis rules to guarantee type-safety and eliminate logic errors.
- **`composer test`**: Execute the server-side test suite using Pest/PHPUnit.
- **`npm test`**: Runs the entire JS linting suite and PHP validation tests under a single command.
- **`npm run prepare`**: Manually initialize Husky Git Hooks for pre-commit verification.

### Git Hooks (Husky)
The repository is secured with automatic **Husky** hooks. Every `git commit` runs the following safety checks:
1. **PHP Checkstyle**: `composer format`
2. **Static Analysis**: `composer analyze`
3. **JavaScript Linting**: `npm run lint:js`

Commits will be automatically blocked if any syntax or analysis checks fail.

---

## Deployment Instructions

To compile, build, and package Bearded Media for production:

### 1. Build Production Frontend Assets
Compile optimized CSS stylesheet rules and minified React bundles:
```bash
npm run build
```

### 2. Remove Development Packages
Strip local tools, testing suites, and optimize the autoload map:
```bash
composer install --no-dev --optimize-autoloader
```

### 3. Generate Package Zip File
Generate a production-ready, lightweight distribution zip respecting the `.distignore` configuration rules:
```bash
npm run plugin-zip
```
This generates `bearded-media.zip` in the root directory, perfect for direct upload or plugin distribution.

### 4. Automated CI/CD Releases
A GitHub Action workflow (`release.yml`) handles the build process automatically. Simply push a semver tag:
```bash
git tag v1.0.4
git push origin v1.0.4
```
The workflow will run verification tests, build static assets, package them, and publish a new GitHub Release with the bundled plugin zip attached.

---

## License

This project is licensed under the MIT License. See the [LICENSE.txt](LICENSE.txt) file for the full copyright and permission notices.

### Summary of Terms:
* **Attribution:** The original copyright notice and this permission notice must be included in all copies or substantial portions of the software.
* **No Claim to Ownership:** You are free to use, modify, and distribute the code as you wish, but you cannot strip the author's name or claim sole authorship.
