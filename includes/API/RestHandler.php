<?php
/**
 * REST Handler class file.
 *
 * @package BeardedMedia\API
 */

namespace BeardedMedia\API;

use BeardedMedia\Core\Plugin;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Class RestHandler
 *
 * Centralizes all REST API operations for the plugin.
 *
 * @package BeardedMedia\API
 */
class RestHandler {

	/**
	 * The REST namespace for this plugin.
	 *
	 * @var string
	 */
	private string $namespace = 'bearded-media/v1';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers all custom REST routes.
	 */
	public function register_routes(): void {
		// Image analysis and task submission.
		register_rest_route(
			$this->namespace,
			'/run-task',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_task_submission' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);

		// Polling for async AI tasks.
		register_rest_route(
			$this->namespace,
			'/check-task',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_task_check' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);

		// Stock photo retrieval.
		register_rest_route(
			$this->namespace,
			'/stock-search',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_stock_search' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);

		// Save/Overwrite image.
		register_rest_route(
			$this->namespace,
			'/save-image',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_save_image' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);
	}

	/**
	 * Validates that the current user has permission to manage media
	 *
	 * @return bool
	 */
	public function check_upload_permissions(): bool {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Stock photo search.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_stock_search( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$keys_module = Plugin::get_instance()->get_module( 'keys' );
		$key         = $keys_module ? $keys_module->get_key( 'pexels_key' ) : '';

		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'Pexels API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$query = sanitize_text_field( $request->get_param( 'query' ) );
		$page  = $request->get_param( 'page' );
		$page  = absint( $page ? $page : 1 );

		$url = add_query_arg(
			array(
				'per_page' => 15,
				'query'    => $query,
				'page'     => $page,
			),
			'https://api.pexels.com/v1/search'
		);

		$response = wp_remote_get(
			$url,
			array(
				'headers' => array( 'Authorization' => $key ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		return new WP_REST_Response( $data, 200 );
	}

	/**
	 * Placeholder for task submission logic.
	 *
	 * @param WP_REST_Request $request The request object.
	 */
	public function handle_task_submission( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		// Implementation for AI task routing.
		return new WP_REST_Response( array( 'status' => 'queued' ), 202 );
	}

	/**
	 * Placeholder for polling logic.
	 *
	 * @param WP_REST_Request $request The request object.
	 */
	public function handle_task_check( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return new WP_REST_Response( array( 'status' => 'processing' ), 200 );
	}

	/**
	 * Handles saving generated or edited images to the library.
	 *
	 * @param WP_REST_Request $request The request object.
	 */
	public function handle_save_image( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		// Implementation for handling image sideloading and attachment metadata.
		return new WP_REST_Response( array( 'success' => true ), 200 );
	}
}
