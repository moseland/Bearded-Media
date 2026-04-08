<?php
/**
 * Key Manager class file.
 *
 * @package BeardedMedia\Core
 */

namespace BeardedMedia\Core;

/**
 * Class KeyManager
 *
 * Manages external service API keys
 *
 * @package BeardedMedia\Core
 */
class KeyManager {

	/**
	 * The option name where keys are stored in the database
	 *
	 * @var string
	 */
	private string $option_name = 'bearded_media_api_keys';

	/**
	 * Internal registry of required keys
	 *
	 * @var array<string, array{label: string, used_by: string[]}>
	 */
	private array $registry = array();

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'register_default_keys' ) );
	}

	/**
	 * Defines the core keys needed for the plugin to function.
	 */
	public function register_default_keys(): void {
		$this->register_key( 'gemini_key', __( 'Google Gemini API Key', 'bearded-media' ), 'Core Vision' );
		$this->register_key( 'stability_key', __( 'Stability AI API Key', 'bearded-media' ), 'AI Editor' );
		$this->register_key( 'pexels_key', __( 'Pexels API Key', 'bearded-media' ), 'Stock Search' );
		$this->register_key( 'bfl_key', __( 'Black Forest Labs Key', 'bearded-media' ), 'Flux Generation' );
	}

	/**
	 * Adds a key to the registry
	 *
	 * @param string $slug    Unique identifier for the key.
	 * @param string $label   Human-readable label for the UI.
	 * @param string $used_by Description of which module uses this key.
	 */
	public function register_key( string $slug, string $label, string $used_by ): void {
		if ( ! isset( $this->registry[ $slug ] ) ) {
			$this->registry[ $slug ] = array(
				'label'   => $label,
				'used_by' => array(),
			);
		}

		if ( ! in_array( $used_by, $this->registry[ $slug ]['used_by'], true ) ) {
			$this->registry[ $slug ]['used_by'][] = $used_by;
		}
	}

	/**
	 * Retrieves a key value from the database
	 *
	 * @param string $slug The key identifier.
	 * @return string The raw API key or an empty string.
	 */
	public function get_key( string $slug ): string {
		$keys = get_option( $this->option_name, array() );
		return (string) ( $keys[ $slug ] ?? '' );
	}

	/**
	 * Checks which keys are configured without exposing the actual values
	 *
	 * @return array<string, bool>
	 */
	public function get_public_status(): array {
		$keys   = get_option( $this->option_name, array() );
		$status = array();

		foreach ( array_keys( $this->registry ) as $slug ) {
			$status[ $slug ] = ! empty( $keys[ $slug ] );
		}

		return $status;
	}

	/**
	 * Persists updated keys to the database
	 *
	 * @param array<string, string> $new_keys Key-value pairs from a settings save.
	 */
	public function update_keys( array $new_keys ): void {
		$keys = get_option( $this->option_name, array() );

		foreach ( $new_keys as $slug => $value ) {
			if ( isset( $this->registry[ $slug ] ) ) {
				$keys[ $slug ] = sanitize_text_field( $value );
			}
		}

		update_option( $this->option_name, $keys );
	}
}
