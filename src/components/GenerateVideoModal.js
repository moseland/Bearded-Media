import {
	Modal,
	Button,
	TextareaControl,
	SelectControl,
	RangeControl,
	Spinner,
	Card,
	CardBody,
} from '@wordpress/components';
import { useState, useRef, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

/**
 * Standalone GenerateVideoModal Component
 * @param {Object}   root0
 * @param {boolean}  root0.isOpen
 * @param {Function} root0.onClose
 * @param {Function} root0.onSuccess
 */
const GenerateVideoModal = ( { isOpen, onClose, onSuccess } ) => {
	// Dynamic API Form State Management
	const [ modelsCatalog, setModelsCatalog ] = useState( [] );
	const [ availableProviders, setAvailableProviders ] = useState( [] );
	const [ provider, setProvider ] = useState( '' );
	const [ model, setModel ] = useState( '' );
	const [ prompt, setPrompt ] = useState( '' );
	const [ seedImage, setSeedImage ] = useState( null ); // Base64 or Image URL

	// Generation Parameter Options
	const [ motionBucket, setMotionBucket ] = useState( 127 );
	const [ fps, setFps ] = useState( 24 );
	const [ aspectRatio, setAspectRatio ] = useState( '16:9' );

	// Processing and Polling States
	const [ isProcessing, setIsProcessing ] = useState( false );
	const [ status, setStatus ] = useState( '' );
	const [ generatedVideoUrl, setGeneratedVideoUrl ] = useState( null );
	const [ generatedVideoB64, setGeneratedVideoB64 ] = useState( null );

	// References for Polling & Files
	const pollingIntervalRef = useRef( null );
	const fileInputRef = useRef( null );
	const timeoutRef = useRef( null );

	// Fetch dynamic video models
	useEffect( () => {
		const fetchModels = async () => {
			try {
				const response = await apiFetch( {
					path: '/bearded-media/v1/available-models',
				} );
				const videoModels = response.filter(
					( m ) => m.capability === 'video'
				);
				setModelsCatalog( videoModels );

				const uniqueProviders = [
					...new Set( videoModels.map( ( m ) => m.provider ) ),
				];
				setAvailableProviders( uniqueProviders );

				if ( uniqueProviders.length > 0 ) {
					setProvider( uniqueProviders[ 0 ] );
					const firstModel = videoModels.find(
						( m ) => m.provider === uniqueProviders[ 0 ]
					);
					if ( firstModel ) {
						setModel( firstModel.value );
					}
				}
			} catch ( error ) {
				console.error( 'Failed to fetch video models:', error );
			}
		};
		fetchModels();
	}, [] );

	// Cleanup timers and polling intervals on unmount
	useEffect( () => {
		return () => {
			if ( pollingIntervalRef.current ) {
				clearInterval( pollingIntervalRef.current );
			}
			if ( timeoutRef.current ) {
				clearTimeout( timeoutRef.current );
			}
		};
	}, [] );

	if ( ! isOpen ) {
		return null;
	}

	/**
	 * Process a file upload (local system input)
	 * @param {Event} e
	 */
	const handleFileUpload = ( e ) => {
		if ( e.target.files && e.target.files[ 0 ] ) {
			const file = e.target.files[ 0 ];
			const reader = new FileReader();
			reader.onload = ( ev ) => {
				setSeedImage( ev.target.result );
			};
			reader.readAsDataURL( file );
		}
	};

	/**
	 * Open WordPress Native Media Library Picker
	 */
	const openWordPressMediaLibrary = () => {
		if ( typeof wp === 'undefined' || ! wp.media ) {
			// Fall back to local file upload if library picker is blocked
			fileInputRef.current?.click();
			return;
		}

		const customUploader = wp.media( {
			title: 'Select Reference Seed Frame',
			button: { text: 'Use this Image' },
			multiple: false,
			library: { type: 'image' },
		} );

		customUploader.on( 'select', () => {
			const attachment = customUploader
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			if ( attachment && attachment.url ) {
				setSeedImage( attachment.url );
			}
		} );

		customUploader.open();
	};

	/**
	 * Polls the REST check-task endpoint for asynchronous generation
	 * @param {string} taskId
	 */
	const startPolling = ( taskId ) => {
		let attempts = 0;
		const maxAttempts = 100; // Cap polling to roughly 5 minutes

		// Set safety backup timeout in case polling locks up
		timeoutRef.current = setTimeout( () => {
			clearInterval( pollingIntervalRef.current );
			setStatus( 'Error: Connection timed out after 5 minutes.' );
			setIsProcessing( false );
		}, 300000 );

		pollingIntervalRef.current = setInterval( async () => {
			attempts++;
			if ( attempts >= maxAttempts ) {
				clearInterval( pollingIntervalRef.current );
				setStatus( 'Error: Maximum polling duration exceeded.' );
				setIsProcessing( false );
				return;
			}

			try {
				const res = await apiFetch( {
					path: `/bearded-media/v1/check-task?task_id=${ taskId }`,
				} );

				if ( res.status === 'completed' ) {
					clearInterval( pollingIntervalRef.current );
					clearTimeout( timeoutRef.current );

					if ( res.b64_json ) {
						const mime = res.mime_type || 'video/mp4';
						const formattedUrl = `data:${ mime };base64,${ res.b64_json }`;
						setGeneratedVideoUrl( formattedUrl );
						setGeneratedVideoB64( res.b64_json );
					} else if ( res.url ) {
						setGeneratedVideoUrl( res.url );
					} else {
						throw new Error(
							'No valid video data returned from generation task'
						);
					}

					setStatus( '' );
					setIsProcessing( false );
				} else if (
					res.status === 'failed' ||
					res.status === 'error'
				) {
					clearInterval( pollingIntervalRef.current );
					clearTimeout( timeoutRef.current );
					setStatus(
						'Generation Failed: Provider reported an error.'
					);
					setIsProcessing( false );
				}
			} catch ( err ) {
				clearInterval( pollingIntervalRef.current );
				clearTimeout( timeoutRef.current );
				setStatus(
					`Error checking task status: ${ err.message || 'Unknown' }`
				);
				setIsProcessing( false );
			}
		}, 3000 );
	};

	/**
	 * Dispatches the Video Generation Task
	 */
	const handleGenerate = async () => {
		setIsProcessing( true );
		setStatus( 'Queuing generation request...' );
		setGeneratedVideoUrl( null );
		setGeneratedVideoB64( null );

		try {
			const cleanSeedImage =
				seedImage && seedImage.startsWith( 'data:image/' )
					? seedImage.replace( /^data:image\/\w+;base64,/, '' )
					: seedImage;

			const payload = {
				task: 'generate-video',
				provider,
				model,
				prompt,
				image_data: cleanSeedImage,
				motion_bucket_id: motionBucket,
				fps: parseInt( fps, 10 ),
				aspect_ratio: aspectRatio,
			};

			const response = await apiFetch( {
				path: '/bearded-media/v1/run-task',
				method: 'POST',
				data: payload,
			} );

			if ( response.task_id && response.status === 'processing' ) {
				setStatus(
					'Generating Video (running asynchronous pipeline)...'
				);
				startPolling( response.task_id );
			} else if ( response.b64_json ) {
				const mime = response.mime_type || 'video/mp4';
				setGeneratedVideoUrl(
					`data:${ mime };base64,${ response.b64_json }`
				);
				setGeneratedVideoB64( response.b64_json );
				setStatus( '' );
				setIsProcessing( false );
			} else if ( response.url ) {
				setGeneratedVideoUrl( response.url );
				setStatus( '' );
				setIsProcessing( false );
			} else {
				throw new Error(
					'Response was empty or failed to initiate generation task.'
				);
			}
		} catch ( error ) {
			setStatus(
				`Error: ${ error.message || 'API submission failed.' }`
			);
			setIsProcessing( false );
		}
	};

	/**
	 * Ingests and saves the active video back to the WordPress Media Library
	 */
	const handleSaveToMediaLibrary = async () => {
		setIsProcessing( true );
		setStatus( 'Saving video to WordPress Media Library...' );

		try {
			const payload = {
				save_mode: 'new',
			};

			if ( generatedVideoB64 ) {
				payload.image_data = generatedVideoB64;
			} else if ( generatedVideoUrl ) {
				payload.image_url = generatedVideoUrl;
			} else {
				throw new Error( 'No active video asset ready to save.' );
			}

			const response = await apiFetch( {
				path: '/bearded-media/v1/save-image',
				method: 'POST',
				data: payload,
			} );

			if ( response.id ) {
				if ( onSuccess ) {
					onSuccess( {
						id: response.id,
						url: response.url,
						type: 'video',
						title: prompt || 'Bearded AI Generated Video',
					} );
				}
				onClose();
			} else {
				throw new Error(
					'Invalid response received from save controller.'
				);
			}
		} catch ( err ) {
			setStatus(
				`Save Failed: ${ err.message || 'Internal Write Error' }`
			);
			setIsProcessing( false );
		}
	};

	return (
		<Modal
			title="Generate AI Video"
			onRequestClose={ onClose }
			style={ { maxWidth: '950px', width: '90vw' } }
		>
			<div
				className="bearded-video-modal-workspace"
				style={ {
					display: 'flex',
					flexDirection: 'row',
					flexWrap: 'wrap',
					gap: '24px',
					padding: '8px 0',
				} }
			>
				{ /* Left Column: Interactive HTML5 Responsive Preview Panel */ }
				<div
					className="bearded-video-preview-column"
					style={ {
						flex: '1 1 450px',
						background: '#1e1e1e',
						borderRadius: '6px',
						minHeight: '400px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						position: 'relative',
						overflow: 'hidden',
						border: '1px solid #2c3338',
						boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
					} }
				>
					{ generatedVideoUrl ? (
						<div
							style={ {
								width: '100%',
								height: '100%',
								padding: '12px',
							} }
						>
							<video
								controls
								autoPlay
								loop
								src={ generatedVideoUrl }
								style={ {
									width: '100%',
									height: 'auto',
									maxHeight: '380px',
									borderRadius: '4px',
									objectFit: 'contain',
									backgroundColor: '#000',
								} }
							/>
						</div>
					) : (
						<div
							style={ {
								textAlign: 'center',
								color: '#a7aaad',
								padding: '24px',
							} }
						>
							{ isProcessing ? (
								<div
									style={ {
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: '16px',
									} }
								>
									<Spinner
										style={ {
											transform: 'scale(1.4)',
											color: '#2271b1',
										} }
									/>
									<div
										style={ {
											fontSize: '13px',
											fontWeight: '500',
											color: '#e0e0e0',
										} }
									>
										{ status }
									</div>
								</div>
							) : (
								<div>
									<svg
										width="64"
										height="64"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										style={ {
											marginBottom: '16px',
											opacity: 0.65,
										} }
									>
										<rect
											x="2"
											y="3"
											width="20"
											height="14"
											rx="2"
											ry="2"
										/>
										<path d="M8 21h8" />
										<path d="M12 17v4" />
										<polygon points="10 8 15 11 10 14 10 8" />
									</svg>
									<p
										style={ {
											margin: 0,
											fontSize: '14px',
											fontWeight: '500',
										} }
									>
										AI Video Output Preview
									</p>
									<p
										style={ {
											fontSize: '12px',
											color: '#787c82',
											marginTop: '4px',
										} }
									>
										Configure parameters and trigger
										generation to render.
									</p>
								</div>
							) }
						</div>
					) }
				</div>

				{ /* Right Column: Parameters and Configuration Panel */ }
				<div
					className="bearded-video-controls-column"
					style={ {
						width: '340px',
						flex: '0 0 340px',
						display: 'flex',
						flexDirection: 'column',
						gap: '16px',
					} }
				>
					<Card
						style={ {
							border: '1px solid #ccc',
							borderRadius: '4px',
							boxShadow: 'none',
						} }
					>
						<CardBody style={ { padding: '16px' } }>
							{ /* Provider Engine */ }
							<SelectControl
								label="Video Provider"
								value={ provider }
								options={ availableProviders.map( ( p ) => ( {
									label: p,
									value: p,
								} ) ) }
								onChange={ ( newProvider ) => {
									setProvider( newProvider );
									const firstModel = modelsCatalog.find(
										( m ) => m.provider === newProvider
									);
									if ( firstModel ) {
										setModel( firstModel.value );
									}
								} }
							/>

							{ /* Model Selection populated dynamically */ }
							<SelectControl
								label="AI Video Model"
								value={ model }
								options={ modelsCatalog
									.filter( ( m ) => m.provider === provider )
									.map( ( m ) => ( {
										label: m.label,
										value: m.value,
									} ) ) }
								onChange={ setModel }
							/>

							{ /* Aspect Ratio Selection */ }
							<SelectControl
								label="Aspect Ratio"
								value={ aspectRatio }
								options={ [
									{ label: 'Standard (16:9)', value: '16:9' },
									{ label: 'Vertical (9:16)', value: '9:16' },
									{ label: 'Square (1:1)', value: '1:1' },
								] }
								onChange={ setAspectRatio }
							/>

							{ /* Frame Rate Config */ }
							<SelectControl
								label="Frame Rate"
								value={ fps }
								options={ [
									{ label: '24 FPS (Cinematic)', value: 24 },
									{ label: '30 FPS (Standard)', value: 30 },
								] }
								onChange={ setFps }
							/>

							{ /* Motion Bucket Configuration (Visible only if supported/extensible model configured) */ }
							{ model.includes( 'kling' ) ||
							model.includes( 'seedance' ) ? (
								<RangeControl
									label="Motion Scale / Speed"
									value={ motionBucket }
									onChange={ setMotionBucket }
									min={ 1 }
									max={ 255 }
								/>
							) : null }
						</CardBody>
					</Card>

					{ /* Drag-and-Drop Image Seed Frame Upload or Media Picker Area */ }
					<Card
						style={ {
							border: '1px solid #ccc',
							borderRadius: '4px',
							boxShadow: 'none',
						} }
					>
						<CardBody
							style={ { padding: '16px', position: 'relative' } }
						>
							<span
								style={ {
									fontSize: '12px',
									fontWeight: 'bold',
									display: 'block',
									marginBottom: '8px',
								} }
							>
								Seed Reference Frame (Optional)
							</span>

							{ seedImage ? (
								<div
									style={ {
										position: 'relative',
										borderRadius: '4px',
										overflow: 'hidden',
										height: '110px',
									} }
								>
									<img
										src={ seedImage }
										alt="Seed Reference Thumbnail"
										style={ {
											width: '100%',
											height: '100%',
											objectFit: 'cover',
										} }
									/>
									<button
										onClick={ () => setSeedImage( null ) }
										style={ {
											position: 'absolute',
											top: '8px',
											right: '8px',
											background:
												'rgba(214, 54, 56, 0.95)',
											color: '#ffffff',
											border: 'none',
											borderRadius: '50%',
											width: '24px',
											height: '24px',
											cursor: 'pointer',
											fontWeight: 'bold',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											boxShadow:
												'0 2px 4px rgba(0,0,0,0.25)',
										} }
										title="Clear Image"
									>
										×
									</button>
								</div>
							) : (
								<div
									onClick={ openWordPressMediaLibrary }
									onKeyDown={ ( e ) =>
										e.key === 'Enter' &&
										openWordPressMediaLibrary()
									}
									role="button"
									tabIndex={ 0 }
									style={ {
										border: '2px dashed #ccd0d4',
										borderRadius: '4px',
										padding: '20px 10px',
										textAlign: 'center',
										cursor: 'pointer',
										background: '#f6f7f7',
									} }
								>
									<p
										style={ {
											margin: '0 0 6px 0',
											fontSize: '12px',
											color: '#1d2327',
											fontWeight: '500',
										} }
									>
										Click to Choose Seed Image
									</p>
									<span
										style={ {
											fontSize: '11px',
											color: '#50575e',
										} }
									>
										Accepts WordPress Library or Uploads
									</span>
								</div>
							) }

							{ /* Hidden manual file upload element */ }
							<input
								type="file"
								accept="image/*"
								ref={ fileInputRef }
								style={ { display: 'none' } }
								onChange={ handleFileUpload }
							/>
						</CardBody>
					</Card>

					{ /* Prompt Input Panel */ }
					<TextareaControl
						label="Describe the Motion (Prompt)"
						value={ prompt }
						onChange={ setPrompt }
						rows={ 4 }
						placeholder="E.g. Camera pans down slowly to reveal a futuristic neon city under light drizzle, cinematic lighting, photorealistic..."
					/>

					{ /* Action Control Bar */ }
					<div
						className="bearded-video-action-bar"
						style={ {
							marginTop: 'auto',
							display: 'flex',
							gap: '12px',
							borderTop: '1px solid #dcdcde',
							paddingTop: '16px',
						} }
					>
						<Button
							variant="secondary"
							onClick={ onClose }
							disabled={ isProcessing }
							style={ { flex: 1, justifyContent: 'center' } }
						>
							Cancel
						</Button>

						<Button
							variant="primary"
							onClick={ handleGenerate }
							isBusy={ isProcessing }
							disabled={ ! prompt || isProcessing }
							style={ { flex: 1, justifyContent: 'center' } }
						>
							Generate
						</Button>

						{ generatedVideoUrl && (
							<Button
								variant="primary"
								onClick={ handleSaveToMediaLibrary }
								isBusy={ isProcessing }
								style={ {
									flex: '1.2 1 auto',
									justifyContent: 'center',
									background: '#46b450',
									borderColor: '#349a3c',
									color: '#fff',
								} }
							>
								Use Video
							</Button>
						) }
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default GenerateVideoModal;
