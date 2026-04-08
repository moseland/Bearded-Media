import {
	Modal,
	Button,
	TextareaControl,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { useState, useRef, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const MODELS = [
	{ label: 'Gemini: Nano Banana', value: 'gemini-2.5-flash-image' },
	{ label: 'Gemini: Nano Banana Pro', value: 'gemini-3-pro-image-preview' },
	{ label: 'Stability: SDXL 1.0', value: 'stability-sdxl-1.0' },
	{ label: 'Stability: Core', value: 'stability-core' },
	{ label: 'Stability: SD 3.5 Flash', value: 'stability-sd3.5-flash' },
	{ label: 'Stability: SD 3.5 Medium', value: 'stability-sd3.5-medium' },
	{ label: 'Stability: SD 3.5 Large', value: 'stability-sd3.5-large' },
	{
		label: 'Stability: SD 3.5 Large Turbo',
		value: 'stability-sd3.5-large-turbo',
	},
	{ label: 'Stability: Ultra', value: 'stability-ultra' },
	{ label: 'FLUX.1 Kontext [max]', value: 'flux-kontext-max' },
	{ label: 'FLUX.1 Kontext [pro]', value: 'flux-kontext-pro' },
	{ label: 'FLUX 1.1 [pro] Ultra', value: 'flux-pro-1.1-ultra' },
	{ label: 'FLUX 1.1 [pro]', value: 'flux-pro-1.1' },
	{ label: 'FLUX 1 [pro]', value: 'flux-pro' },
	{ label: 'FLUX.1 [dev]', value: 'flux-dev' },
];

const DrawingCanvas = ( { onUpdate, triggerClear } ) => {
	const canvasRef = useRef( null );
	const [ isDrawing, setIsDrawing ] = useState( false );

	useEffect( () => {
		const canvas = canvasRef.current;
		if ( ! canvas ) {
			return;
		}
		const ctx = canvas.getContext( '2d' );
		ctx.fillStyle = 'white';
		ctx.fillRect( 0, 0, canvas.width, canvas.height );

		if ( triggerClear > 0 ) {
			ctx.fillStyle = 'white';
			ctx.fillRect( 0, 0, canvas.width, canvas.height );
			onUpdate( null );
		}
	}, [ triggerClear, onUpdate ] );

	const startDraw = ( e ) => {
		setIsDrawing( true );
		draw( e );
	};
	const stopDraw = () => {
		if ( isDrawing ) {
			setIsDrawing( false );
			const canvas = canvasRef.current;
			onUpdate( canvas.toDataURL( 'image/jpeg' ) );
		}
	};
	const draw = ( e ) => {
		if ( ! isDrawing ) {
			return;
		}
		const canvas = canvasRef.current;
		const ctx = canvas.getContext( '2d' );
		const rect = canvas.getBoundingClientRect();
		const x = ( e.clientX - rect.left ) * ( canvas.width / rect.width );
		const y = ( e.clientY - rect.top ) * ( canvas.height / rect.height );

		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.strokeStyle = 'black';

		ctx.lineTo( x, y );
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo( x, y );
	};

	return (
		<canvas
			ref={ canvasRef }
			width={ 512 }
			height={ 512 }
			style={ {
				width: '100%',
				height: '300px',
				border: '1px solid #ccc',
				cursor: 'crosshair',
			} }
			onMouseDown={ ( e ) => {
				const canvas = canvasRef.current;
				const ctx = canvas.getContext( '2d' );
				ctx.beginPath();
				startDraw( e );
			} }
			onMouseUp={ stopDraw }
			onMouseMove={ draw }
			onMouseLeave={ stopDraw }
		/>
	);
};

const GenerateImageModal = ( {
	isOpen,
	onClose,
	setAttributes,
	onSuccess,
} ) => {
	const [ activeTab, setActiveTab ] = useState( 'text' ); // text, structure, sketch
	const [ prompt, setPrompt ] = useState( '' );
	const [ model, setModel ] = useState( MODELS[ 0 ].value );
	const [ isProcessing, setIsProcessing ] = useState( false );
	const [ status, setStatus ] = useState( '' );
	const [ generatedImage, setGeneratedImage ] = useState( null );
	const [ controlImage, setControlImage ] = useState( null );
	const [ clearCanvasTrigger, setClearCanvasTrigger ] = useState( 0 );

	const fileInputRef = useRef( null );

	if ( ! isOpen ) {
		return null;
	}

	const handleFileUpload = ( e ) => {
		if ( e.target.files && e.target.files[ 0 ] ) {
			const reader = new FileReader();
			reader.onload = ( ev ) => setControlImage( ev.target.result );
			reader.readAsDataURL( e.target.files[ 0 ] );
		}
	};

	const pollTask = ( taskId ) => {
		const interval = setInterval( async () => {
			try {
				const res = await apiFetch( {
					path: `/bearded-media/v1/check-task?task_id=${ taskId }`,
				} );
				if ( res.status === 'completed' && res.b64_json ) {
					clearInterval( interval );
					setGeneratedImage(
						`data:image/jpeg;base64,${ res.b64_json }`
					);
					setStatus( '' );
					setIsProcessing( false );
				} else if ( res.status !== 'processing' ) {
					clearInterval( interval );
					setStatus( 'Generation Failed' );
					setIsProcessing( false );
				}
			} catch ( e ) {
				clearInterval( interval );
				setStatus( 'Error checking task: ' + e.message );
				setIsProcessing( false );
			}
		}, 2000 );
	};

	const handleGenerate = async () => {
		setIsProcessing( true );
		setStatus( 'Queuing...' );
		try {
			const payload = { task: 'generate', prompt, model };

			if ( activeTab === 'structure' ) {
				if ( ! controlImage ) {
					throw new Error( 'Please upload a structure image' );
				}
				payload.task = 'stability-structure';
				payload.image_data = controlImage.replace(
					/^data:image\/\w+;base64,/,
					''
				);
			} else if ( activeTab === 'sketch' ) {
				if ( ! controlImage ) {
					throw new Error( 'Please draw a sketch' );
				}
				payload.task = 'stability-sketch';
				payload.image_data = controlImage.replace(
					/^data:image\/\w+;base64,/,
					''
				);
			}

			const response = await apiFetch( {
				path: '/bearded-media/v1/run-task',
				method: 'POST',
				data: payload,
			} );

			if ( response.task_id && response.status === 'processing' ) {
				setStatus( 'Generating...' );
				pollTask( response.task_id );
			} else if ( response.b64_json ) {
				setGeneratedImage(
					`data:image/jpeg;base64,${ response.b64_json }`
				);
				setStatus( '' );
				setIsProcessing( false );
			}
		} catch ( error ) {
			setStatus( 'Error: ' + error.message );
			setIsProcessing( false );
		}
	};

	const handleSave = async () => {
		setIsProcessing( true );
		setStatus( 'Saving...' );
		try {
			const response = await apiFetch( {
				path: '/bearded-media/v1/save-image',
				method: 'POST',
				data: {
					image_data: generatedImage.replace(
						/^data:image\/\w+;base64,/,
						''
					),
				},
			} );

			if ( response.id ) {
				if ( setAttributes ) {
					setAttributes( {
						id: response.id,
						url: response.url,
						alt: prompt,
					} );
				}
				if ( onSuccess ) {
					onSuccess( response );
				}
				onClose();
			}
		} catch ( error ) {
			setStatus( 'Save failed: ' + error.message );
		} finally {
			setIsProcessing( false );
		}
	};

	return (
		<Modal
			title="Generate New Image"
			onRequestClose={ onClose }
			style={ { maxWidth: '900px' } }
		>
			<div style={ { display: 'flex', gap: '20px', padding: '20px' } }>
				{ /* Left Column: Preview */ }
				<div
					style={ {
						flex: 1,
						background: '#eee',
						borderRadius: '4px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						overflow: 'hidden',
						position: 'relative',
						minWidth: '300px',
					} }
				>
					{ generatedImage ? (
						<img
							src={ generatedImage }
							alt="Generated AI Preview"
							style={ {
								maxWidth: '100%',
								maxHeight: '100%',
								objectFit: 'contain',
							} }
						/>
					) : (
						<div style={ { textAlign: 'center', color: '#777' } }>
							{ isProcessing ? (
								<>
									<Spinner />{ ' ' }
									<div style={ { marginTop: 10 } }>
										{ status }
									</div>
								</>
							) : (
								'Preview Area'
							) }
						</div>
					) }
				</div>

				{ /* Right Column: Controls */ }
				<div
					style={ {
						width: '320px',
						display: 'flex',
						flexDirection: 'column',
						overflowY: 'auto',
					} }
				>
					<div style={ { marginBottom: '15px' } }>
						<div
							style={ {
								display: 'flex',
								gap: '5px',
								marginBottom: '15px',
							} }
						>
							<Button
								variant={
									activeTab === 'text'
										? 'primary'
										: 'secondary'
								}
								onClick={ () => setActiveTab( 'text' ) }
								style={ { flex: 1, justifyContent: 'center' } }
							>
								Text
							</Button>
							<Button
								variant={
									activeTab === 'structure'
										? 'primary'
										: 'secondary'
								}
								onClick={ () => setActiveTab( 'structure' ) }
								style={ { flex: 1, justifyContent: 'center' } }
							>
								Structure
							</Button>
							<Button
								variant={
									activeTab === 'sketch'
										? 'primary'
										: 'secondary'
								}
								onClick={ () => setActiveTab( 'sketch' ) }
								style={ { flex: 1, justifyContent: 'center' } }
							>
								Sketch
							</Button>
						</div>

						{ activeTab === 'text' && (
							<SelectControl
								label="Model"
								value={ model }
								options={ MODELS }
								onChange={ setModel }
							/>
						) }

						{ activeTab === 'structure' && (
							<div
								style={ {
									marginBottom: '15px',
									padding: '10px',
									background: '#f9f9f9',
									border: '1px solid #ddd',
									borderRadius: '4px',
								} }
							>
								<label
									htmlFor="structure-upload"
									style={ {
										display: 'block',
										marginBottom: '5px',
										fontSize: '12px',
										fontWeight: 'bold',
									} }
								>
									Structure Reference
								</label>
								<input
									id="structure-upload"
									type="file"
									accept="image/*"
									ref={ fileInputRef }
									style={ { display: 'none' } }
									onChange={ handleFileUpload }
								/>
								<Button
									isSmall
									variant="secondary"
									onClick={ () =>
										fileInputRef.current.click()
									}
									style={ {
										width: '100%',
										justifyContent: 'center',
									} }
								>
									Upload Image
								</Button>
								{ controlImage && (
									<img
										src={ controlImage }
										alt="Structure Reference Thumbnail"
										style={ {
											marginTop: '5px',
											width: '100%',
											height: '80px',
											objectFit: 'cover',
											borderRadius: '4px',
										} }
									/>
								) }
							</div>
						) }

						{ activeTab === 'sketch' && (
							<div style={ { marginBottom: '15px' } }>
								<div
									style={ {
										display: 'flex',
										justifyContent: 'space-between',
										marginBottom: '5px',
									} }
								>
									<strong style={ { fontSize: '12px' } }>
										Draw Sketch
									</strong>
									<Button
										isSmall
										variant="link"
										onClick={ () =>
											setClearCanvasTrigger(
												( prev ) => prev + 1
											)
										}
										style={ { color: '#d63638' } }
									>
										Clear
									</Button>
								</div>
								<DrawingCanvas
									onUpdate={ setControlImage }
									triggerClear={ clearCanvasTrigger }
								/>
							</div>
						) }

						<TextareaControl
							label="Prompt"
							value={ prompt }
							onChange={ setPrompt }
							rows={ 4 }
							placeholder="Describe the image..."
						/>
					</div>

					<div
						style={ {
							marginTop: 'auto',
							display: 'flex',
							gap: '10px',
						} }
					>
						<Button
							variant="primary"
							onClick={ handleGenerate }
							isBusy={ isProcessing }
							disabled={ ! prompt || isProcessing }
							style={ { flex: 1, justifyContent: 'center' } }
						>
							Generate
						</Button>
						{ generatedImage && (
							<Button
								variant="secondary"
								onClick={ handleSave }
								isBusy={ isProcessing }
								style={ { flex: 1, justifyContent: 'center' } }
							>
								Use Image
							</Button>
						) }
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default GenerateImageModal;
