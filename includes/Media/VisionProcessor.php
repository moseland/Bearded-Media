<?php
/**
 * Vision Processor class file.
 *
 * @package BeardedMedia\Media
 */

namespace BeardedMedia\Media;

use BeardedMedia\Core\Plugin;
use WP_Error;

/**
 * Class VisionProcessor
 *
 * Handles AI-driven media analysis, automated metadata generation, and SEO-friendly file renaming.
 *
 * @package BeardedMedia\Media
 */
class VisionProcessor {

	/**
	 * Constructor
	 */
	public function __construct() {
		// Hook into the metadata generation process after a file is uploaded.
		add_filter( 'wp_generate_attachment_metadata', array( $this, 'auto_process_on_upload' ), 10, 2 );
	}

	/**
	 * Automatically trigger analysis on upload if the feature is enabled in settings
	 *
	 * @param array<string, mixed> $metadata      Attachment metadata.
	 * @param int                  $attachment_id Attachment ID.
	 * @return array<string, mixed>
	 */
	public function auto_process_on_upload( array $metadata, int $attachment_id ): array {
		$settings = get_option( 'bearded_media_settings', array() );

		// Check if any automated features are enabled.
		$auto_alt = ! empty( $settings['bearded_media_auto_alt'] );
		$seo_ren  = ! empty( $settings['bearded_media_seo_rename'] );

		if ( ! $auto_alt && ! $seo_ren ) {
			return $metadata;
		}

		$this->analyze_image( $attachment_id, $seo_ren );

		return $metadata;
	}

	/**
	 * Orchestrates the analysis of a specific image
	 *
	 * @param int  $attachment_id The ID of the media item.
	 * @param bool $should_rename Whether to physically rename the file for SEO.
	 * @return array<string, mixed>|WP_Error
	 */
	public function analyze_image( int $attachment_id, bool $should_rename = false ): array|WP_Error {
		$mime_type = get_post_mime_type( $attachment_id );
		if ( ! str_starts_with( $mime_type, 'image/' ) ) {
			return new WP_Error( 'invalid_type', __( 'Vision analysis only supports image files.', 'bearded-media' ) );
		}

		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new WP_Error( 'no_file', __( 'Attachment file not found on server.', 'bearded-media' ) );
		}

		$keys_module = Plugin::get_instance()->get_module( 'keys' );
		$api_key     = $keys_module ? $keys_module->get_key( 'gemini_key' ) : '';

		if ( empty( $api_key ) ) {
			return new WP_Error( 'missing_key', __( 'Google Gemini API key is missing.', 'bearded-media' ) );
		}

		// Prepare binary data for the API using the public URL.
		$url      = wp_get_attachment_url( $attachment_id );
		$response = wp_remote_get( $url );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$image_data = wp_remote_retrieve_body( $response );

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$base64_image = base64_encode( $image_data );

		// Execute API call.
		$analysis = $this->call_vision_api( $api_key, $base64_image, $mime_type );

		if ( is_wp_error( $analysis ) ) {
			return $analysis;
		}

		// Update database metadata.
		$this->apply_metadata( $attachment_id, $analysis );

		// Handle SEO renaming if requested.
		if ( $should_rename && ! empty( $analysis['title'] ) ) {
			$this->rename_physical_file( $attachment_id, $analysis['title'], $file_path );
		}

		return $analysis;
	}

	/**
	 * Communicates with the Gemini Pro Vision API
	 *
	 * @param string $api_key      The Google API Key.
	 * @param string $base64_image Base64 encoded image string.
	 * @param string $mime_type    The file mime type.
	 * @return array<string, mixed>|WP_Error
	 */
	private function call_vision_api( string $api_key, string $base64_image, string $mime_type ): array|WP_Error {
		$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' . $api_key;

		$prompt = "Analyze this image for accessibility and SEO. Return a JSON object containing: 
            'title' (SEO friendly, lowercase, hyphenated, 2-5 words), 
            'alt_text' (Descriptive for screen readers), 
            'caption' (Contextual summary).";

		$body = array(
			'contents'         => array(
				array(
					'parts' => array(
						array( 'text' => $prompt ),
						array(
							'inline_data' => array(
								'mime_type' => $mime_type,
								'data'      => $base64_image,
							),
						),
					),
				),
			),
			'generationConfig' => array(
				'response_mime_type' => 'application/json',
			),
		);

		$response = wp_remote_post(
			$url,
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
				'timeout' => 30,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body_str    = wp_remote_retrieve_body( $response );
		$data        = json_decode( $body_str, true );

		if ( 200 !== $status_code ) {
			$error_msg = $data['error']['message'] ?? __( 'Unknown API error.', 'bearded-media' );
			return new WP_Error( 'api_fail', 'Gemini API: ' . $error_msg );
		}

		$raw_text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
		$result   = json_decode( $raw_text, true );

		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return new WP_Error( 'json_fail', __( 'Failed to parse AI response.', 'bearded-media' ) );
		}

		return $result;
	}

	/**
	 * Updates the WordPress database with analyzed metadata
	 *
	 * @param int                  $id   Attachment ID.
	 * @param array<string, mixed> $data Analyzed AI data.
	 */
	private function apply_metadata( int $id, array $data ): void {
		$update = array( 'ID' => $id );

		if ( ! empty( $data['caption'] ) ) {
			$update['post_excerpt'] = sanitize_text_field( $data['caption'] );
		}

		wp_update_post( $update );

		if ( ! empty( $data['alt_text'] ) ) {
			update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $data['alt_text'] ) );
		}
	}

	/**
	 * Physically renames the file on the server for SEO purposes
	 *
	 * @param int    $id        Attachment ID.
	 * @param string $new_title The AI-suggested title.
	 * @param string $old_path  The current file path.
	 */
	private function rename_physical_file( int $id, string $new_title, string $old_path ): void {
		$path_info = pathinfo( $old_path );
		$dir       = $path_info['dirname'];
		$ext       = $path_info['extension'];

		// Create a clean, URL-safe filename.
		$slug         = sanitize_title( $new_title );
		$new_filename = $slug . '.' . $ext;
		$new_path     = $dir . '/' . $new_filename;

		// Avoid collisions.
		if ( file_exists( $new_path ) && $new_path !== $old_path ) {
			$new_filename = $slug . '-' . uniqid() . '.' . $ext;
			$new_path     = $dir . '/' . $new_filename;
		}

		if ( $old_path === $new_path ) {
			return;
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		global $wp_filesystem;

		if ( $wp_filesystem->move( $old_path, $new_path ) ) {
			// Update the database references.
			update_attached_file( $id, $new_path );
			wp_update_post(
				array(
					'ID'         => $id,
					'post_title' => str_replace( '-', ' ', $slug ),
					'post_name'  => $slug,
				)
			);

			// Regenerate thumbnails for the new filename.
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$new_metadata = wp_generate_attachment_metadata( $id, $new_path );
			wp_update_attachment_metadata( $id, $new_metadata );
		}
	}
}
