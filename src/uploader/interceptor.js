import { resizeImage } from '../utils/resize';
import webpfy from '../utils/webpfy';

/**
 * Extracts the native File object from a Plupload wrapper.
 *
 * @param {Object} fileWrapper Plupload file wrapper.
 */
const getNativeFile = ( fileWrapper ) => {
	try {
		// Wrapper's direct source (Common in HTML5 runtime)
		if (
			fileWrapper.source &&
			( fileWrapper.source instanceof File ||
				fileWrapper.source instanceof Blob )
		) {
			return fileWrapper.source;
		}
		// getNative() - Standard API, but can crash if internal mapping is missing
		if ( typeof fileWrapper.getNative === 'function' ) {
			return fileWrapper.getNative();
		}
		// getSource() - Moxie internal
		if ( typeof fileWrapper.getSource === 'function' ) {
			return fileWrapper.getSource();
		}
	} catch ( e ) {
		return null;
	}

	return null;
};

const attachToUploader = ( uploaderInstance ) => {
	if ( ! uploaderInstance ) {
		return;
	}

	// Handle case where we get the WP Uploader object instead of the raw Plupload instance
	if (
		uploaderInstance.uploader &&
		typeof uploaderInstance.uploader.bind === 'function'
	) {
		uploaderInstance = uploaderInstance.uploader;
	}

	if (
		typeof uploaderInstance.bind !== 'function' ||
		uploaderInstance._beardedMediaAttached
	) {
		return;
	}

	console.log(
		'Bearded Media: Interceptor attached to',
		uploaderInstance.id
	);

	// PROCESSING QUEUE
	// queueItem: { pluploadFile, nativeFile }
	const processingQueue = [];
	let isProcessing = false;

	const processQueue = async ( up ) => {
		if ( isProcessing ) {
			return;
		}

		if ( processingQueue.length === 0 ) {
			console.log( 'Bearded Media: Queue empty, resuming upload.' );
			// Small delay to allow UI to settle before starting the actual network upload
			setTimeout( () => up.start(), 100 );
			return;
		}

		isProcessing = true;
		up.stop();

		const item = processingQueue.shift();

		try {
			await processItem( item, up );
			await new Promise( ( r ) => setTimeout( r, 1000 ) );
		} catch ( err ) {
			console.error(
				'Bearded Media: File processing failed',
				item.pluploadFile?.name,
				err
			);

			// Fallback: Add the original file back if processing crashed hard
			try {
				if ( item.nativeFile ) {
					const fallback = new File(
						[ item.nativeFile ],
						item.nativeFile.name,
						{
							type: item.nativeFile.type,
							lastModified: item.nativeFile.lastModified,
						}
					);
					// Mark native file as processed to prevent loop
					fallback._beardedProcessed = true;
					up.addFile( fallback );
				}
			} catch ( e ) {
				console.error(
					'Bearded Media: Could not restore original file',
					e
				);
			}
		}

		isProcessing = false;
		processQueue( up );
	};

	const processItem = async ( item, up ) => {
		const nativeFile = item.nativeFile;

		if ( ! nativeFile ) {
			return;
		}

		// Settings
		const settings = window.beardedMediaSettings || {};
		const resizeEnabled =
			settings.resize_enabled !== '0' &&
			settings.resize_enabled !== false;

		const maxWidth = settings.max_width || 2500;
		const maxHeight = settings.max_height || 2500;

		const autoUpscale =
			settings.auto_upscale === '1' || settings.auto_upscale === true;
		const upscaleMode = settings.upscale_mode || 'contain';
		const stripMetadata =
			settings.strip_metadata === '1' || settings.strip_metadata === true;
		const autoWebP =
			settings.auto_webp === '1' || settings.auto_webp === true;

		// Determine target format
		const targetFormat = autoWebP ? 'image/webp' : null;

		// Analyze & Load Image
		let processingBlob = nativeFile;
		let dimensions = null;

		try {
			dimensions = await new Promise( ( resolve ) => {
				const img = new Image();
				const url = URL.createObjectURL( nativeFile );
				img.src = url;
				img.onload = () => {
					URL.revokeObjectURL( url );
					resolve( { w: img.width, h: img.height } );
				};
				img.onerror = () => {
					URL.revokeObjectURL( url );
					resolve( null );
				};
			} );
		} catch ( e ) {
			dimensions = null;
		}

		// If not an image or read error, just re-add original and skip
		if ( ! dimensions ) {
			const restore = new File( [ nativeFile ], nativeFile.name, {
				type: nativeFile.type,
				lastModified: nativeFile.lastModified,
			} );
			restore._beardedProcessed = true;
			up.addFile( restore );
			return;
		}

		// Auto-Upscale
		const minW = parseInt( settings.upscale_min_width || 1000 );
		const minH = parseInt( settings.upscale_min_height || 1000 );
		if ( autoUpscale && ( dimensions.w < minW || dimensions.h < minH ) ) {
			console.log(
				`Bearded Media: Auto-Upscaling ${ nativeFile.name } (${ dimensions.w }x${ dimensions.h })`
			);

			try {
				const b64 = await new Promise( ( resolve ) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve( reader.result );
					reader.readAsDataURL( nativeFile );
				} );

				const res = await fetch(
					settings.rest_url + 'bearded-media/v1/run-task',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce': wp.apiFetch.nonceMiddleware.nonce,
						},
						body: JSON.stringify( {
							task: 'stability-upscale-fast',
							image_data: b64.replace(
								/^data:image\/\w+;base64,/,
								''
							),
						} ),
					}
				).then( ( r ) => r.json() );

				if ( res.b64_json ) {
					const upscaledImg = await new Promise( ( resolve ) => {
						const img = new Image();
						img.src = `data:image/jpeg;base64,${ res.b64_json }`;
						img.onload = () => resolve( img );
					} );

					const finalCanvas = document.createElement( 'canvas' );
					const ctx = finalCanvas.getContext( '2d' );
					let newB64Data = null;

					if (
						upscaleMode === 'gen-fill' &&
						( upscaledImg.width < minW ||
							upscaledImg.height < minH )
					) {
						const targetW = Math.max( upscaledImg.width, minW );
						const targetH = Math.max( upscaledImg.height, minH );
						finalCanvas.width = targetW;
						finalCanvas.height = targetH;

						const dx = ( targetW - upscaledImg.width ) / 2;
						const dy = ( targetH - upscaledImg.height ) / 2;

						ctx.fillStyle = '#ffffff';
						ctx.fillRect( 0, 0, targetW, targetH );
						ctx.drawImage( upscaledImg, dx, dy );

						const cleanImg = finalCanvas
							.toDataURL( 'image/jpeg' )
							.replace( /^data:image\/\w+;base64,/, '' );

						const maskCanvas = document.createElement( 'canvas' );
						maskCanvas.width = targetW;
						maskCanvas.height = targetH;
						const mCtx = maskCanvas.getContext( '2d' );
						mCtx.fillStyle = 'white';
						mCtx.fillRect( 0, 0, targetW, targetH );
						mCtx.fillStyle = 'black';
						mCtx.fillRect(
							dx,
							dy,
							upscaledImg.width,
							upscaledImg.height
						);
						const cleanMask = maskCanvas
							.toDataURL( 'image/png' )
							.replace( /^data:image\/\w+;base64,/, '' );

						const fillRes = await fetch(
							settings.rest_url + 'bearded-media/v1/run-task',
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'X-WP-Nonce':
										wp.apiFetch.nonceMiddleware.nonce,
								},
								body: JSON.stringify( {
									task: 'stability-inpaint',
									image_data: cleanImg,
									mask_data: cleanMask,
									prompt: 'Seamlessly fill the background',
								} ),
							}
						).then( ( r ) => r.json() );

						if ( fillRes.task_id ) {
							console.log(
								'Bearded Media: Polling for Inpaint...'
							);
							newB64Data = await new Promise( ( resolve ) => {
								const interval = setInterval( async () => {
									try {
										const check = await fetch(
											`${ settings.rest_url }bearded-media/v1/check-task?task_id=${ fillRes.task_id }`
										).then( ( r ) => r.json() );
										if ( check.status === 'completed' ) {
											clearInterval( interval );
											resolve( check.b64_json );
										} else if (
											check.status !== 'processing'
										) {
											clearInterval( interval );
											resolve( null );
										}
									} catch ( e ) {
										clearInterval( interval );
										resolve( null );
									}
								}, 2000 );
							} );
						} else if ( fillRes.b64_json ) {
							newB64Data = fillRes.b64_json;
						}
					} else if (
						upscaleMode === 'cover' &&
						( upscaledImg.width < minW ||
							upscaledImg.height < minH )
					) {
						// COVER
						const ratioW = minW / upscaledImg.width;
						const ratioH = minH / upscaledImg.height;
						const scale = Math.max( ratioW, ratioH, 1 );
						const scaledW = upscaledImg.width * scale;
						const scaledH = upscaledImg.height * scale;
						finalCanvas.width = minW;
						finalCanvas.height = minH;
						ctx.drawImage(
							upscaledImg,
							( minW - scaledW ) / 2,
							( minH - scaledH ) / 2,
							scaledW,
							scaledH
						);
						newB64Data = finalCanvas
							.toDataURL( 'image/jpeg' )
							.replace( /^data:image\/\w+;base64,/, '' );
					} else {
						// CONTAIN
						newB64Data = res.b64_json;
					}

					if ( newB64Data ) {
						const byteCharacters = atob( newB64Data );
						const byteNumbers = new Array( byteCharacters.length );
						for ( let i = 0; i < byteCharacters.length; i++ ) {
							byteNumbers[ i ] = byteCharacters.charCodeAt( i );
						}
						processingBlob = new Blob(
							[ new Uint8Array( byteNumbers ) ],
							{ type: 'image/jpeg' }
						);
						dimensions.w = minW;
						dimensions.h = minH;
						console.log( 'Bearded Media: Upscale complete.' );
					}
				}
			} catch ( e ) {
				console.error( 'Bearded Media: Upscale failed', e );
			}
		}

		// Resize / Convert / Strip Metadata
		const needsResize =
			resizeEnabled &&
			( dimensions.w > maxWidth || dimensions.h > maxHeight );

		if ( needsResize || targetFormat || stripMetadata ) {
			const w = needsResize ? maxWidth : dimensions.w;
			const h = needsResize ? maxHeight : dimensions.h;

			try {
				// If WebP is requested, use the webpfy library
				if ( autoWebP ) {
					console.log(
						'Bearded Media: Using webpfy for client-side WebP conversion.'
					);

					const { webpBlob } = await webpfy( {
						image: processingBlob,
						quality: 85,
						maxWidth: w,
						maxHeight: h,
					} );
					if ( webpBlob ) {
						processingBlob = webpBlob;
					}
				} else {
					// Standard Resize
					const resizedBlob = await resizeImage(
						processingBlob,
						w,
						h,
						0.85,
						targetFormat
					);
					if ( resizedBlob ) {
						processingBlob = resizedBlob;
					}
				}
			} catch ( resizeErr ) {
				console.warn(
					'Bearded Media: Client-side processing failed, using current blob.',
					resizeErr
				);
			}
		}

		// Construct Final File and Add to Queue
		let newName = nativeFile.name;

		// Fix extension if converted to WebP
		if ( autoWebP && ! newName.toLowerCase().endsWith( '.webp' ) ) {
			newName =
				newName.substring( 0, newName.lastIndexOf( '.' ) ) + '.webp';
		}

		const newFile = new File( [ processingBlob ], newName, {
			type: processingBlob.type,
			lastModified: new Date().getTime(),
		} );

		// Mark native file object as processed
		newFile._beardedProcessed = true;
		up.addFile( newFile );
	};

	// Intercept when files are added
	uploaderInstance.bind( 'FilesAdded', ( up, files ) => {
		// Filter out files that are already processed
		// We must check BOTH the Plupload wrapper AND the underlying native file
		const candidates = files.filter( ( file ) => {
			// Wrapper Flag
			if ( file._beardedProcessed ) {
				return false;
			}

			// Native Flag
			const native = getNativeFile( file );

			if ( ! native ) {
				return false;
			}

			if ( native._beardedProcessed ) {
				file._beardedProcessed = true;
				return false;
			}

			return true;
		} );

		const imageCandidates = [];

		candidates.forEach( ( file ) => {
			const nativeFile = getNativeFile( file );

			// Ensure we actually have a file object with a type before proceeding
			if (
				nativeFile &&
				nativeFile.type &&
				nativeFile.type.startsWith( 'image/' )
			) {
				imageCandidates.push( {
					pluploadFile: file,
					nativeFile,
				} );
			}
		} );

		if ( imageCandidates.length > 0 ) {
			up.stop(); // Stop auto-upload immediately

			// Remove originals to prevent ghosting
			imageCandidates.forEach( ( item ) => {
				processingQueue.push( item );
				up.removeFile( item.pluploadFile );
			} );

			// Start processing queue with slight delay to let UI settle
			setTimeout( () => processQueue( up ), 50 );
		}
	} );

	uploaderInstance._beardedMediaAttached = true;
};

const setupUploaderInterceptor = () => {
	if ( typeof plupload === 'undefined' ) {
		setTimeout( setupUploaderInterceptor, 1000 );
		return;
	}

	const originalInit = plupload.Uploader.prototype.init;
	plupload.Uploader.prototype.init = function () {
		attachToUploader( this );
		return originalInit.apply( this, arguments );
	};

	if ( typeof wp !== 'undefined' && wp.Uploader && wp.Uploader.queue ) {
		wp.Uploader.queue.forEach( ( uploader ) =>
			attachToUploader( uploader )
		);
	}

	if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
		setTimeout( () => {
			if ( wp.media.frame.uploader && wp.media.frame.uploader.uploader ) {
				attachToUploader( wp.media.frame.uploader.uploader );
			}
		}, 500 );
	}

	console.log( 'Bearded Media: Uploader interceptor ready.' );
};

export default setupUploaderInterceptor;
