<?php
/**
 * Plugin Name:       Bearded Media
 * Plugin URI:        https://matt.ose.land
 * Description:       AI Media Tools for WordPress. Features client-side optimization, vision-based auto-tagging, and generative editing.
 * Version:           2.0.0
 * Author:            Matthew Oseland
 * Author URI:        https://matt.ose.land
 * Text Domain:       bearded-media
 * Requires PHP:      8.2
 *
 * @package BeardedMedia
 */

namespace BeardedMedia;

use BeardedMedia\Core\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Autoload classes
 */
if ( file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
} else {
	spl_autoload_register(
		function ( $class_name ) {
			$prefix   = 'BeardedMedia\\';
			$base_dir = __DIR__ . '/includes/';
			$len      = strlen( $prefix );

			if ( strncmp( $prefix, $class_name, $len ) !== 0 ) {
					return;
			}

			$relative_class = substr( $class_name, $len );
			$file           = $base_dir . str_replace( '\\', '/', $relative_class ) . '.php';

			if ( file_exists( $file ) ) {
				require $file;
			}
		}
	);
}

/**
 * Initialize the plugin instance
 */
function init(): Plugin {
	return Plugin::get_instance();
}

init();

/**
 * Activation
 */
register_activation_hook(
	__FILE__,
	function () {
		set_transient( 'bearded_media_activated', true, 30 );
	}
);
