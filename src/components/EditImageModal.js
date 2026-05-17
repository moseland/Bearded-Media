import { Spinner } from '@wordpress/components';
import { useState, useEffect, useRef, createPortal } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import CanvasWorkspace from './Editor/CanvasWorkspace';
import EditorToolbar, { InspectorPanel } from './Editor/EditorToolbar';

/**
 * Valid AI Tasks for the editor.
 */
const AI_TASKS = [
	{ label: 'Magic Eraser', value: 'stability-erase' },
	{ label: 'Generative Fill (Inpaint)', value: 'stability-inpaint' },
	{ label: 'Remove Background', value: 'stability-remove-bg' },
	{ label: 'Replace Background', value: 'stability-replace-bg-relight' },
	{ label: 'Gemini: Nano Banana (Edit)', value: 'gemini-nano-banana' },
	{
		label: 'Gemini: Nano Banana Pro (Edit)',
		value: 'gemini-nano-banana-pro',
	},
	{ label: 'Upscale (Fast 4K)', value: 'stability-upscale-fast' },
	{
		label: 'Upscale (Conservative)',
		value: 'stability-upscale-conservative',
	},
	{ label: 'Upscale (Creative)', value: 'stability-upscale-creative' },
	{ label: 'Search & Replace', value: 'stability-search-replace' },
	{ label: 'Search & Recolor', value: 'stability-search-recolor' },
	{ label: 'Style Transfer', value: 'stability-style-transfer' },
];

/**
 * Modal component for editing images using AI and standard tools.
 *
 * @param {Object}   props                 Component props.
 * @param {boolean}  props.isOpen          Whether the modal is open.
 * @param {Function} props.onClose         Function to close the modal.
 * @param {Object}   props.imageAttributes Current image attributes.
 * @param {Function} props.setAttributes   Function to update attributes.
 */
const EditImageModal = ( {
	isOpen,
	onClose,
	imageAttributes,
	setAttributes,
} ) => {
	// State
	const [ currentImageSrc, setCurrentImageSrc ] = useState(
		imageAttributes.url
	);
	const [ activeTool, setActiveTool ] = useState( 'move' );
	const [ isAiMasking, setIsAiMasking ] = useState( false );
	const [ maskData, setMaskData ] = useState( null );
	const [ cropData, setCropData ] = useState( null );

	// Editor State
	const [ brushSize, setBrushSize ] = useState( 30 );
	const [ brushColor, setBrushColor ] = useState( '#ef4444' );
	const [ resizeW, setResizeW ] = useState( 0 );
	const [ resizeH, setResizeH ] = useState( 0 );

	// Adjustments
	const [ brightness, setBrightness ] = useState( 100 );
	const [ contrast, setContrast ] = useState( 100 );
	const [ saturation, setSaturation ] = useState( 100 );

	// Branding / Overlays
	const [ activeOverlay, setActiveOverlay ] = useState( null );

	// History
	const [ history, setHistory ] = useState( [] );
	const [ historyStep, setHistoryStep ] = useState( -1 );

	// AI Logic
	const [ aiMode, setAiMode ] = useState( 'stability-erase' );
	const [ aiPrompt, setAiPrompt ] = useState( '' );
	const [ aiSelectPrompt, setAiSelectPrompt ] = useState( '' );
	const [ styleImage, setStyleImage ] = useState( null ); // For Style Transfer
	const [ isProcessing, setIsProcessing ] = useState( false );
	const [ statusMessage, setStatusMessage ] = useState( '' );

	// Zoom Helpers
	const [ zoom, setZoom ] = useState( 1 );
	const [ pan, setPan ] = useState( { x: 0, y: 0 } );

	// Refs
	const canvasRef = useRef( null );

	// Initialization
	useEffect( () => {
		if ( isOpen && imageAttributes.url ) {
			const initialUrl = imageAttributes.url;
			setCurrentImageSrc( initialUrl );
			setHistory( [ initialUrl ] );
			setHistoryStep( 0 );
			setMaskData( null );
			setCropData( null );
			setActiveOverlay( null );
			setBrushColor( '#ef4444' );
			setActiveTool( 'move' );
			setStatusMessage( '' );
			setBrightness( 100 );
			setContrast( 100 );
			setSaturation( 100 );
			setStyleImage( null );

			const img = new Image();
			img.src = initialUrl;
			img.onload = () => {
				setResizeW( img.width );
				setResizeH( img.height );
			};

			// Fetch HD
			if ( imageAttributes.id && imageAttributes.id > 0 ) {
				apiFetch( {
					path: `/wp/v2/media/${ imageAttributes.id }`,
				} ).then( ( media ) => {
					let fullSrc = media?.source_url;

					if ( fullSrc ) {
						const urlParts = initialUrl.split( '?' );
						if ( urlParts.length > 1 ) {
							const query = urlParts[ 1 ];
							if ( ! fullSrc.includes( '?' ) ) {
								fullSrc += '?' + query;
							} else {
								fullSrc += '&' + query;
							}
						}

						if ( fullSrc !== initialUrl ) {
							const imgHD = new Image();
							imgHD.src = fullSrc;
							imgHD.onload = () => {
								setCurrentImageSrc( fullSrc );
								setHistory( [ fullSrc ] );
								setHistoryStep( 0 );
								setResizeW( imgHD.width );
								setResizeH( imgHD.height );
							};
						}
					}
				} );
			}
		}
	}, [ isOpen, imageAttributes.url, imageAttributes.id ] );

	if ( ! isOpen ) {
		return null;
	}

	// Actions
	const handleApplyResize = ( method = 'scale', smartCropValue = false ) => {
		const w = parseInt( resizeW );
		const h = parseInt( resizeH );
		if ( ! w || ! h ) {
			return;
		}

		if ( method === 'generative-fill' ) {
			setIsProcessing( true );
			setStatusMessage( 'Preparing Canvas...' );
			const currentImgData = getBakedImage();

			const img = new Image();
			img.crossOrigin = 'Anonymous';
			img.src = currentImgData;
			img.onload = async () => {
				const currentW = img.width;
				const currentH = img.height;
				const deltaW = w - currentW;
				const deltaH = h - currentH;
				if ( deltaW < 0 || deltaH < 0 ) {
					alert(
						'Generative Fill requires target dimensions to be larger than original.'
					);
					setIsProcessing( false );
					return;
				}
				const left = Math.floor( deltaW / 2 );
				const top = Math.floor( deltaH / 2 );

				const canvas = document.createElement( 'canvas' );
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext( '2d' );
				ctx.fillStyle = 'white';
				ctx.fillRect( 0, 0, w, h );
				ctx.drawImage( img, left, top );

				const maskCanvas = document.createElement( 'canvas' );
				maskCanvas.width = w;
				maskCanvas.height = h;
				const mCtx = maskCanvas.getContext( '2d' );
				mCtx.fillStyle = 'white';
				mCtx.fillRect( 0, 0, w, h );
				mCtx.fillStyle = 'black';
				mCtx.fillRect( left, top, currentW, currentH );

				const imageB64 = canvas
					.toDataURL( 'image/jpeg' )
					.replace( /^data:image\/\w+;base64,/, '' );
				const maskB64 = maskCanvas
					.toDataURL( 'image/png' )
					.replace( /^data:image\/\w+;base64,/, '' );

				try {
					setStatusMessage( 'Generating Fill...' );
					const response = await apiFetch( {
						path: '/bearded-media/v1/run-task',
						method: 'POST',
						data: {
							task: 'stability-inpaint',
							image_data: imageB64,
							mask_data: maskB64,
							prompt: 'Seamless background extrapolation',
						},
					} );

					if ( response.b64_json ) {
						pushToHistory(
							`data:image/jpeg;base64,${ response.b64_json }`
						);
					} else if ( response.task_id ) {
						pollTask( response.task_id );
					}
				} catch ( err ) {
					alert( err.message );
					setIsProcessing( false );
				}
			};
		} else {
			// standard scale
			const currentImgData = getBakedImage();
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement( 'canvas' );
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext( '2d' );

				if ( smartCropValue ) {
					const s = Math.max( w / img.width, h / img.height );
					const sw = img.width * s;
					const sh = img.height * s;
					ctx.drawImage(
						img,
						( w - sw ) / 2,
						( h - sh ) / 2,
						sw,
						sh
					);
				} else {
					ctx.drawImage( img, 0, 0, w, h );
				}
				pushToHistory( canvas.toDataURL( 'image/jpeg' ) );
			};
			img.src = currentImgData;
		}
	};

	const pushToHistory = ( newSrc ) => {
		const newHistorySize = historyStep + 1;
		const newHistory = history.slice( 0, newHistorySize );
		newHistory.push( newSrc );
		setHistory( newHistory );
		setHistoryStep( newHistory.length - 1 );
		setCurrentImageSrc( newSrc );
	};

	const handleUndo = () => {
		if ( historyStep > 0 ) {
			const newStep = historyStep - 1;
			setHistoryStep( newStep );
			setCurrentImageSrc( history[ newStep ] );
		}
	};

	const handleRedo = () => {
		if ( historyStep < history.length - 1 ) {
			const newStep = historyStep + 1;
			setHistoryStep( newStep );
			setCurrentImageSrc( history[ newStep ] );
		}
	};

	const handleRotate = () => {
		const currentImgData = getBakedImage();
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = img.height;
			canvas.height = img.width;
			const ctx = canvas.getContext( '2d' );
			ctx.translate( canvas.width / 2, canvas.height / 2 );
			ctx.rotate( ( 90 * Math.PI ) / 180 );
			ctx.drawImage( img, -img.width / 2, -img.height / 2 );
			pushToHistory( canvas.toDataURL( 'image/jpeg' ) );
		};
		img.src = currentImgData;
	};

	const handleFlip = ( axis ) => {
		const currentImgData = getBakedImage();
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext( '2d' );
			if ( axis === 'horizontal' ) {
				ctx.translate( img.width, 0 );
				ctx.scale( -1, 1 );
			} else {
				ctx.translate( 0, img.height );
				ctx.scale( 1, -1 );
			}
			ctx.drawImage( img, 0, 0 );
			pushToHistory( canvas.toDataURL( 'image/jpeg' ) );
		};
		img.src = currentImgData;
	};

	const handleApplyCrop = () => {
		if ( ! cropData ) {
			return;
		}
		const currentImgData = getBakedImage();
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = cropData.w;
			canvas.height = cropData.h;
			const ctx = canvas.getContext( '2d' );
			ctx.drawImage(
				img,
				cropData.x,
				cropData.y,
				cropData.w,
				cropData.h,
				0,
				0,
				cropData.w,
				cropData.h
			);
			pushToHistory( canvas.toDataURL( 'image/jpeg' ) );
			setCropData( null );
			setActiveTool( 'move' );
		};
		img.src = currentImgData;
	};

	const pollTask = ( taskId ) => {
		const interval = setInterval( async () => {
			try {
				const res = await apiFetch( {
					path: `/bearded-media/v1/check-task?task_id=${ taskId }`,
				} );
				if ( res.status === 'completed' && res.b64_json ) {
					clearInterval( interval );
					pushToHistory( `data:image/jpeg;base64,${ res.b64_json }` );
					setIsProcessing( false );
					setStatusMessage( '' );
				} else if ( res.status !== 'processing' ) {
					clearInterval( interval );
					setIsProcessing( false );
					setStatusMessage( 'Failed' );
				}
			} catch ( e ) {
				clearInterval( interval );
				setIsProcessing( false );
				setStatusMessage( e.message );
			}
		}, 2000 );
	};

	const getBakedImage = () => {
		if ( canvasRef.current ) {
			return canvasRef.current.getCleanDataURL( 'image/jpeg' );
		}
		return currentImageSrc;
	};

	const handleRunAI = async () => {
		setIsProcessing( true );
		setStatusMessage( 'Initializing...' );

		try {
			const payload = {
				task: aiMode,
				prompt: aiPrompt,
				select_prompt: aiSelectPrompt,
			};

			// Image Data
			const imageData = getBakedImage().replace(
				/^data:image\/\w+;base64,/,
				''
			);
			payload.image_data = imageData;

			// Mask Data
			if ( maskData ) {
				payload.mask_data = maskData.replace(
					/^data:image\/\w+;base64,/,
					''
				);
			}

			// Style Image
			if ( styleImage ) {
				payload.style_image_data = styleImage.replace(
					/^data:image\/\w+;base64,/,
					''
				);
			}

			setStatusMessage( 'Sending to AI...' );
			const response = await apiFetch( {
				path: '/bearded-media/v1/run-task',
				method: 'POST',
				data: payload,
			} );

			if ( response.task_id ) {
				setStatusMessage( 'Processing...' );
				pollTask( response.task_id );
			} else if ( response.b64_json ) {
				pushToHistory(
					`data:image/jpeg;base64,${ response.b64_json }`
				);
				setIsProcessing( false );
				setStatusMessage( '' );
			} else {
				throw new Error( 'No response from AI' );
			}
		} catch ( error ) {
			alert( error.message );
			setIsProcessing( false );
			setStatusMessage( '' );
		}
	};

	const handleSave = async () => {
		setIsProcessing( true );
		setStatusMessage( 'Saving...' );

		try {
			let finalImage = getBakedImage();

			const img = new Image();
			img.src = finalImage;
			await new Promise( ( resolve ) => ( img.onload = resolve ) );

			// DEBUG: Original Size
			console.group( 'Bearded AI: Save Debugging' );
			console.log( 'Original Dimensions:', img.width, 'x', img.height );

			const maxDim = 1200; // Lowered to be extra safe for 1MB limits
			if ( img.width > maxDim || img.height > maxDim ) {
				const canvas = document.createElement( 'canvas' );
				const scale = Math.min(
					maxDim / img.width,
					maxDim / img.height
				);
				canvas.width = img.width * scale;
				canvas.height = img.height * scale;
				const ctx = canvas.getContext( '2d' );
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage( img, 0, 0, canvas.width, canvas.height );
				finalImage = canvas.toDataURL( 'image/jpeg', 0.75 ); // Lowered quality
				console.log(
					'Resized Dimensions:',
					canvas.width,
					'x',
					canvas.height
				);
			}

			const finalData = finalImage.replace(
				/^data:image\/\w+;base64,/,
				''
			);

			// DEBUG: Payload Size
			const b64Length = finalData.length;
			const sizeMB = ( b64Length * 0.75 ) / 1024 / 1024;
			console.log( 'Base64 Length:', b64Length );
			console.log( 'Final Payload Size (MB):', sizeMB.toFixed( 2 ) );
			console.log( 'Request URL:', '/bearded-media/v1/save-image' );
			console.log( 'Request Method: POST' );
			console.log(
				'Total Estimated Body Size:',
				(
					JSON.stringify( {
						image_data: finalData,
						parent_id: imageAttributes.id,
					} ).length /
					1024 /
					1024
				).toFixed( 2 ) + ' MB'
			);
			console.groupEnd();

			const response = await apiFetch( {
				path: '/bearded-media/v1/save-image',
				method: 'POST',
				data: {
					image_data: finalData,
					parent_id: imageAttributes.id,
				},
			} );

			if ( response.id ) {
				setAttributes( response );
				onClose();
			}
		} catch ( error ) {
			alert( 'Save failed: ' + error.message );
		} finally {
			setIsProcessing( false );
		}
	};

	const handleDownload = () => {
		const data = getBakedImage();
		const link = document.createElement( 'a' );
		link.href = data;
		link.download = 'ai-edited-image.jpg';
		link.click();
	};

	const handleSetDrawMode = ( mode ) => {
		setActiveTool( 'branding' );
		setActiveTool( mode );
	};

	const handleAddText = () => {
		setActiveOverlay( {
			type: 'text',
			content: 'Your Text Here',
			size: 100,
			color: '#ffffff',
			fontFamily: 'serif',
			opacity: 1,
			x: 500,
			y: 500,
		} );
		setActiveTool( 'branding' );
	};

	const handleUploadWatermark = ( file ) => {
		const reader = new FileReader();
		reader.onload = ( e ) => {
			setActiveOverlay( {
				type: 'image',
				src: e.target.result,
				size: 50,
				opacity: 0.8,
				x: 500,
				y: 500,
			} );
			setActiveTool( 'branding' );
		};
		reader.readAsDataURL( file );
	};

	const handleOpenOverlay = ( item ) => {
		setActiveOverlay( item );
		setActiveTool( 'branding' );
	};

	const handleUploadStyle = ( file ) => {
		const reader = new FileReader();
		reader.onload = ( e ) => setStyleImage( e.target.result );
		reader.readAsDataURL( file );
	};

	const modalContent = (
		<div
			className="bearded-editor-viewport"
			style={ {
				position: 'fixed',
				inset: 0,
				zIndex: 999999,
				background: '#121212',
				display: 'flex',
				flexDirection: 'row',
				height: '100vh',
				width: '100vw',
				overflow: 'hidden',
				fontFamily:
					'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
			} }
		>
			{ /* Main Canvas / Workspace Area (Left) */ }
			<div
				className="bearded-editor-workspace-wrapper"
				style={ {
					flex: 1,
					position: 'relative',
					height: '100%',
					overflow: 'hidden',
					background: '#121212',
					display: 'flex',
					flexDirection: 'column',
				} }
			>
				{ /* Floating Horizontal Toolbar centered over Canvas */ }
				<EditorToolbar
					activeTool={ activeTool }
					setActiveTool={ setActiveTool }
					isAiMasking={ isAiMasking }
					setIsAiMasking={ setIsAiMasking }
					onUndo={ handleUndo }
					canUndo={ historyStep > 0 }
					onRedo={ handleRedo }
					canRedo={ historyStep < history.length - 1 }
					zoom={ zoom }
					onZoomIn={ () =>
						setZoom( ( z ) => Math.min( z + 0.2, 5 ) )
					}
					onZoomOut={ () =>
						setZoom( ( z ) => Math.max( z - 0.2, 0.1 ) )
					}
					onResetZoom={ () => {
						setZoom( 1 );
						setPan( { x: 0, y: 0 } );
					} }
					onSave={ handleSave }
					onDownload={ handleDownload }
					isProcessing={ isProcessing }
					onClose={ onClose }
				/>

				{ /* Canvas Editor Area */ }
				<CanvasWorkspace
					ref={ canvasRef }
					imageSrc={ currentImageSrc }
					brushSize={ brushSize }
					brushColor={ brushColor }
					maskData={ maskData }
					needsMask={
						isAiMasking &&
						[
							'stability-erase',
							'stability-inpaint',
							'stability-outpaint',
							'eraser',
							'fill',
						].includes( aiMode )
					}
					onBrushBake={ pushToHistory }
					onMaskChange={ setMaskData }
					onCropChange={ setCropData }
					activeTool={ activeTool }
					drawingEnabled={ activeTool === 'brush' }
					brightness={ brightness }
					contrast={ contrast }
					saturation={ saturation }
					zoom={ zoom }
					pan={ pan }
					onPanChange={ setPan }
					overlay={ activeOverlay }
					onOverlayChange={ setActiveOverlay }
					onOverlayCreate={ handleOpenOverlay }
				/>

				{ /* Dynamic Spinner/Status Processing Screen overlay */ }
				{ ( isProcessing || statusMessage ) && (
					<div
						style={ {
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: 'rgba(18, 18, 18, 0.75)',
							backdropFilter: 'blur(3px)',
							zIndex: 100,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
						} }
					>
						<Spinner />
						<p
							style={ {
								marginTop: 12,
								fontWeight: '600',
								color: '#ffffff',
								fontSize: '14px',
							} }
						>
							{ statusMessage }
						</p>
					</div>
				) }
			</div>

			{ /* Sidebar Inspector Panel (Right) */ }
			<InspectorPanel
				activeTool={ activeTool }
				setActiveTool={ setActiveTool }
				isAiMasking={ isAiMasking }
				brushSize={ brushSize }
				setBrushSize={ setBrushSize }
				brushColor={ brushColor }
				setBrushColor={ setBrushColor }
				onClearMask={ () => setMaskData( null ) }
				aiMode={ aiMode }
				setAiMode={ setAiMode }
				aiTaskOptions={ AI_TASKS }
				aiPrompt={ aiPrompt }
				setAiPrompt={ setAiPrompt }
				aiSelectPrompt={ aiSelectPrompt }
				setAiSelectPrompt={ setAiSelectPrompt }
				onRunAI={ handleRunAI }
				isProcessing={ isProcessing }
				onUploadStyle={ handleUploadStyle }
				styleImage={ styleImage }
				activeOverlay={ activeOverlay }
				onAddText={ handleAddText }
				onSetDrawMode={ handleSetDrawMode }
				onUploadWatermark={ handleUploadWatermark }
				onUpdateOverlay={ ( data ) =>
					setActiveOverlay( ( prev ) => ( { ...prev, ...data } ) )
				}
				onRemoveOverlay={ () => {
					setActiveOverlay( null );
					setActiveTool( 'move' );
				} }
				onApplyOverlay={ () => {
					const dataURL = getBakedImage();
					pushToHistory( dataURL );
					setActiveOverlay( null );
					setActiveTool( 'move' );
				} }
				onRotate={ handleRotate }
				onFlip={ handleFlip }
				brightness={ brightness }
				setBrightness={ setBrightness }
				contrast={ contrast }
				setContrast={ setContrast }
				saturation={ saturation }
				setSaturation={ setSaturation }
				resizeW={ resizeW }
				setResizeW={ setResizeW }
				resizeH={ resizeH }
				setResizeH={ setResizeH }
				onApplyResize={ handleApplyResize }
				onApplyCrop={ handleApplyCrop }
				onCancelCrop={ () => {
					setCropData( null );
					setActiveTool( 'move' );
				} }
				canApplyCrop={ !! cropData }
				imageAttributes={ imageAttributes }
			/>
		</div>
	);

	return createPortal( modalContent, document.body );
};

export default EditImageModal;
