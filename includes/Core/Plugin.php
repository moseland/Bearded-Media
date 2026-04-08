<?php
/**
 * Main Plugin class file.
 *
 * @package BeardedMedia\Core
 */

namespace BeardedMedia\Core;

use BeardedMedia\Media\VisionProcessor;
use BeardedMedia\API\RestHandler;

/**
 * The Main Plugin Controller.
 *
 * @final
 */
final class Plugin {

	/**
	 * The singleton instance of the plugin.
	 *
	 * @var Plugin|null
	 */
	private static ?Plugin $instance = null;

	/**
	 * Internal module registry
	 *
	 * @var array<string, object>
	 */
	private array $modules = array();

	/**
	 * The settings page hook suffix
	 *
	 * @var string
	 */
	private string $settings_hook = '';

	/**
	 * Get the singleton instance
	 */
	public static function get_instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Plugin constructor
	 */
	private function __construct() {
		$this->define_constants();
		$this->init_modules();
		$this->init_hooks();
	}

	/**
	 * Define plugin-wide constants
	 */
	private function define_constants(): void {
		define( 'BEARDED_MEDIA_VERSION', '2.0.0' );
		$plugin_dir = dirname( __DIR__, 2 );
		define( 'BEARDED_MEDIA_PATH', plugin_dir_path( $plugin_dir . '/bearded-media.php' ) );
		define( 'BEARDED_MEDIA_URL', plugin_dir_url( $plugin_dir . '/bearded-media.php' ) );
	}

	/**
	 * Initialize sub-modules
	 */
	private function init_modules(): void {
		// API Key management (Refactored from Bearded Tools).
		$this->modules['keys'] = new KeyManager();

		// REST API Task Handling.
		$this->modules['api'] = new RestHandler();

		// Background Media Processing.
		$this->modules['vision'] = new VisionProcessor();
	}

	/**
	 * Register core WordPress hooks
	 */
	private function init_hooks(): void {
		add_action( 'init', array( $this, 'load_textdomain' ) );
		add_action( 'init', array( $this, 'register_settings' ) );
		add_action( 'admin_menu', array( $this, 'register_menus' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'admin_init', array( $this, 'handle_welcome_redirect' ) );
	}

	/**
	 * Load the plugin text domain for translations.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( 'bearded-media', false, basename( BEARDED_MEDIA_PATH ) . '/languages' );
	}

	/**
	 * Add the main plugin page
	 */
	public function register_menus(): void {
		$this->settings_hook = add_options_page(
			__( 'Bearded Media', 'bearded-media' ),
			__( 'Bearded Media', 'bearded-media' ),
			'manage_options',
			'bearded-media',
			array( $this, 'render_admin_page' )
		);
	}

	/**
	 * Register the central settings group
	 */
	public function register_settings(): void {
		register_setting(
			'bearded_media_options',
			'bearded_media_settings',
			array(
				'type'              => 'object',
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'       => 'object',
						'properties' => array(
							'auto_alt'           => array( 'type' => 'boolean' ),
							'seo_rename'         => array( 'type' => 'boolean' ),
							'auto_webp'          => array( 'type' => 'boolean' ),
							'resize_enabled'     => array( 'type' => 'boolean' ),
							'strip_metadata'     => array( 'type' => 'boolean' ),
							'auto_upscale'       => array( 'type' => 'boolean' ),
							'max_width'          => array( 'type' => 'integer' ),
							'max_height'         => array( 'type' => 'integer' ),
							'upscale_min_width'  => array( 'type' => 'integer' ),
							'upscale_min_height' => array( 'type' => 'integer' ),
							'upscale_mode'       => array( 'type' => 'string' ),
						),
					),
				),
			)
		);

		register_setting(
			'bearded_media_options',
			'bearded_media_api_keys',
			array(
				'type'              => 'object',
				'sanitize_callback' => array( $this, 'sanitize_keys' ),
				'default'           => array(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'       => 'object',
						'properties' => array(
							'gemini_key'    => array( 'type' => 'string' ),
							'stability_key' => array( 'type' => 'string' ),
							'pexels_key'    => array( 'type' => 'string' ),
							'bfl_key'       => array( 'type' => 'string' ),
						),
					),
				),
			)
		);
	}

	/**
	 * Sanitize plugin settings.
	 *
	 * @param array<string, mixed> $input The raw settings input.
	 * @return array<string, mixed>
	 */
	public function sanitize_settings( array $input ): array {
		return array(
			'auto_alt'           => (bool) ( $input['auto_alt'] ?? false ),
			'seo_rename'         => (bool) ( $input['seo_rename'] ?? false ),
			'auto_webp'          => (bool) ( $input['auto_webp'] ?? false ),
			'resize_enabled'     => (bool) ( $input['resize_enabled'] ?? true ),
			'strip_metadata'     => (bool) ( $input['strip_metadata'] ?? false ),
			'auto_upscale'       => (bool) ( $input['auto_upscale'] ?? false ),
			'max_width'          => absint( $input['max_width'] ?? 2500 ),
			'max_height'         => absint( $input['max_height'] ?? 2500 ),
			'upscale_min_width'  => absint( $input['upscale_min_width'] ?? 1000 ),
			'upscale_min_height' => absint( $input['upscale_min_height'] ?? 1000 ),
			'upscale_mode'       => sanitize_text_field( $input['upscale_mode'] ?? 'contain' ),
		);
	}

	/**
	 * Sanitize plugin API keys.
	 *
	 * @param array<string, mixed> $input The raw API keys input.
	 * @return array<string, mixed>
	 */
	public function sanitize_keys( array $input ): array {
		return array(
			'gemini_key'    => sanitize_text_field( (string) ( $input['gemini_key'] ?? '' ) ),
			'stability_key' => sanitize_text_field( (string) ( $input['stability_key'] ?? '' ) ),
			'pexels_key'    => sanitize_text_field( (string) ( $input['pexels_key'] ?? '' ) ),
			'bfl_key'       => sanitize_text_field( (string) ( $input['bfl_key'] ?? '' ) ),
		);
	}

	/**
	 * Render the React mount point
	 */
	public function render_admin_page(): void {
		printf( '<div id="bearded-media-settings"></div>' );
	}

	/**
	 * Prepare WebP support status for the frontend.
	 *
	 * @return array<string, mixed>
	 */
	private function get_webp_status(): array {
		$supported = false;
		$error     = '';

		$mimes = get_allowed_mime_types();
		if ( ! in_array( 'image/webp', $mimes, true ) ) {
			$error = __( 'WebP MIME type is not allowed on this site. Please check your functions.php or a mime-type plugin.', 'bearded-media' );
		} elseif ( ! wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) {
			$error = __( 'Your server image library (GD or ImageMagick) does not support WebP.', 'bearded-media' );
		} else {
			$supported = true;
		}

		return array(
			'supported' => $supported,
			'error'     => $error,
		);
	}

	/**
	 * Enqueue admin scripts and styles.
	 *
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_assets( string $hook ): void {
		$allowed_hooks = array( 'upload.php', 'post.php', 'post-new.php', $this->settings_hook );
		if ( ! in_array( $hook, $allowed_hooks, true ) ) {
			return;
		}

		$asset_file = BEARDED_MEDIA_PATH . 'build/index.asset.php';
		$assets     = file_exists( $asset_file ) ? require $asset_file : array(
			'dependencies' => array(),
			'version'      => BEARDED_MEDIA_VERSION,
		);

		$deps = $assets['dependencies'];
		if ( ! in_array( 'wp-plupload', $deps, true ) ) {
			$deps[] = 'wp-plupload';
		}

		wp_enqueue_script(
			'bearded-media-core',
			BEARDED_MEDIA_URL . 'build/index.js',
			$deps,
			$assets['version'],
			true
		);

		wp_enqueue_style(
			'bearded-media-core',
			BEARDED_MEDIA_URL . 'build/index.css',
			array(),
			$assets['version']
		);

		wp_localize_script(
			'bearded-media-core',
			'beardedMediaSettings',
			array(
				'rest_url'      => esc_url_raw( rest_url() ),
				'restUrl'       => esc_url_raw( rest_url( 'bearded-media/v1' ) ),
				'nonce'         => wp_create_nonce( 'wp_rest' ),
				'settings'      => get_option( 'bearded_media_settings', array() ),
				'capabilities'  => $this->get_module( 'keys' )->get_public_status(),
				'webp_status'   => $this->get_webp_status(),
				'is_media_page' => ( 'upload.php' === $hook ),
			)
		);
	}

	/**
	 * Access a registered module.
	 *
	 * @param string $key The module key.
	 */
	public function get_module( string $key ): ?object {
		return $this->modules[ $key ] ?? null;
	}

	/**
	 * Handle post-activation redirect.
	 *
	 * @internal This method is used as a callback and should not be called directly.
	 */
	public function handle_welcome_redirect(): void {
		if ( get_transient( 'bearded_media_activated' ) ) {
			delete_transient( 'bearded_media_activated' );
			if ( ! is_network_admin() ) {
				wp_safe_redirect( admin_url( 'options-general.php?page=bearded-media' ) );
				exit;
			}
		}
	}
}
