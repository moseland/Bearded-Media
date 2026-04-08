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
	 * Retrieve keys dynamically
	 *
	 * @param string $slug Slug to retrieve.
	 * @return string Key value.
	 */
	private function get_my_key( $slug ) {
		$keys_module = Plugin::get_instance()->get_module( 'keys' );
		return $keys_module ? $keys_module->get_key( $slug ) : '';
	}

	/**
	 * Stock photo search.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function handle_stock_search( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$key = $this->get_my_key( 'pexels_key' );

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
	 * Task submission logic.
	 *
	 * @param WP_REST_Request $request The request object.
	 */
	public function handle_task_submission( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		wp_raise_memory_limit( 'bearded-media' );

		$task          = $request->get_param( 'task' );
		$image_data    = $request->get_param( 'image_data' );
		$mask_data     = $request->get_param( 'mask_data' );
		$prompt        = $request->get_param( 'prompt' );
		$select_prompt = $request->get_param( 'select_prompt' );
		$model         = $request->get_param( 'model' );

		$extra_params = array(
			'left'        => $request->get_param( 'left' ),
			'right'       => $request->get_param( 'right' ),
			'up'          => $request->get_param( 'up' ),
			'down'        => $request->get_param( 'down' ),
			'style_image' => $request->get_param( 'style_image' ),
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
				case 'stability-upscale-fast':
					$endpoint = '/upscale/fast';
					break;
				case 'stability-upscale-creative':
					$endpoint         = '/upscale/creative';
					$params['prompt'] = $prompt;
					break;
				case 'stability-upscale-conservative':
					$endpoint         = '/upscale/conservative';
					$params['prompt'] = $prompt;
					break;
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
	 * Submit multipart request to Stability AI.
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
	 * Submit request to Google Gemini API.
	 *
	 * @param string $model      Gemini model.
	 * @param string $api_key    API key.
	 * @param string $prompt     The prompt.
	 * @param string $image_data The image data (optional).
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
		/**
		 * The Gemini request body.
		 *
		 * @var array<string, array<int, array<string, mixed>>|array<int, mixed>> $body
		 */
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
	 * @param string               $url     Request URL.
	 * @param string               $api_key API key.
	 * @param array<string, mixed> $body    Request body.
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
	 * Polling logic.
	 *
	 * @param WP_REST_Request $request The request object.
	 */
	public function handle_task_check( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$task_id = $request->get_param( 'task_id' );
		if ( ! $task_id ) {
			return new WP_Error( 'no_id', 'Missing Task ID', array( 'status' => 400 ) );
		}

		if ( strpos( $task_id, 'gemini_sync_' ) === 0 ) {
			return new WP_Error( 'invalid_poll', 'Gemini tasks complete immediately.', array( 'status' => 400 ) );
		}

		if ( strpos( $task_id, 'stab_' ) === 0 ) {
			$real_id = substr( $task_id, 5 );
			$api_key = $this->get_my_key( 'stability_key' );
			if ( ! $api_key ) {
				return new WP_Error( 'missing_key', 'Stability Key Missing', array( 'status' => 500 ) );
			}

			$url      = 'https://api.stability.ai/v2beta/results/' . $real_id;
			$response = wp_remote_get(
				$url,
				array(
					'headers' => array(
						'Authorization' => 'Bearer ' . $api_key,
						'Accept'        => 'application/json',
					),
					'timeout' => 15,
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
				return new WP_Error( 'task_failed', 'Stability API returned 200 but image data missing.', array( 'status' => 500 ) );
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
	 * Handles saving generated or edited images to the library.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return mixed
	 */
	public function handle_save_image( WP_REST_Request $request ) {
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

			// We use native file_get_contents here as $tmp is a local file created by download_url.
			// This avoids fatal errors when WP_Filesystem is configured for FTP but connection fails.
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
			return new WP_Error( 'decode_failed', 'Image data is empty or invalid', array( 'status' => 400 ) );
		}

		if ( ! class_exists( '\finfo' ) ) {
			return new WP_Error( 'missing_finfo', 'PHP finfo class is missing', array( 'status' => 500 ) );
		}

		$finfo     = new \finfo( FILEINFO_MIME_TYPE );
		$mime_type = $finfo->buffer( $decoded );
		if ( ! str_starts_with( $mime_type, 'image/' ) ) {
			return new WP_Error( 'invalid_image', 'Decoded data is not a valid image', array( 'status' => 400 ) );
		}

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

				// If WP_Filesystem is initialized and connected, use it. Otherwise, fallback to native.
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

		$upload_dir = wp_upload_dir();
		$ext        = 'jpg';
		if ( 'image/png' === $mime_type ) {
			$ext = 'png';
		} elseif ( 'image/webp' === $mime_type ) {
			$ext = 'webp';
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
