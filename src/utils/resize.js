/**
 * Resizes an image file to fit within maxWidth and maxHeight.
 *
 * @param {File}   file       The image file to resize.
 * @param {number} maxWidth   Maximum width.
 * @param {number} maxHeight  Maximum height.
 * @param {number} quality    JPEG/WebP quality (0-1).
 * @param {string} forcedType Optional target mime type.
 * @return {Promise<Blob|null>} A promise resolving to the resized blob or null.
 */
export const resizeImage = (
	file,
	maxWidth,
	maxHeight,
	quality,
	forcedType = null
) => {
	return new Promise( ( resolve, reject ) => {
		if ( ! file || ! file.type.match( /image.*/ ) ) {
			resolve( null );
			return;
		}

		const maxW = parseInt( maxWidth );
		const maxH = parseInt( maxHeight );

		const reader = new FileReader();
		reader.readAsDataURL( file );

		reader.onload = ( event ) => {
			const img = new Image();
			img.src = event.target.result;

			img.onload = () => {
				let width = img.width;
				let height = img.height;
				const needsResize = width > maxW || height > maxH;
				const needsConversion = forcedType && file.type !== forcedType;

				if ( ! needsResize && ! needsConversion ) {
					console.log(
						'Bearded Media: Image within limits & format matches. No processing needed.'
					);
					resolve( null );
					return;
				}

				console.log(
					`Bearded Media: Processing ${ width }x${ height }. Resize: ${ needsResize }, Convert: ${ needsConversion }`
				);

				if ( needsResize ) {
					const widthScale = maxW / width;
					const heightScale = maxH / height;
					const scale = Math.min( widthScale, heightScale );

					if ( scale < 1 ) {
						width = Math.round( width * scale );
						height = Math.round( height * scale );
					}
				}

				if ( width <= 0 || height <= 0 ) {
					resolve( null );
					return;
				}

				const canvas = document.createElement( 'canvas' );
				canvas.width = width;
				canvas.height = height;

				const ctx = canvas.getContext( '2d' );
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage( img, 0, 0, width, height );

				let outputType = file.type;

				if ( forcedType ) {
					outputType = forcedType;
				} else if (
					outputType !== 'image/png' &&
					outputType !== 'image/webp' &&
					outputType !== 'image/jpeg'
				) {
					outputType = 'image/jpeg';
				}

				canvas.toBlob(
					( blob ) => {
						if ( ! blob ) {
							reject( new Error( 'Canvas encoding failed' ) );
							return;
						}

						console.log(
							`Bearded Media: Processed complete. Old: ${ file.size }, New: ${ blob.size }, Type: ${ outputType }`
						);

						resolve( blob );
					},
					outputType,
					quality
				);
			};

			img.onerror = ( err ) => {
				console.warn(
					'Bearded Media: Image corrupted or unreadable.',
					err
				);
				resolve( null );
			};
		};

		reader.onerror = ( err ) => {
			console.warn( 'Bearded Media: FileReader error', err );
			resolve( null );
		};
	} );
};
