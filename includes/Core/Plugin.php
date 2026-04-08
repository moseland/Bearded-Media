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
		define( 'BEARDED_MEDIA_PATH', plugin_dir_path( dirname( __DIR__ ) ) );
		define( 'BEARDED_MEDIA_URL', plugin_dir_url( dirname( __DIR__ ) ) );
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
		add_action( 'admin_menu', array( $this, 'register_menus' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'admin_init', array( $this, 'handle_welcome_redirect' ) );
	}

	/**
	 * Add the main plugin page
	 */
	public function register_menus(): void {
		add_menu_page(
			__( 'Bearded Media', 'bearded-media' ),
			__( 'Bearded Media', 'bearded-media' ),
			'manage_options',
			'bearded-media',
			array( $this, 'render_admin_page' ),
			'dashicons-camera-alt',
			60
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
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'       => 'object',
						'properties' => array(
							'resize_enabled' => array( 'type' => 'boolean' ),
							'max_width'      => array( 'type' => 'integer' ),
							'max_height'     => array( 'type' => 'integer' ),
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
			'resize_enabled' => (bool) ( $input['resize_enabled'] ?? true ),
			'max_width'      => absint( $input['max_width'] ?? 2500 ),
			'max_height'     => absint( $input['max_height'] ?? 2500 ),
		);
	}

	/**
	 * Render the React mount point
	 */
	public function render_admin_page(): void {
		printf( '<div id="bearded-media-settings"></div>' );
	}

	/**
	 * Enqueue admin scripts and styles.
	 *
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_assets( string $hook ): void {
		$allowed_hooks = array( 'upload.php', 'post.php', 'post-new.php', 'toplevel_page_bearded-media' );
		if ( ! in_array( $hook, $allowed_hooks, true ) ) {
			return;
		}

		$asset_file = BEARDED_MEDIA_PATH . 'build/index.asset.php';
		$assets     = file_exists( $asset_file ) ? require $asset_file : array(
			'dependencies' => array(),
			'version'      => BEARDED_MEDIA_VERSION,
		);

		wp_enqueue_script(
			'bearded-media-core',
			BEARDED_MEDIA_URL . 'build/index.js',
			$assets['dependencies'],
			$assets['version'],
			true
		);

		wp_localize_script(
			'bearded-media-core',
			'beardedMediaConfig',
			array(
				'restUrl'  => esc_url_raw( rest_url( 'bearded-media/v1' ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'settings' => get_option( 'bearded_media_settings', array() ),
				'apiKeys'  => $this->get_module( 'keys' )->get_public_status(),
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
	 * Handle post-activation redirect
	 */
	private function handle_welcome_redirect(): void {
		if ( get_transient( 'bearded_media_activated' ) ) {
			delete_transient( 'bearded_media_activated' );
			if ( ! is_network_admin() ) {
				wp_safe_redirect( admin_url( 'admin.php?page=bearded-media' ) );
				exit;
			}
		}
	}
}
