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
 * Centralizes all REST API and Core Abilities operations for the plugin.
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
		// Register core AI abilities on the correct hook as required by WordPress 6.9+.
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Registers Core WordPress Abilities.
	 */
	public function register_abilities(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		// 1. Register Image Generation Ability
		wp_register_ability(
			'bearded-media/generate-image',
			array(
				'label'               => __( 'Generate AI Image', 'bearded-media' ),
				'description'         => __( 'Generates an image from a text prompt using selected text-to-image models.', 'bearded-media' ),
				'category'            => 'media',
				'execute_callback'    => array( $this, 'ability_execute_generate_image' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'prompt'        => array( 'type' => 'string' ),
						'model'         => array( 'type' => 'string' ),
						'task'          => array( 'type' => 'string' ),
						'image_data'    => array( 'type' => 'string' ),
						'mask_data'     => array( 'type' => 'string' ),
						'select_prompt' => array( 'type' => 'string' ),
						'left'          => array( 'type' => 'integer' ),
						'right'         => array( 'type' => 'integer' ),
						'up'            => array( 'type' => 'integer' ),
						'down'          => array( 'type' => 'integer' ),
						'style_image'   => array( 'type' => 'string' ),
					),
					'required'   => array( 'prompt' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'status'   => array( 'type' => 'string' ),
						'task_id'  => array( 'type' => 'string' ),
						'b64_json' => array( 'type' => 'string' ),
						'provider' => array( 'type' => 'string' ),
					),
				),
			)
		);

		// 2. Register Video Generation Ability
		wp_register_ability(
			'bearded-media/generate-video',
			array(
				'label'               => __( 'Generate AI Video', 'bearded-media' ),
				'description'         => __( 'Generates an AI video clip from text or a seed frame image using multiple AI providers.', 'bearded-media' ),
				'category'            => 'media',
				'execute_callback'    => array( $this, 'ability_execute_generate_video' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'provider'         => array( 'type' => 'string' ),
						'model'            => array( 'type' => 'string' ),
						'prompt'           => array( 'type' => 'string' ),
						'image_data'       => array( 'type' => 'string' ),
						'motion_bucket_id' => array( 'type' => 'integer' ),
						'fps'              => array( 'type' => 'integer' ),
						'aspect_ratio'     => array( 'type' => 'string' ),
					),
					'required'   => array( 'provider', 'model' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'status'   => array( 'type' => 'string' ),
						'task_id'  => array( 'type' => 'string' ),
						'url'      => array( 'type' => 'string' ),
						'b64_json' => array( 'type' => 'string' ),
						'provider' => array( 'type' => 'string' ),
					),
				),
			)
		);

		// 3. Register Segment Anything (SAM) Mask Segmentation Ability
		wp_register_ability(
			'bearded-media/segment-image',
			array(
				'label'               => __( 'AI Segment Image', 'bearded-media' ),
				'description'         => __( 'Utilizes Meta\'s Segment Anything Model (SAM) to calculate mask boundaries dynamically.', 'bearded-media' ),
				'category'            => 'media',
				'execute_callback'    => array( $this, 'ability_execute_segmentation' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'task'        => array( 'type' => 'string' ),
						'original_id' => array( 'type' => 'integer' ),
						'clicks'      => array( 'type' => 'array' ),
					),
					'required'   => array( 'task', 'original_id' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'status'   => array( 'type' => 'string' ),
						'mask_b64' => array( 'type' => 'string' ),
					),
				),
			)
		);

		// 4. Register Text Generation Ability
		wp_register_ability(
			'bearded-media/generate-text',
			array(
				'label'               => __( 'Generate AI Text', 'bearded-media' ),
				'description'         => __( 'Generates text from a prompt using selected LLMs.', 'bearded-media' ),
				'category'            => 'text',
				'execute_callback'    => array( $this, 'ability_execute_generate_text' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'prompt'             => array( 'type' => 'string' ),
						'model'              => array( 'type' => 'string' ),
						'provider'           => array( 'type' => 'string' ),
						'system_instruction' => array( 'type' => 'string' ),
						'temperature'        => array( 'type' => 'number' ),
					),
					'required'   => array( 'prompt', 'model' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'status' => array( 'type' => 'string' ),
						'text'   => array( 'type' => 'string' ),
					),
				),
			)
		);
	}

	/**
	 * Registers all custom REST routes.
	 */
	public function register_routes(): void {
		// Image analysis, video generation, and task submission.
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

		// Stock photo/video retrieval.
		register_rest_route(
			$this->namespace,
			'/stock-search',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_stock_search' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);

		// Save/Overwrite media.
		register_rest_route(
			$this->namespace,
			'/save-image',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_save_media' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);

		// Model Discovery and Caching.
		register_rest_route(
			$this->namespace,
			'/available-models',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_available_models' ),
				'permission_callback' => array( $this, 'check_upload_permissions' ),
			)
		);
	}

	/**
	 * Retrieve available AI models dynamically based on configured keys.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response
	 */
	public function get_available_models( WP_REST_Request $request ): WP_REST_Response {
		$settings = get_option( 'bearded_media_settings', array() );
		$models   = $settings['manual_models'] ?? array();
		return new WP_REST_Response( $models, 200 );
	}

	/**
	 * Validates that the current user has permission to manage media.
	 *
	 * @return bool
	 */
	public function check_upload_permissions(): bool {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Retrieve keys dynamically from settings manager.
	 *
	 * @param string $slug Slug to retrieve.
	 * @return string Key value.
	 */
	private function get_my_key( $slug ) {
		$keys_module = Plugin::get_instance()->get_module( 'keys' );
		return $keys_module ? $keys_module->get_key( $slug ) : '';
	}

	/**
	 * Unified Stock photo/video search supporting Pexels configurations.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_stock_search( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$key = $this->get_my_key( 'pexels_key' );

		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'Pexels API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$query      = sanitize_text_field( $request->get_param( 'query' ) );
		$page       = $request->get_param( 'page' );
		$page       = absint( $page ? $page : 1 );
		$param_type = $request->get_param( 'type' );
		$media_type = sanitize_text_field( $param_type ? $param_type : 'photo' );

		if ( 'video' === $media_type ) {
			$url = 'https://api.pexels.com/videos/search';
		} else {
			$url = 'https://api.pexels.com/v1/search';
		}

		$url = add_query_arg(
			array(
				'per_page' => 15,
				'query'    => $query,
				'page'     => $page,
			),
			$url
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
	 * Execute Image Generation (Decoupled Core Logic).
	 *
	 * @param array<string, mixed> $args Plain array of arguments.
	 * @return WP_REST_Response|WP_Error
	 */
	public function ability_execute_generate_image( array $args ): WP_REST_Response|WP_Error {
		wp_raise_memory_limit( 'bearded-media' );

		$task          = $args['task'] ?? '';
		$image_data    = $args['image_data'] ?? '';
		$mask_data     = $args['mask_data'] ?? '';
		$prompt        = $args['prompt'] ?? '';
		$select_prompt = $args['select_prompt'] ?? '';
		$model         = $args['model'] ?? '';

		$extra_params = array(
			'left'        => $args['left'] ?? null,
			'right'       => $args['right'] ?? null,
			'up'          => $args['up'] ?? null,
			'down'        => $args['down'] ?? null,
			'style_image' => $args['style_image'] ?? null,
		);

		// --- 1. Explicit Gemini Tasks ---
		if ( 'gemini-nano-banana' === $task ) {
			$gemini_key = $this->get_my_key( 'gemini_key' );
			if ( empty( $gemini_key ) ) {
				return new WP_Error( 'missing_key', 'Gemini Key Missing', array( 'status' => 500 ) );
			}
			return $this->submit_gemini_request( 'gemini-2.5-flash-image', $gemini_key, $prompt, $image_data );
		}
		if ( 'gemini-nano-banana-pro' === $task ) {
			$gemini_key = $this->get_my_key( 'gemini_key' );
			if ( empty( $gemini_key ) ) {
				return new WP_Error( 'missing_key', 'Gemini Key Missing', array( 'status' => 500 ) );
			}
			return $this->submit_gemini_request( 'gemini-3-pro-image-preview', $gemini_key, $prompt, $image_data );
		}

		// --- 2. Stability AI Specific Tasks ---
		if ( strpos( $task, 'stability-' ) === 0 ) {
			$stability_key = $this->get_my_key( 'stability_key' );
			if ( empty( $stability_key ) ) {
				return new WP_Error( 'missing_key', 'Stability AI API Key is missing.', array( 'status' => 500 ) );
			}
			return $this->handle_stability_task( $task, $stability_key, $image_data, $mask_data, $prompt, $select_prompt, '', $extra_params );
		}

		// --- 3. Model-Based Routing (Generative) ---
		if ( strpos( $model, 'gemini' ) !== false ) {
			$gemini_key = $this->get_my_key( 'gemini_key' );
			if ( empty( $gemini_key ) ) {
				return new WP_Error( 'missing_key', 'Gemini Key Missing', array( 'status' => 500 ) );
			}
			return $this->submit_gemini_request( $model, $gemini_key, $prompt, $image_data );
		}

		if ( strpos( $model, 'stability-' ) === 0 ) {
			$stability_key = $this->get_my_key( 'stability_key' );
			if ( empty( $stability_key ) ) {
				return new WP_Error( 'missing_key', 'Stability Key Missing', array( 'status' => 500 ) );
			}
			return $this->handle_stability_task( $task, $stability_key, $image_data, $mask_data, $prompt, $select_prompt, $model );
		}

		// --- 4. Fallback: Black Forest Labs (Flux) ---
		$bfl_key = $this->get_my_key( 'bfl_key' );
		if ( empty( $bfl_key ) ) {
			return new WP_Error( 'missing_key', 'BFL API Key is missing (Fallthrough).', array( 'status' => 500 ) );
		}

		if ( 'img2img' === $task ) {
			$endpoint = ( 'flux-dev' === $model ) ? 'flux-dev' : 'flux-pro-1.1';
			$url      = 'https://api.bfl.ml/v1/' . $endpoint;

			$body = array(
				'prompt'            => $prompt,
				'width'             => 1024,
				'height'            => 1024,
				'prompt_upsampling' => false,
				'safety_tolerance'  => 2,
				'output_format'     => 'jpeg',
			);
			if ( ! empty( $image_data ) ) {
				$body['image'] = $image_data;
			}
			return $this->submit_bfl_request( $url, $bfl_key, $body );
		}

		if ( 'generate' === $task ) {
			$endpoint = ( 'flux-dev' === $model ) ? 'flux-dev' : 'flux-pro-1.1';
			$url      = 'https://api.bfl.ml/v1/' . $endpoint;
			$body     = array(
				'prompt'           => $prompt,
				'width'            => 1024,
				'height'           => 768,
				'output_format'    => 'jpeg',
				'safety_tolerance' => 2,
			);
			return $this->submit_bfl_request( $url, $bfl_key, $body );
		}

		return new WP_Error( 'invalid_task', 'Unknown task or provider.', array( 'status' => 400 ) );
	}

	/**
	 * Execute Video Generation (Decoupled Core Logic).
	 *
	 * @param array<string, mixed> $args Plain array of arguments.
	 * @return WP_REST_Response|WP_Error
	 */
	public function ability_execute_generate_video( array $args ): WP_REST_Response|WP_Error {
		wp_raise_memory_limit( 'bearded-media' );

		$provider = $args['provider'] ?? '';
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( 'BeardedMedia Video Gen [START] - Provider: ' . $provider );

		$max_retries = 5;
		$retry_delay = 1;

		$response = null;

		for ( $attempt = 1; $attempt <= $max_retries; $attempt++ ) {
			if ( 'stability' === $provider ) {
				$response = $this->submit_stability_video_request( $args );
			} elseif ( 'openrouter' === $provider ) {
				$response = $this->submit_openrouter_video_request( $args );
			} elseif ( 'openai' === $provider ) {
				$response = $this->submit_openai_video_request( $args );
			} elseif ( 'gemini' === $provider ) {
				$response = $this->submit_gemini_video_request( $args );
			} else {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				error_log( 'BeardedMedia Video Gen [ERROR] - Unsupported provider: ' . $provider );
				return new WP_Error( 'invalid_provider', __( 'Unsupported video generation provider.', 'bearded-media' ), array( 'status' => 400 ) );
			}

			if ( ! is_wp_error( $response ) ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				error_log( 'BeardedMedia Video Gen [SUCCESS] - Attempt: ' . $attempt );
				return $response;
			}

			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( 'BeardedMedia Video Gen [ATTEMPT FAILED] - Attempt: ' . $attempt . ' Error: ' . $response->get_error_message() );

			if ( $attempt < $max_retries ) {
				sleep( $retry_delay );
				$retry_delay *= 2; // Exponential backoff retries.
			}
		}

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( 'BeardedMedia Video Gen [FATAL] - Max retries reached. Final error: ' . $response->get_error_message() );
		return $response;
	}

	/**
	 * Execute Segmentation using Meta's SAM VPS (Decoupled Core Logic).
	 *
	 * @param array<string, mixed> $args Plain array of arguments.
	 * @return WP_REST_Response|WP_Error
	 */
	public function ability_execute_segmentation( array $args ): WP_REST_Response|WP_Error {
		wp_raise_memory_limit( 'bearded-media' );

		$task        = $args['task'] ?? '';
		$original_id = $args['original_id'] ?? 0;
		$clicks      = $args['clicks'] ?? array();

		// Fetch the configured VPS endpoint for Segment Anything calculations.
		$vps_url = $this->get_my_key( 'sam_vps_url' );
		if ( empty( $vps_url ) ) {
			return new WP_Error( 'missing_sam_vps_url', __( 'SAM VPS endpoint config is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$file_path = get_attached_file( $original_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new WP_Error( 'missing_file', __( 'Original target image file not found on disk.', 'bearded-media' ), array( 'status' => 404 ) );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$image_bin = file_get_contents( $file_path );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$image_b64 = base64_encode( $image_bin );

		if ( 'sam-embed' === $task ) {
			$endpoint = '/embed';
			$body     = array(
				'image_id'   => $original_id,
				'image_data' => $image_b64,
			);
		} elseif ( 'sam-predict' === $task ) {
			$endpoint = '/predict';
			$body     = array(
				'image_id' => $original_id,
				'clicks'   => $clicks,
			);
		} else {
			return new WP_Error( 'invalid_sam_task', __( 'Invalid segmentation task configuration.', 'bearded-media' ), array( 'status' => 400 ) );
		}

		$response = wp_remote_post(
			trailingslashit( $vps_url ) . ltrim( $endpoint, '/' ),
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
				'timeout' => 45,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code ) {
			$msg = $data['error']['message'] ?? __( 'Unknown Segment Anything VPS inference error.', 'bearded-media' );
			return new WP_Error( 'vps_error', $msg, array( 'status' => $code ) );
		}

		return new WP_REST_Response(
			array(
				'status'   => 'completed',
				'mask_b64' => $data['mask_b64'] ?? '',
			),
			200
		);
	}

	/**
	 * Execute Text Generation (Decoupled Core Logic).
	 *
	 * @param array<string, mixed> $args Plain array of arguments.
	 * @return WP_REST_Response|WP_Error
	 */
	public function ability_execute_generate_text( array $args ): WP_REST_Response|WP_Error {
		wp_raise_memory_limit( 'bearded-media' );

		$prompt             = $args['prompt'] ?? '';
		$model              = $args['model'] ?? '';
		$provider           = $args['provider'] ?? '';
		$system_instruction = $args['system_instruction'] ?? '';
		$temperature        = isset( $args['temperature'] ) ? (float) $args['temperature'] : null;

		if ( empty( $prompt ) || empty( $model ) ) {
			return new WP_Error( 'missing_params', 'Prompt and model are required.', array( 'status' => 400 ) );
		}

		// Smart provider resolution to eliminate routing collisions on OpenRouter-hosted Gemini models.
		if ( 'gemini' === $provider || ( empty( $provider ) && strpos( strtolower( $model ), 'gemini' ) !== false && strpos( $model, '/' ) === false ) ) {
			$key = $this->get_my_key( 'gemini_key' );
			if ( empty( $key ) ) {
				return new WP_Error( 'missing_key', 'Gemini Key Missing', array( 'status' => 500 ) );
			}

			$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode( $model ) . ':generateContent?key=' . $key;

			$body = array(
				'contents' => array(
					array(
						'parts' => array(
							array( 'text' => $prompt ),
						),
					),
				),
			);

			if ( ! empty( $system_instruction ) ) {
				$body['systemInstruction'] = array(
					'parts' => array(
						array( 'text' => $system_instruction ),
					),
				);
			}

			if ( null !== $temperature ) {
				$body['generationConfig'] = array(
					'temperature' => $temperature,
				);
			}

			$response = wp_remote_post(
				$url,
				array(
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode( $body ),
					'timeout' => 60,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code = wp_remote_retrieve_response_code( $response );
			$data = json_decode( wp_remote_retrieve_body( $response ), true );

			if ( 200 !== $code ) {
				$msg = $data['error']['message'] ?? 'Unknown Gemini text generation error.';
				return new WP_Error( 'gemini_error', $msg, array( 'status' => $code ) );
			}

			$text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

			return new WP_REST_Response(
				array(
					'status' => 'completed',
					'text'   => $text,
				),
				200
			);
		}

		// OpenRouter Models.
		$or_key = $this->get_my_key( 'openrouter_key' );
		if ( empty( $or_key ) ) {
			return new WP_Error( 'missing_key', 'OpenRouter Key Missing', array( 'status' => 500 ) );
		}

		$url      = 'https://openrouter.ai/api/v1/chat/completions';
		$messages = array();

		if ( ! empty( $system_instruction ) ) {
			$messages[] = array(
				'role'    => 'system',
				'content' => $system_instruction,
			);
		}

		$messages[] = array(
			'role'    => 'user',
			'content' => $prompt,
		);

		$body = array(
			'model'    => $model,
			'messages' => $messages,
		);

		if ( null !== $temperature ) {
			$body['temperature'] = $temperature;
		}

		$max_retries = 3;
		$retry_delay = 1;
		$response    = null;
		$code        = null;
		$data        = null;

		for ( $i = 0; $i <= $max_retries; $i++ ) {
			$response = wp_remote_post(
				$url,
				array(
					'headers' => array(
						'Authorization' => 'Bearer ' . $or_key,
						'Content-Type'  => 'application/json',
						'HTTP-Referer'  => home_url(),
						'X-Title'       => get_bloginfo( 'name' ),
					),
					'body'    => wp_json_encode( $body ),
					'timeout' => 60,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code = wp_remote_retrieve_response_code( $response );
			$data = json_decode( wp_remote_retrieve_body( $response ), true );

			if ( 429 === $code && $i < $max_retries ) {
				sleep( $retry_delay );
				$retry_delay *= 2; // Exponential backoff (1s, 2s, 4s...).
				continue;
			}

			break;
		}

		if ( 200 !== $code ) {
			$msg = $data['error']['message'] ?? 'Unknown OpenRouter text generation error.';
			return new WP_Error( 'openrouter_error', $msg, array( 'status' => $code ) );
		}

		$text = $data['choices'][0]['message']['content'] ?? '';

		return new WP_REST_Response(
			array(
				'status' => 'completed',
				'text'   => $text,
			),
			200
		);
	}

	/**
	 * Dynamic Task submission router supporting robust backward compatibility.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_task_submission( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$task       = $request->get_param( 'task' );
		$model      = $request->get_param( 'model' );
		$provider   = $request->get_param( 'provider' );
		$image_id   = $request->get_param( 'original_id' );
		$image_data = $request->get_param( 'image_data' );

		// Assemble standard validation attributes map.
		$args = array(
			'task'               => $task,
			'image_data'         => $image_data,
			'mask_data'          => $request->get_param( 'mask_data' ),
			'prompt'             => $request->get_param( 'prompt' ),
			'select_prompt'      => $request->get_param( 'select_prompt' ),
			'model'              => $model,
			'left'               => $request->get_param( 'left' ),
			'right'              => $request->get_param( 'right' ),
			'up'                 => $request->get_param( 'up' ),
			'down'               => $request->get_param( 'down' ),
			'style_image'        => $request->get_param( 'style_image' ),
			'provider'           => $provider,
			'motion_bucket_id'   => $request->get_param( 'motion_bucket_id' ),
			'fps'                => $request->get_param( 'fps' ),
			'aspect_ratio'       => $request->get_param( 'aspect_ratio' ),
			'original_id'        => $image_id,
			'clicks'             => $request->get_param( 'clicks' ),
			'system_instruction' => $request->get_param( 'system_instruction' ),
			'temperature'        => $request->get_param( 'temperature' ),
		);

		// 1. Dynamic Route Detection: Segment Anything (SAM) Click Pipelines
		if ( 'sam-embed' === $task || 'sam-predict' === $task ) {
			if ( function_exists( 'wp_get_ability' ) && wp_get_ability( 'bearded-media/segment-image' ) ) {
				return wp_get_ability( 'bearded-media/segment-image' )->execute( $args );
			}
			return $this->ability_execute_segmentation( $args );
		}

		// 1.5 Dynamic Route Detection: Text Generation
		if ( 'generate-text' === $task ) {
			if ( function_exists( 'wp_get_ability' ) && wp_get_ability( 'bearded-media/generate-text' ) ) {
				return wp_get_ability( 'bearded-media/generate-text' )->execute( $args );
			}
			return $this->ability_execute_generate_text( $args );
		}

		// 2. Dynamic Route Detection: Multi-Provider Video Generation Models
		if ( 'generate-video' === $task || ! empty( $provider ) ) {
			if ( function_exists( 'wp_get_ability' ) && wp_get_ability( 'bearded-media/generate-video' ) ) {
				return wp_get_ability( 'bearded-media/generate-video' )->execute( $args );
			}
			return $this->ability_execute_generate_video( $args );
		}

		// 3. Fallback Route: Standard Image Generations
		if ( function_exists( 'wp_get_ability' ) && wp_get_ability( 'bearded-media/generate-image' ) ) {
			return wp_get_ability( 'bearded-media/generate-image' )->execute( $args );
		}

		return $this->ability_execute_generate_image( $args );
	}

	/**
	 * Stability AI task handler.
	 *
	 * @param string               $task          The task to run.
	 * @param string               $key           The API key.
	 * @param string               $image_data    The image data.
	 * @param string               $mask_data     The mask data.
	 * @param string               $prompt        The prompt.
	 * @param string               $select_prompt The select prompt.
	 * @param string               $model         The model to use.
	 * @param array<string, mixed> $extra         Extra parameters.
	 * @return WP_REST_Response|WP_Error
	 */
	private function handle_stability_task( $task, $key, $image_data, $mask_data, $prompt, $select_prompt, $model = '', $extra = array() ) {
		$base_url     = 'https://api.stability.ai/v2beta/stable-image';
		$params       = array( 'output_format' => 'jpeg' );
		$endpoint     = '';
		$files        = array();
		$is_multipart = true;

		// Helper to strip prefix if present.
		$clean_b64 = function ( $data ) {
			if ( strpos( $data, 'base64,' ) !== false ) {
				return explode( 'base64,', $data )[1];
			}
			return $data;
		};

		if ( ! empty( $image_data ) ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$image_bin = base64_decode( str_replace( ' ', '+', $clean_b64( $image_data ) ) );
			if ( $image_bin ) {
				$files['image'] = $image_bin;
			}
		}

		if ( ! empty( $mask_data ) ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$mask_bin = base64_decode( str_replace( ' ', '+', $clean_b64( $mask_data ) ) );
			if ( $mask_bin ) {
				$files['mask'] = $mask_bin;
			}
		}

		// 1. Task-Specific Endpoints
		if ( strpos( $task, 'stability-' ) === 0 ) {
			switch ( $task ) {
				case 'stability-erase':
					$endpoint = '/edit/erase';
					break;
				case 'stability-inpaint':
					$endpoint         = '/edit/inpaint';
					$params['prompt'] = $prompt;
					break;
				case 'stability-outpaint':
					$endpoint         = '/edit/outpaint';
					$params['prompt'] = $prompt;
					if ( isset( $extra['left'] ) ) {
						$params['left'] = intval( $extra['left'] );
					}
					if ( isset( $extra['right'] ) ) {
						$params['right'] = intval( $extra['right'] );
					}
					if ( isset( $extra['up'] ) ) {
						$params['up'] = intval( $extra['up'] );
					}
					if ( isset( $extra['down'] ) ) {
						$params['down'] = intval( $extra['down'] );
					}
					break;
				case 'stability-remove-bg':
					$endpoint                = '/edit/remove-background';
					$params['output_format'] = 'png';
					break;
				case 'stability-replace-bg-relight':
					$endpoint                    = '/edit/replace-background-and-relight';
					$params['background_prompt'] = $prompt;
					if ( isset( $files['image'] ) ) {
						$files['subject_image'] = $files['image'];
						unset( $files['image'] );
					}
					break;
				case 'stability-search-replace':
					$endpoint                = '/edit/search-and-replace';
					$params['prompt']        = $prompt;
					$params['search_prompt'] = $select_prompt;
					break;
				case 'stability-search-recolor':
					$endpoint                = '/edit/search-and-recolor';
					$params['prompt']        = $prompt;
					$params['select_prompt'] = $select_prompt;
					break;
				case 'stability-structure':
					$endpoint                   = '/control/structure';
					$params['prompt']           = $prompt;
					$params['control_strength'] = 0.7;
					break;
				case 'stability-sketch':
					$endpoint                   = '/control/sketch';
					$params['prompt']           = $prompt;
					$params['control_strength'] = 0.7;
					break;
				case 'stability-style-transfer':
					$endpoint = '/control/style-transfer';
					if ( isset( $files['image'] ) ) {
						$files['init_image'] = $files['image'];
						unset( $files['image'] );
					}
					if ( ! empty( $extra['style_image'] ) ) {
						// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
						$files['style_image'] = base64_decode( str_replace( ' ', '+', $clean_b64( $extra['style_image'] ) ) );
					}
					break;
			}
		} else {
			// 2. Model-Specific Endpoints.
			if ( strpos( $model, 'stability-sd3.5' ) !== false ) {
				$endpoint         = '/generate/sd3';
				$params['prompt'] = $prompt;
				$params['model']  = str_replace( 'stability-', '', $model );
			} elseif ( 'stability-core' === $model ) {
				$endpoint         = '/generate/core';
				$params['prompt'] = $prompt;
			} elseif ( 'stability-ultra' === $model ) {
				$endpoint         = '/generate/ultra';
				$params['prompt'] = $prompt;
			} elseif ( 'stability-sdxl-1.0' === $model ) {
				$is_multipart = false;
				$base_url     = 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0';
				$endpoint     = ( 'img2img' === $task ) ? '/image-to-image' : '/text-to-image';
			}

			if ( '/generate/sd3' === $endpoint ) {
				$params['mode'] = ( 'img2img' === $task && ! empty( $files['image'] ) ) ? 'image-to-image' : 'text-to-image';
				if ( 'image-to-image' === $params['mode'] ) {
					$params['strength'] = 0.7;
				}
			}
		}

		if ( ! $endpoint ) {
			return new WP_Error( 'invalid_task', 'Unknown Stability Task/Model' );
		}

		// Execute.
		if ( $is_multipart ) {
			return $this->submit_multipart_request( $base_url . $endpoint, $key, $params, $files );
		} else {
			$body = array(
				'text_prompts' => array(
					array(
						'text'   => $prompt,
						'weight' => 1,
					),
				),
				'samples'      => 1,
				'steps'        => 30,
			);
			if ( 'img2img' === $task && ! empty( $image_data ) ) {
				$body['init_image']     = $image_data;
				$body['image_strength'] = 0.35;
			} else {
				$body['height'] = 1024;
				$body['width']  = 1024;
			}

			$response = wp_remote_post(
				$base_url . $endpoint,
				array(
					'headers' => array(
						'Content-Type'  => 'application/json',
						'Authorization' => 'Bearer ' . $key,
						'Accept'        => 'application/json',
					),
					'body'    => wp_json_encode( $body ),
					'timeout' => 60,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$json = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( ! empty( $json['artifacts'][0]['base64'] ) ) {
				return new WP_REST_Response(
					array(
						'status'   => 'completed',
						'b64_json' => $json['artifacts'][0]['base64'],
					),
					200
				);
			}
			return new WP_Error( 'api_error', 'Stability V1 Error', array( 'status' => 500 ) );
		}
	}

	/**
	 * Submit video generation request to Stability AI.
	 *
	 * @param array<string, mixed> $args Extraction variables.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_stability_video_request( array $args ) {
		$url = 'https://api.stability.ai/v2beta/image-to-video';
		$key = $this->get_my_key( 'stability_key' );

		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'Stability AI API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$image_data = $args['image_data'] ?? '';
		if ( empty( $image_data ) ) {
			return new WP_Error( 'missing_image', __( 'Stability Image-to-Video requires a seed image.', 'bearded-media' ), array( 'status' => 400 ) );
		}

		$boundary = wp_generate_password( 24, false );
		$payload  = '';

		$fields = array(
			'seed'             => 0,
			'cfg_scale'        => 1.8,
			'motion_bucket_id' => intval( $args['motion_bucket_id'] ?? 127 ),
		);

		$clean_b64 = function ( $data ) {
			if ( strpos( $data, 'base64,' ) !== false ) {
				return explode( 'base64,', $data )[1];
			}
			return $data;
		};

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$image_bin = base64_decode( str_replace( ' ', '+', $clean_b64( $image_data ) ) );

		foreach ( $fields as $name => $value ) {
			$payload .= '--' . $boundary . "\r\n";
			$payload .= 'Content-Disposition: form-data; name="' . $name . '"' . "\r\n\r\n";
			$payload .= $value . "\r\n";
		}

		if ( $image_bin ) {
			$payload .= '--' . $boundary . "\r\n";
			$payload .= 'Content-Disposition: form-data; name="image"; filename="seed.jpg"' . "\r\n";
			$payload .= 'Content-Type: image/jpeg' . "\r\n\r\n";
			$payload .= $image_bin . "\r\n";
		}

		$payload .= '--' . $boundary . "--\r\n";

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'multipart/form-data; boundary=' . $boundary,
					'Accept'        => 'image/*',
				),
				'body'    => $payload,
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		if ( 200 !== $code ) {
			$json = json_decode( $body, true );
			$msg  = $json['errors'][0]['message'] ?? __( 'Stability Video Generation initiation failed.', 'bearded-media' );
			return new WP_Error( 'video_error', $msg, array( 'status' => $code ) );
		}

		$json = json_decode( $body, true );
		if ( isset( $json['id'] ) ) {
			return new WP_REST_Response(
				array(
					'status'   => 'processing',
					'task_id'  => 'stab_vid_' . $json['id'],
					'provider' => 'stability',
				),
				200
			);
		}

		return new WP_Error( 'video_error', __( 'No dynamic transaction ID was returned.', 'bearded-media' ), array( 'status' => 500 ) );
	}

	/**
	 * Submit video generation request to OpenRouter.
	 *
	 * @param array<string, mixed> $args Extraction parameters.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_openrouter_video_request( array $args ) {
		$url = 'https://openrouter.ai/api/v1/videos';
		$key = $this->get_my_key( 'openrouter_key' );

		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'OpenRouter API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$model      = $args['model'] ?? '';
		$prompt     = $args['prompt'] ?? '';
		$image_data = $args['image_data'] ?? '';

		$body = array(
			'model'  => $model,
			'prompt' => $prompt,
		);

		if ( ! empty( $image_data ) ) {
			$image_url_value = $image_data;
			if ( ! str_starts_with( $image_data, 'http' ) && strpos( $image_data, 'base64,' ) === false ) {
				$image_url_value = 'data:image/jpeg;base64,' . $image_data;
			}
			$body['image_url'] = $image_url_value;
		}

		$body_json = wp_json_encode( $body );
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( 'BeardedMedia Video Gen [DEBUG] - OpenRouter Request Body: ' . substr( $body_json, 0, 500 ) . '... [truncated]' );

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'application/json',
					'HTTP-Referer'  => get_home_url(),
					'X-Title'       => get_bloginfo( 'name' ),
				),
				'body'    => $body_json,
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( 'BeardedMedia Video Gen [DEBUG] - OpenRouter Request Error: ' . $response->get_error_message() );
			return $response;
		}

		$code      = wp_remote_retrieve_response_code( $response );
		$body_resp = wp_remote_retrieve_body( $response );

		if ( 200 !== $code && 202 !== $code ) {
			return new WP_Error( 'api_error', 'OpenRouter Error: ' . $code . ' | ' . $body_resp, array( 'status' => $code ) );
		}

		$data = json_decode( $body_resp, true );
		if ( isset( $data['id'] ) && isset( $data['polling_url'] ) ) {
			return new WP_REST_Response(
				array(
					'status'   => 'processing',
					// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
					'task_id'  => 'orvid_' . base64_encode( $data['polling_url'] ),
					'provider' => 'openrouter',
				),
				200
			);
		}

		return new WP_Error( 'api_error', 'OpenRouter Error: No polling_url returned.', array( 'status' => 500 ) );
	}

	/**
	 * Submit video generation request to OpenAI Sora or equivalent API.
	 *
	 * @param array<string, mixed> $args Extraction parameters.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_openai_video_request( array $args ) {
		$url = 'https://api.openai.com/v1/videos/generations';
		$key = $this->get_my_key( 'openai_key' );

		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'OpenAI API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$model  = $args['model'] ?? 'sora-1.0';
		$prompt = $args['prompt'] ?? '';

		$body = array(
			'model'  => $model,
			'prompt' => $prompt,
		);

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		if ( 200 !== $code ) {
			return new WP_Error( 'api_error', 'OpenAI Error: ' . $code . ' | ' . $body, array( 'status' => $code ) );
		}

		$data = json_decode( $body, true );
		if ( ! empty( $data['data'][0]['url'] ) ) {
			return new WP_REST_Response(
				array(
					'status'   => 'completed',
					'url'      => $data['data'][0]['url'],
					'provider' => 'openai',
				),
				200
			);
		}

		return new WP_Error( 'api_error', __( 'OpenAI generated video URL missing from payload.', 'bearded-media' ), array( 'status' => 500 ) );
	}

	/**
	 * Submit video generation request to Gemini (Google AI Studio Veo API).
	 *
	 * @param array<string, mixed> $args Extraction parameters.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_gemini_video_request( array $args ) {
		$key = $this->get_my_key( 'gemini_key' );
		if ( empty( $key ) ) {
			return new WP_Error( 'missing_key', __( 'Gemini API Key is missing.', 'bearded-media' ), array( 'status' => 500 ) );
		}

		$model      = $args['model'] ?? 'veo-2.0';
		$prompt     = $args['prompt'] ?? '';
		$image_data = $args['image_data'] ?? '';

		$url   = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}";
		$parts = array();

		if ( ! empty( $prompt ) ) {
			$parts[] = array( 'text' => $prompt );
		}
		if ( ! empty( $image_data ) ) {
			if ( strpos( $image_data, 'base64,' ) !== false ) {
				$image_data = explode( 'base64,', $image_data )[1];
			}
			$parts[] = array(
				'inlineData' => array(
					'mimeType' => 'image/jpeg',
					'data'     => $image_data,
				),
			);
		}

		$body = array( 'contents' => array( array( 'parts' => $parts ) ) );

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );

		if ( 200 !== $code ) {
			$data = json_decode( $body, true );
			$msg  = $data['error']['message'] ?? 'Gemini Error';
			return new WP_Error( 'api_error', 'Gemini Error: ' . $msg, array( 'status' => $code ) );
		}

		$data      = json_decode( $body, true );
		$b64_video = null;

		if ( ! empty( $data['candidates'][0]['content']['parts'] ) ) {
			foreach ( $data['candidates'][0]['content']['parts'] as $part ) {
				if ( ! empty( $part['inlineData']['data'] ) && strpos( $part['inlineData']['mimeType'], 'video' ) !== false ) {
					$b64_video = $part['inlineData']['data'];
					break;
				}
			}
		}

		if ( $b64_video ) {
			return new WP_REST_Response(
				array(
					'status'   => 'completed',
					'b64_json' => $b64_video,
					'provider' => 'gemini',
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'   => 'completed',
				'result'   => $data,
				'provider' => 'gemini',
			),
			200
		);
	}

	/**
	 * Submit multipart request to Stability AI (Image).
	 *
	 * @param string               $url    Request URL.
	 * @param string               $key    API Key.
	 * @param array<string, mixed> $fields Request fields.
	 * @param array<string, mixed> $files  Request files.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_multipart_request( $url, $key, $fields, $files ) {
		$boundary = wp_generate_password( 24, false );
		$payload  = '';

		foreach ( $fields as $name => $value ) {
			$payload .= '--' . $boundary . "\r\n";
			$payload .= 'Content-Disposition: form-data; name="' . $name . '"' . "\r\n\r\n";
			$payload .= $value . "\r\n";
		}

		foreach ( $files as $name => $content ) {
			$mime     = ( 'mask' === $name ) ? 'image/png' : 'image/jpeg';
			$filename = 'image.' . ( 'image/png' === $mime ? 'png' : 'jpg' );

			$payload .= '--' . $boundary . "\r\n";
			$payload .= 'Content-Disposition: form-data; name="' . $name . '"; filename="' . $filename . '"' . "\r\n";
			$payload .= 'Content-Type: ' . $mime . "\r\n\r\n";
			$payload .= $content . "\r\n";
		}

		$payload .= '--' . $boundary . "--\r\n";

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'multipart/form-data; boundary=' . $boundary,
					'Accept'        => 'image/*',
				),
				'body'    => $payload,
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code         = wp_remote_retrieve_response_code( $response );
		$body         = wp_remote_retrieve_body( $response );
		$content_type = wp_remote_retrieve_header( $response, 'content-type' );

		if ( 200 !== $code ) {
			$json = json_decode( $body, true );
			$msg  = 'Unknown Stability Error';
			if ( ! empty( $json['errors'] ) && is_array( $json['errors'] ) ) {
				$first_err = $json['errors'][0];
				if ( is_string( $first_err ) ) {
					$msg = $first_err;
				} elseif ( is_array( $first_err ) && isset( $first_err['message'] ) ) {
					$msg = $first_err['message'];
				}
			} elseif ( ! empty( $json['message'] ) ) {
				$msg = $json['message'];
			} else {
				$msg .= ' | Raw: ' . substr( wp_strip_all_tags( $body ), 0, 150 );
			}
			return new WP_Error( 'api_error', 'Stability AI: ' . $msg, array( 'status' => $code ) );
		}

		if ( strpos( (string) $content_type, 'application/json' ) !== false ) {
			$json = json_decode( $body, true );
			if ( isset( $json['id'] ) ) {
				return new WP_REST_Response(
					array(
						'status'   => 'processing',
						'task_id'  => 'stab_' . $json['id'],
						'provider' => 'stability',
					),
					200
				);
			}
		}

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$b64 = base64_encode( $body );
		return new WP_REST_Response(
			array(
				'status'   => 'completed',
				'b64_json' => $b64,
				'provider' => 'stability',
			),
			200
		);
	}

	/**
	 * Submit request to Google Gemini API (Image).
	 *
	 * @param string      $model      The model to use.
	 * @param string      $api_key    The API key.
	 * @param string      $prompt     The prompt.
	 * @param string|null $image_data The image data.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_gemini_request( $model, $api_key, $prompt, $image_data = null ) {
		$url   = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$api_key}";
		$parts = array();
		if ( ! empty( $prompt ) ) {
			$parts[] = array( 'text' => $prompt );
		}
		if ( ! empty( $image_data ) ) {
			if ( strpos( $image_data, 'base64,' ) !== false ) {
				$image_data = explode( 'base64,', $image_data )[1];
			}
			$parts[] = array(
				'inlineData' => array(
					'mimeType' => 'image/jpeg',
					'data'     => $image_data,
				),
			);
		}
		$body = array( 'contents' => array( array( 'parts' => $parts ) ) );

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
				'timeout' => 60,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code ) {
			$msg = isset( $data['error']['message'] ) ? $data['error']['message'] : 'Unknown Gemini Error';
			return new WP_Error( 'api_error', 'Gemini Error: ' . $msg, array( 'status' => $code ) );
		}

		$b64_image = null;
		if ( ! empty( $data['candidates'][0]['content']['parts'] ) ) {
			foreach ( $data['candidates'][0]['content']['parts'] as $part ) {
				if ( ! empty( $part['inlineData']['data'] ) ) {
					$b64_image = $part['inlineData']['data'];
					break;
				}
			}
		}

		$result = array(
			'status'   => 'completed',
			'task_id'  => 'gemini_sync_' . uniqid(),
			'provider' => 'gemini',
			'result'   => $data,
		);
		if ( $b64_image ) {
			$result['b64_json'] = $b64_image;
		}
		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * Submit request to Black Forest Labs (Flux).
	 *
	 * @param string               $url     The endpoint URL.
	 * @param string               $api_key The API key.
	 * @param array<string, mixed> $body    The request body.
	 * @return WP_REST_Response|WP_Error
	 */
	private function submit_bfl_request( $url, $api_key, $body ) {
		$response = wp_remote_post(
			$url,
			array(
				'headers' => array(
					'Content-Type' => 'application/json',
					'X-Key'        => $api_key,
				),
				'body'    => wp_json_encode( $body ),
				'timeout' => 30,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code     = wp_remote_retrieve_response_code( $response );
		$body_str = wp_remote_retrieve_body( $response );
		$data     = json_decode( $body_str, true );

		if ( 200 !== $code ) {
			$detail = isset( $data['detail'] ) ? $data['detail'] : 'Unknown Error';
			if ( is_array( $detail ) ) {
				$detail = wp_json_encode( $detail );
			}
			return new WP_Error( 'api_error', 'Provider Error: ' . $detail, array( 'status' => $code ) );
		}

		return new WP_REST_Response(
			array(
				'status'   => 'processing',
				'task_id'  => $data['id'],
				'provider' => 'bfl',
			),
			200
		);
	}

	/**
	 * Dynamic Polling logic supporting async video streams and traditional targets.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_task_check( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$task_id = $request->get_param( 'task_id' );
		if ( ! $task_id ) {
			return new WP_Error( 'no_id', 'Missing Task ID', array( 'status' => 400 ) );
		}

		if ( strpos( $task_id, 'gemini_sync_' ) === 0 ) {
			return new WP_Error( 'invalid_poll', 'Gemini tasks complete immediately.', array( 'status' => 400 ) );
		}

		// OpenRouter Handshake Routing.
		if ( strpos( $task_id, 'orvid_' ) === 0 ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$polling_url = base64_decode( substr( $task_id, 6 ) );
			$api_key     = $this->get_my_key( 'openrouter_key' );

			if ( ! $api_key ) {
				return new WP_Error( 'missing_key', 'OpenRouter Key Missing', array( 'status' => 500 ) );
			}

			$response = wp_remote_get(
				$polling_url,
				array(
					'headers' => array( 'Authorization' => 'Bearer ' . $api_key ),
					'timeout' => 30,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code = wp_remote_retrieve_response_code( $response );
			$body = wp_remote_retrieve_body( $response );

			if ( 200 !== $code ) {
				return new WP_Error( 'task_failed', 'OpenRouter Polling Error: ' . $code . ' | ' . $body, array( 'status' => $code ) );
			}

			$data   = json_decode( $body, true );
			$status = $data['status'] ?? 'Unknown';

			if ( 'completed' === $status ) {
				if ( ! empty( $data['unsigned_urls'][0] ) ) {
					$video_url = $data['unsigned_urls'][0];
					$vid_req   = wp_remote_get(
						$video_url,
						array(
							'headers' => array( 'Authorization' => 'Bearer ' . $api_key ),
							'timeout' => 90,
						)
					);

					if ( ! is_wp_error( $vid_req ) && 200 === wp_remote_retrieve_response_code( $vid_req ) ) {
						// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
						$b64 = base64_encode( wp_remote_retrieve_body( $vid_req ) );
						return new WP_REST_Response(
							array(
								'status'   => 'completed',
								'b64_json' => $b64,
								'provider' => 'openrouter',
							),
							200
						);
					}

					return new WP_REST_Response(
						array(
							'status'   => 'completed',
							'url'      => $video_url,
							'provider' => 'openrouter',
						),
						200
					);
				}
				return new WP_Error( 'task_failed', 'OpenRouter generation completed but no URL returned.', array( 'status' => 500 ) );
			} elseif ( 'failed' === $status ) {
				return new WP_Error( 'task_failed', 'OpenRouter Generation Failed: ' . ( $data['error'] ?? 'Unknown' ), array( 'status' => 500 ) );
			}

			return new WP_REST_Response( array( 'status' => 'processing' ), 200 );
		}

		// Stability AI Handshake Routing.
		if ( strpos( $task_id, 'stab_' ) === 0 ) {
			$is_video = ( strpos( $task_id, 'stab_vid_' ) === 0 );
			$real_id  = $is_video ? substr( $task_id, 9 ) : substr( $task_id, 5 );

			$api_key = $this->get_my_key( 'stability_key' );
			if ( ! $api_key ) {
				return new WP_Error( 'missing_key', 'Stability Key Missing', array( 'status' => 500 ) );
			}

			if ( $is_video ) {
				$url    = 'https://api.stability.ai/v2beta/image-to-video/result/' . $real_id;
				$accept = 'video/*';
			} else {
				$url    = 'https://api.stability.ai/v2beta/results/' . $real_id;
				$accept = 'application/json';
			}

			$response = wp_remote_get(
				$url,
				array(
					'headers' => array(
						'Authorization' => 'Bearer ' . $api_key,
						'Accept'        => $accept,
					),
					'timeout' => 30,
				)
			);

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code         = wp_remote_retrieve_response_code( $response );
			$body         = wp_remote_retrieve_body( $response );
			$content_type = wp_remote_retrieve_header( $response, 'content-type' );

			if ( 202 === $code ) {
				return new WP_REST_Response( array( 'status' => 'processing' ), 200 );
			} elseif ( 200 === $code ) {
				// Handle raw binary video streams.
				if ( $is_video && str_starts_with( (string) $content_type, 'video/' ) ) {
					// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
					$b64 = base64_encode( $body );
					return new WP_REST_Response(
						array(
							'status'    => 'completed',
							'b64_json'  => $b64,
							'mime_type' => $content_type,
						),
						200
					);
				}

				// Handle structural JSON output frames.
				$json = json_decode( $body, true );
				if ( is_array( $json ) ) {
					if ( isset( $json['image'] ) ) {
						return new WP_REST_Response(
							array(
								'status'   => 'completed',
								'b64_json' => $json['image'],
							),
							200
						);
					} elseif ( isset( $json['result'] ) ) {
						return new WP_REST_Response(
							array(
								'status'   => 'completed',
								'b64_json' => $json['result'],
							),
							200
						);
					}
				}

				// Handle raw image buffers.
				if ( JSON_ERROR_NONE !== json_last_error() || strpos( (string) $content_type, 'image' ) !== false ) {
					// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
					$b64 = base64_encode( $body );
					return new WP_REST_Response(
						array(
							'status'   => 'completed',
							'b64_json' => $b64,
						),
						200
					);
				}

				return new WP_Error( 'task_failed', 'Stability API returned 200 but target data payload is missing.', array( 'status' => 500 ) );
			} else {
				$msg  = 'Generation Failed';
				$json = json_decode( $body, true );
				if ( is_array( $json ) && ! empty( $json['errors'] ) ) {
					$msg = $json['errors'][0]['message'] ?? $json['message'] ?? 'Unknown';
				} else {
					$msg .= ' | ' . substr( wp_strip_all_tags( $body ), 0, 100 );
				}
				return new WP_Error( 'task_failed', 'Stability Error: ' . $msg, array( 'status' => $code ) );
			}
		}

		// Black Forest Labs (Flux) Handshake Routing.
		$api_key = $this->get_my_key( 'bfl_key' );
		if ( ! $api_key ) {
			return new WP_Error( 'missing_key', 'BFL Key Missing', array( 'status' => 500 ) );
		}

		$url      = 'https://api.bfl.ml/v1/get_result?id=' . $task_id;
		$response = wp_remote_get(
			$url,
			array(
				'headers' => array( 'X-Key' => $api_key ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data   = json_decode( wp_remote_retrieve_body( $response ), true );
		$status = $data['status'] ?? 'Unknown';

		if ( 'Ready' === $status && ! empty( $data['result']['sample'] ) ) {
			$img_url = $data['result']['sample'];
			$img_req = wp_remote_get( $img_url );
			if ( ! is_wp_error( $img_req ) ) {
				// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
				$b64 = base64_encode( wp_remote_retrieve_body( $img_req ) );
				return new WP_REST_Response(
					array(
						'status'   => 'completed',
						'b64_json' => $b64,
					),
					200
				);
			}
		} elseif ( 'Failed' === $status || 'Error' === $status ) {
			return new WP_Error( 'task_failed', 'Generation Failed', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'status'   => 'processing',
				'progress' => $data['progress'] ?? 0,
			),
			200
		);
	}

	/**
	 * Handles saving generated or edited media types directly to the WordPress library.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return mixed
	 */
	public function handle_save_media( WP_REST_Request $request ) {
		wp_raise_memory_limit( 'bearded-media' );
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 300 );
		}

		$image_data  = $request->get_param( 'image_data' );
		$image_url   = $request->get_param( 'image_url' );
		$original_id = $request->get_param( 'original_id' );
		$save_mode   = $request->get_param( 'save_mode' );

		$decoded = null;

		if ( ! empty( $image_url ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';

			$tmp = download_url( $image_url );
			if ( is_wp_error( $tmp ) ) {
				return $tmp;
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$decoded = file_get_contents( $tmp );
			wp_delete_file( $tmp );
		} elseif ( ! empty( $image_data ) ) {
			if ( strpos( $image_data, 'base64,' ) !== false ) {
				$image_data = explode( 'base64,', $image_data )[1];
			}
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$decoded = base64_decode( $image_data );
		} else {
			return new WP_Error( 'no_data', 'No data provided', array( 'status' => 400 ) );
		}

		if ( empty( $decoded ) ) {
			return new WP_Error( 'decode_failed', 'Media data is empty or invalid', array( 'status' => 400 ) );
		}

		if ( ! class_exists( '\finfo' ) ) {
			return new WP_Error( 'missing_finfo', 'PHP finfo class is missing', array( 'status' => 500 ) );
		}

		$finfo     = new \finfo( FILEINFO_MIME_TYPE );
		$mime_type = $finfo->buffer( $decoded );

		// Broaden signature allowances to process both image assets and video layers.
		$allowed_mime_types = array(
			'image/jpeg',
			'image/png',
			'image/webp',
			'video/mp4',
			'video/webm',
		);

		if ( ! in_array( $mime_type, $allowed_mime_types, true ) ) {
			return new WP_Error( 'invalid_media', 'Decoded data is not a supported image or video format', array( 'status' => 400 ) );
		}

		// Save Logic: Process Overwriting Configurations.
		if ( 'overwrite' === $save_mode && $original_id ) {
			clean_post_cache( $original_id );

			$file_path = get_attached_file( $original_id );

			if ( $file_path && file_exists( $file_path ) ) {
				$meta = wp_get_attachment_metadata( $original_id );
				$dir  = pathinfo( $file_path, PATHINFO_DIRNAME );

				if ( ! empty( $meta['sizes'] ) ) {
					foreach ( $meta['sizes'] as $size ) {
						$thumb_path = $dir . '/' . $size['file'];
						if ( file_exists( $thumb_path ) ) {
							wp_delete_file( $thumb_path );
						}
					}
				}

				global $wp_filesystem;
				if ( empty( $wp_filesystem ) ) {
					require_once ABSPATH . 'wp-admin/includes/file.php';
					WP_Filesystem();
				}

				$success = false;
				if ( ! empty( $wp_filesystem ) && $wp_filesystem->connect() ) {
					$success = $wp_filesystem->put_contents( $file_path, $decoded );
				} else {
					// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
					$success = ( false !== file_put_contents( $file_path, $decoded ) );
				}

				if ( ! $success ) {
					return new WP_Error( 'write_failed', 'Could not write to file path', array( 'status' => 500 ) );
				}

				clearstatcache( true, $file_path );

				require_once ABSPATH . 'wp-admin/includes/image.php';
				require_once ABSPATH . 'wp-admin/includes/media.php';

				$attach_data = wp_generate_attachment_metadata( $original_id, $file_path );

				if ( empty( $attach_data ) ) {
					$attach_data = array( 'file' => _wp_relative_upload_path( $file_path ) );
				}

				wp_update_attachment_metadata( $original_id, $attach_data );
				clean_post_cache( $original_id );

				return new WP_REST_Response(
					array(
						'id'  => $original_id,
						'url' => wp_get_attachment_url( $original_id ),
					),
					200
				);
			}
		}

		// Save Logic: Process New File Generation Operations.
		$upload_dir = wp_upload_dir();
		$ext        = 'jpg';

		if ( 'image/png' === $mime_type ) {
			$ext = 'png';
		} elseif ( 'image/webp' === $mime_type ) {
			$ext = 'webp';
		} elseif ( 'video/mp4' === $mime_type ) {
			$ext = 'mp4';
		} elseif ( 'video/webm' === $mime_type ) {
			$ext = 'webm';
		}

		$filename  = 'bearded-' . time() . '-' . wp_generate_password( 4, false ) . '.' . $ext;
		$file_path = $upload_dir['path'] . '/' . $filename;

		global $wp_filesystem;
		if ( empty( $wp_filesystem ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}

		$success = false;
		if ( ! empty( $wp_filesystem ) && $wp_filesystem->connect() ) {
			$success = $wp_filesystem->put_contents( $file_path, $decoded );
		} else {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			$success = ( false !== file_put_contents( $file_path, $decoded ) );
		}

		if ( ! $success ) {
			return new WP_Error( 'write_failed', 'Could not write new file to disk.', array( 'status' => 500 ) );
		}

		$filetype   = wp_check_filetype( $filename, null );
		$attachment = array(
			'post_mime_type' => $filetype['type'],
			'post_title'     => sanitize_file_name( $filename ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attach_id = wp_insert_attachment( $attachment, $file_path, $original_id ? $original_id : 0 );

		// @phpstan-ignore-next-line
		if ( is_wp_error( $attach_id ) || ! $attach_id ) {
			return new WP_Error( 'insert_failed', 'Could not insert attachment into database.', array( 'status' => 500 ) );
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$attach_data = @wp_generate_attachment_metadata( $attach_id, $file_path );
		wp_update_attachment_metadata( $attach_id, $attach_data );

		return new WP_REST_Response(
			array(
				'id'  => $attach_id,
				'url' => wp_get_attachment_url( $attach_id ),
			),
			200
		);
	}
}
