import {
	RangeControl,
	Button,
	SelectControl,
	TextControl,
	TextareaControl,
	ToggleControl,
	ColorPalette,
} from '@wordpress/components';
import { useState, useRef } from '@wordpress/element';
import {
	rotateRight,
	crop,
	brush,
	undo,
	redo,
	flipHorizontal,
	flipVertical,
	plus,
	reset,
	settings as adjustIcon,
	close,
	download,
	tag,
} from '@wordpress/icons';

// Custom Minus Icon
const minus = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		fill="currentColor"
	>
		<path d="M5 11h14v2H5z" />
	</svg>
);

// Valid Move Icon
const moveIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
	>
		<path
			d="M18 11h-5V6h3l-4-5-4 5h3v5H6V8l-5 4 5 4v-3h5v5H8l4 5 4-5h-3v-5h5v3l5-4-5-4v3z"
			fill="currentColor"
		/>
	</svg>
);

// Custom Robot Icon for AI Lab
const aiIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		fill="currentColor"
	>
		<path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z" />
	</svg>
);

const CenteredModal = ( { title, children, onClose } ) => (
	<button
		type="button"
		style={ {
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0,0,0,0.6)',
			zIndex: 100000,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backdropFilter: 'blur(3px)',
			border: 'none',
			width: '100vw',
			height: '100vh',
		} }
		onClick={ onClose }
		onKeyDown={ ( e ) => {
			if ( e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' ) {
				onClose();
			}
		} }
	>
		{ /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */ }
		<section
			style={ {
				background: '#fff',
				padding: '24px',
				borderRadius: '12px',
				width: '320px',
				boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
				animation: 'fadeIn 0.2s ease-out',
			} }
			onClick={ ( e ) => e.stopPropagation() }
			onKeyDown={ ( e ) => e.stopPropagation() }
			role="dialog"
			aria-labelledby="modal-title"
		>
			<div
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '20px',
					borderBottom: '1px solid #f0f0f0',
					paddingBottom: '12px',
				} }
			>
				<strong
					id="modal-title"
					style={ { fontSize: '18px', fontWeight: 600 } }
				>
					{ title }
				</strong>
				<Button
					icon={ close }
					onClick={ onClose }
					label="Close"
					variant="tertiary"
				/>
			</div>
			{ children }
		</section>
	</button>
);

const EditorToolbar = ( props ) => {
	const {
		activeTool,
		setActiveTool,
		brushSize,
		setBrushSize,
		onRotate,
		onFlip,
		onApplyCrop,
		onCancelCrop,
		onClearMask,
		canApplyCrop,
		onUndo,
		canUndo,
		onRedo,
		canRedo,
		zoom,
		onZoomIn,
		onZoomOut,
		onResetZoom,
		brightness,
		setBrightness,
		contrast,
		setContrast,
		saturation,
		setSaturation,
		resizeW,
		setResizeW,
		resizeH,
		setResizeH,
		onApplyResize,

		// AI Props
		aiMode,
		setAiMode,
		aiTaskOptions,
		aiPrompt,
		setAiPrompt,
		aiSelectPrompt,
		setAiSelectPrompt,
		onRunAI,
		isProcessing,

		// Style Transfer
		onUploadStyle,
		styleImage,

		// Branding Props
		activeOverlay,
		onAddText,
		onSetDrawMode,
		onUploadWatermark,
		onUpdateOverlay,
		onRemoveOverlay,
		onApplyOverlay,

		// Actions
		onSave,
		onDownload,
	} = props;

	const [ activeTab, setActiveTab ] = useState( 'ai' );
	const [ modalType, setModalType ] = useState( null );

	// Resize Modal State
	const [ resizeMethod, setResizeMethod ] = useState( 'scale' );
	const [ smartCrop, setSmartCrop ] = useState( false );

	const fileInputRef = useRef( null );
	const styleInputRef = useRef( null );

	const handleFileSelect = ( e ) => {
		if ( e.target.files && e.target.files[ 0 ] ) {
			onUploadWatermark( e.target.files[ 0 ] );
		}
	};

	const handleStyleSelect = ( e ) => {
		if ( e.target.files && e.target.files[ 0 ] ) {
			onUploadStyle( e.target.files[ 0 ] );
		}
	};

	// --- RENDERERS ---

	const renderTransformTools = () => (
		<div
			style={ {
				display: 'flex',
				flexDirection: 'column',
				gap: '15px',
				width: '100%',
			} }
		>
			<div
				style={ {
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: '8px',
				} }
			>
				<Button
					variant={ activeTool === 'move' ? 'primary' : 'secondary' }
					icon={ moveIcon }
					onClick={ () => setActiveTool( 'move' ) }
					label="Move/Pan"
					style={ { justifyContent: 'center' } }
				/>
				<Button
					variant={ activeTool === 'crop' ? 'primary' : 'secondary' }
					icon={ crop }
					onClick={ () => setActiveTool( 'crop' ) }
					label="Crop"
					style={ { justifyContent: 'center' } }
				/>
			</div>

			<div style={ { borderTop: '1px solid #eee', paddingTop: '15px' } }>
				<small
					style={ {
						display: 'block',
						marginBottom: '8px',
						color: '#666',
						fontWeight: '600',
					} }
				>
					Orientation
				</small>
				<div style={ { display: 'flex', gap: '8px' } }>
					<Button
						variant="secondary"
						icon={ rotateRight }
						onClick={ onRotate }
						label="Rotate 90"
					/>
					<Button
						variant="secondary"
						icon={ flipHorizontal }
						onClick={ () => onFlip( 'horizontal' ) }
						label="Flip H"
					/>
					<Button
						variant="secondary"
						icon={ flipVertical }
						onClick={ () => onFlip( 'vertical' ) }
						label="Flip V"
					/>
				</div>
			</div>

			<Button
				variant="secondary"
				onClick={ () => setModalType( 'resize' ) }
				style={ { justifyContent: 'center' } }
			>
				Resize Dimensions...
			</Button>
		</div>
	);

	const renderAdjustTools = () => (
		<div
			style={ {
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				gap: '24px',
			} }
		>
			<div
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					borderBottom: '1px solid #eee',
					paddingBottom: '8px',
				} }
			>
				<strong
					style={ {
						fontSize: '12px',
						textTransform: 'uppercase',
						color: '#555',
					} }
				>
					Color Correction
				</strong>
				<Button
					isSmall
					variant="link"
					onClick={ () => {
						setBrightness( 100 );
						setContrast( 100 );
						setSaturation( 100 );
					} }
					style={ {
						textDecoration: 'none',
						color: '#d63638',
						fontSize: '11px',
					} }
				>
					Reset All
				</Button>
			</div>

			<div style={ { width: '100%' } }>
				<RangeControl
					label="Brightness"
					value={ brightness }
					onChange={ setBrightness }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ false }
					help={ `${ brightness }%` }
				/>
			</div>
			<div style={ { width: '100%' } }>
				<RangeControl
					label="Contrast"
					value={ contrast }
					onChange={ setContrast }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ false }
					help={ `${ contrast }%` }
				/>
			</div>
			<div style={ { width: '100%' } }>
				<RangeControl
					label="Saturation"
					value={ saturation }
					onChange={ setSaturation }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ false }
					help={ `${ saturation }%` }
				/>
			</div>
		</div>
	);

	const renderBrandingTools = () => {
		if ( activeOverlay ) {
			return (
				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '15px',
						width: '100%',
					} }
				>
					<div
						style={ {
							display: 'flex',
							justifyContent: 'space-between',
							borderBottom: '1px solid #eee',
							paddingBottom: '10px',
						} }
					>
						<strong> Editing { activeOverlay.type } </strong>
						<Button
							isSmall
							variant="link"
							style={ { color: '#d63638' } }
							onClick={ onRemoveOverlay }
						>
							Delete
						</Button>
					</div>

					{ activeOverlay.type === 'text' && (
						<>
							<TextControl
								label="Content"
								value={ activeOverlay.content }
								onChange={ ( v ) =>
									onUpdateOverlay( { content: v } )
								}
							/>
							<SelectControl
								label="Font"
								value={
									activeOverlay.fontFamily || 'sans-serif'
								}
								options={ [
									{
										label: 'Sans Serif',
										value: 'sans-serif',
									},
									{ label: 'Serif', value: 'serif' },
									{ label: 'Monospace', value: 'monospace' },
									{ label: 'Arial', value: 'Arial' },
									{ label: 'Helvetica', value: 'Helvetica' },
									{
										label: 'Times New Roman',
										value: 'Times New Roman',
									},
									{
										label: 'Courier New',
										value: 'Courier New',
									},
									{ label: 'Verdana', value: 'Verdana' },
									{ label: 'Georgia', value: 'Georgia' },
									{ label: 'Impact', value: 'Impact' },
									{
										label: 'Comic Sans MS',
										value: 'Comic Sans MS',
									},
								] }
								onChange={ ( v ) =>
									onUpdateOverlay( { fontFamily: v } )
								}
							/>
						</>
					) }

					<div>
						<RangeControl
							label="Size/Width"
							value={ activeOverlay.width || activeOverlay.size }
							onChange={ ( v ) =>
								onUpdateOverlay( { width: v, size: v } )
							}
							min={ 10 }
							max={ 1000 }
						/>
						{ ( activeOverlay.type === 'rect' ||
							activeOverlay.type === 'image' ||
							activeOverlay.type === 'circle' ) && (
							<RangeControl
								label="Height"
								value={
									activeOverlay.height || activeOverlay.size
								}
								onChange={ ( v ) =>
									onUpdateOverlay( { height: v } )
								}
								min={ 10 }
								max={ 1000 }
							/>
						) }
					</div>

					<div>
						<RangeControl
							label="Opacity"
							value={ ( activeOverlay.opacity || 1 ) * 100 }
							onChange={ ( v ) =>
								onUpdateOverlay( { opacity: v / 100 } )
							}
							min={ 0 }
							max={ 100 }
						/>
					</div>

					{ activeOverlay.type !== 'image' && (
						<div>
							<span
								style={ {
									fontSize: '12px',
									display: 'block',
									marginBottom: '5px',
								} }
							>
								Color
							</span>
							<ColorPalette
								colors={ [
									{ name: 'White', color: '#ffffff' },
									{ name: 'Black', color: '#000000' },
									{ name: 'Red', color: '#ff0000' },
									{ name: 'Blue', color: '#0000ff' },
									{ name: 'Yellow', color: '#ffff00' },
									{ name: 'Green', color: '#00ff00' },
								] }
								value={ activeOverlay.color }
								onChange={ ( c ) =>
									onUpdateOverlay( { color: c } )
								}
								clearable={ false }
							/>
						</div>
					) }

					<div
						style={ {
							marginTop: 'auto',
							display: 'flex',
							gap: '10px',
						} }
					>
						<Button
							variant="secondary"
							onClick={ onRemoveOverlay }
							style={ { flex: 1, justifyContent: 'center' } }
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={ onApplyOverlay }
							style={ { flex: 1, justifyContent: 'center' } }
						>
							Apply
						</Button>
					</div>
				</div>
			);
		}

		return (
			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					gap: '10px',
					width: '100%',
				} }
			>
				<Button
					variant="secondary"
					onClick={ onAddText }
					style={ { justifyContent: 'center' } }
				>
					Add Text
				</Button>

				<div style={ { display: 'flex', gap: '10px' } }>
					<Button
						variant={
							activeTool === 'draw-rect' ? 'primary' : 'secondary'
						}
						onClick={ () => onSetDrawMode( 'draw-rect' ) }
						style={ { flex: 1, justifyContent: 'center' } }
					>
						Rectangle
					</Button>
					<Button
						variant={
							activeTool === 'draw-circle'
								? 'primary'
								: 'secondary'
						}
						onClick={ () => onSetDrawMode( 'draw-circle' ) }
						style={ { flex: 1, justifyContent: 'center' } }
					>
						Circle
					</Button>
				</div>
				{ ( activeTool === 'draw-rect' ||
					activeTool === 'draw-circle' ) && (
					<div
						style={ {
							fontSize: '12px',
							color: '#666',
							background: '#f0f0f0',
							padding: '8px',
							textAlign: 'center',
						} }
					>
						Click and drag on the canvas to draw.
					</div>
				) }

				<div
					style={ {
						borderTop: '1px solid #eee',
						paddingTop: '10px',
						marginTop: '5px',
					} }
				>
					<input
						type="file"
						accept="image/*"
						ref={ fileInputRef }
						style={ { display: 'none' } }
						onChange={ handleFileSelect }
					/>
					<Button
						variant="secondary"
						onClick={ () => fileInputRef.current.click() }
						style={ { width: '100%', justifyContent: 'center' } }
					>
						Upload Watermark
					</Button>
				</div>
			</div>
		);
	};

	const renderAITools = () => {
		const needsMask = [
			'stability-erase',
			'stability-inpaint',
			'stability-outpaint',
			'eraser',
			'fill',
		].includes( aiMode );
		const needsPrompt = ! [
			'eraser',
			'stability-erase',
			'stability-remove-bg',
			'stability-upscale-fast',
			'stability-upscale-conservative',
			'stability-style-transfer',
		].includes( aiMode );
		const needsSelect = [
			'stability-search-replace',
			'stability-search-recolor',
		].includes( aiMode );
		const needsStyleImage = [ 'stability-style-transfer' ].includes(
			aiMode
		);

		return (
			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					gap: '15px',
					width: '100%',
				} }
			>
				<div>
					<small
						style={ {
							display: 'block',
							marginBottom: '4px',
							color: '#666',
							fontWeight: '600',
						} }
					>
						Task
					</small>
					<SelectControl
						value={ aiMode }
						options={ aiTaskOptions }
						onChange={ ( val ) => {
							setAiMode( val );
							if (
								[
									'stability-erase',
									'stability-inpaint',
									'eraser',
									'fill',
								].includes( val )
							) {
								setActiveTool( 'brush' );
							} else {
								setActiveTool( 'move' );
							}
						} }
						style={ { marginBottom: 0 } }
					/>
				</div>

				{ needsStyleImage && (
					<div
						style={ {
							background: '#f9f9f9',
							padding: '10px',
							borderRadius: '6px',
							border: '1px solid #e0e0e0',
						} }
					>
						<strong
							style={ {
								fontSize: '12px',
								display: 'block',
								marginBottom: '5px',
							} }
						>
							Style Reference
						</strong>
						<input
							type="file"
							accept="image/*"
							ref={ styleInputRef }
							style={ { display: 'none' } }
							onChange={ handleStyleSelect }
						/>
						<Button
							isSmall
							variant="secondary"
							onClick={ () => styleInputRef.current.click() }
							style={ {
								width: '100%',
								justifyContent: 'center',
							} }
						>
							{ styleImage
								? 'Change Image'
								: 'Upload Style Image' }
						</Button>
						{ styleImage && (
							<img
								src={ styleImage }
								alt="Style Reference"
								style={ {
									width: '100%',
									height: '60px',
									objectFit: 'cover',
									borderRadius: '4px',
									marginTop: '8px',
								} }
							/>
						) }
					</div>
				) }

				{ needsMask && (
					<div
						style={ {
							background: '#f9f9f9',
							padding: '10px',
							borderRadius: '6px',
							border: '1px solid #e0e0e0',
						} }
					>
						<div
							style={ {
								display: 'flex',
								justifyContent: 'space-between',
								marginBottom: '10px',
							} }
						>
							<strong style={ { fontSize: '12px' } }>
								Masking
							</strong>
							<Button
								isSmall
								variant="link"
								onClick={ onClearMask }
								style={ {
									color: '#d63638',
									textDecoration: 'none',
								} }
							>
								Clear
							</Button>
						</div>
						<div
							style={ {
								display: 'flex',
								gap: '8px',
								alignItems: 'center',
							} }
						>
							<Button
								icon={ brush }
								isPressed={ activeTool === 'brush' }
								onClick={ () => setActiveTool( 'brush' ) }
								variant={
									activeTool === 'brush'
										? 'primary'
										: 'secondary'
								}
								label="Brush"
							/>
							<div style={ { flex: 1, width: '100%' } }>
								<RangeControl
									value={ brushSize }
									onChange={ setBrushSize }
									min={ 5 }
									max={ 100 }
									withInputField={ false }
									style={ { marginBottom: 0, width: '100%' } }
								/>
							</div>
						</div>
					</div>
				) }

				{ needsSelect && (
					<div>
						<small
							style={ {
								display: 'block',
								marginBottom: '4px',
								color: '#666',
								fontWeight: '600',
							} }
						>
							Select Object
						</small>
						<TextControl
							value={ aiSelectPrompt }
							onChange={ setAiSelectPrompt }
							placeholder="e.g. The red car"
							style={ { marginBottom: 0 } }
						/>
					</div>
				) }

				{ needsPrompt && (
					<div>
						<small
							style={ {
								display: 'block',
								marginBottom: '4px',
								color: '#666',
								fontWeight: '600',
							} }
						>
							Prompt
						</small>
						<TextareaControl
							value={ aiPrompt }
							onChange={ setAiPrompt }
							rows={ 4 }
							placeholder="Describe the result..."
							style={ { marginBottom: 0 } }
						/>
					</div>
				) }

				<Button
					variant="primary"
					isBusy={ isProcessing }
					onClick={ onRunAI }
					style={ { justifyContent: 'center', marginTop: '10px' } }
				>
					{ isProcessing ? 'Processing...' : 'Run' }
				</Button>
			</div>
		);
	};

	// --- MAIN LAYOUT ---

	return (
		<div
			style={ {
				width: '280px',
				height: '100%',
				background: '#fff',
				borderRight: '1px solid #e0e0e0',
				display: 'flex',
				flexDirection: 'column',
				zIndex: 20,
			} }
		>
			{ /* Header / Tabs */ }
			<div
				style={ {
					padding: '15px 15px 0',
					borderBottom: '1px solid #eee',
				} }
			>
				<div
					style={ {
						display: 'flex',
						gap: '5px',
						marginBottom: '15px',
						justifyContent: 'space-around',
					} }
				>
					<Button
						icon={ crop }
						label="Transform"
						isPressed={ activeTab === 'transform' }
						onClick={ () => setActiveTab( 'transform' ) }
					/>
					<Button
						icon={ adjustIcon }
						label="Adjust"
						isPressed={ activeTab === 'adjust' }
						onClick={ () => setActiveTab( 'adjust' ) }
					/>
					<Button
						icon={ aiIcon }
						label="AI Lab"
						isPressed={ activeTab === 'ai' }
						onClick={ () => setActiveTab( 'ai' ) }
					/>
					<Button
						icon={ tag }
						label="Branding"
						isPressed={ activeTab === 'brand' }
						onClick={ () => setActiveTab( 'brand' ) }
					/>
				</div>
			</div>

			{ /* Scrollable Tool Content */ }
			<div style={ { flex: 1, padding: '20px', overflowY: 'auto' } }>
				{ activeTab === 'transform' && renderTransformTools() }
				{ activeTab === 'adjust' && renderAdjustTools() }
				{ activeTab === 'ai' && renderAITools() }
				{ activeTab === 'brand' && renderBrandingTools() }

				{ /* Contextual Action: Apply Crop */ }
				{ activeTool === 'crop' && (
					<div
						style={ {
							marginTop: '20px',
							padding: '15px',
							background: '#f0f0f0',
							borderRadius: '8px',
						} }
					>
						<Button
							variant="primary"
							onClick={ onApplyCrop }
							disabled={ ! canApplyCrop }
							style={ {
								width: '100%',
								justifyContent: 'center',
								marginBottom: '8px',
							} }
						>
							Apply Crop
						</Button>
						<Button
							variant="secondary"
							onClick={ onCancelCrop }
							style={ {
								width: '100%',
								justifyContent: 'center',
							} }
						>
							Cancel
						</Button>
					</div>
				) }
			</div>

			{ /* Footer: Global Actions (Undo/Zoom/Save) */ }
			<div
				style={ {
					padding: '15px',
					borderTop: '1px solid #e0e0e0',
					background: '#fbfbfb',
				} }
			>
				{ /* Save/Download Group */ }
				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '8px',
						marginBottom: '15px',
						paddingBottom: '15px',
						borderBottom: '1px solid #eee',
					} }
				>
					<Button
						variant="primary"
						onClick={ onSave }
						disabled={ isProcessing }
						style={ { justifyContent: 'center' } }
					>
						Save to Library
					</Button>
					<Button
						variant="secondary"
						icon={ download }
						onClick={ onDownload }
						disabled={ isProcessing }
						style={ { justifyContent: 'center' } }
						label="Download"
					/>
				</div>

				<div
					style={ {
						display: 'flex',
						justifyContent: 'center',
						gap: '8px',
						marginBottom: '10px',
					} }
				>
					<Button
						icon={ undo }
						onClick={ onUndo }
						disabled={ ! canUndo }
						isSmall
						variant="secondary"
						label="Undo"
					/>
					<Button
						icon={ redo }
						onClick={ onRedo }
						disabled={ ! canRedo }
						isSmall
						variant="secondary"
						label="Redo"
					/>
				</div>
				<div
					style={ {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '8px',
					} }
				>
					<Button
						icon={ minus }
						isSmall
						onClick={ onZoomOut }
						variant="tertiary"
						label="Zoom Out"
					/>
					<Button
						icon={ reset }
						isSmall
						onClick={ onResetZoom }
						variant="tertiary"
						label="Reset Zoom"
					/>
					<span
						style={ {
							fontSize: '12px',
							minWidth: '40px',
							textAlign: 'center',
						} }
					>
						{ Math.round( zoom * 100 ) }%
					</span>
					<Button
						icon={ plus }
						isSmall
						onClick={ onZoomIn }
						variant="tertiary"
						label="Zoom In"
					/>
				</div>
			</div>

			{ /* --- MODALS --- */ }

			{ modalType === 'resize' && (
				<CenteredModal
					title="Resize Image"
					onClose={ () => setModalType( null ) }
				>
					<div style={ { marginBottom: '12px' } }>
						<TextControl
							label="Width (px)"
							type="number"
							value={ resizeW }
							onChange={ setResizeW }
						/>
					</div>
					<div style={ { marginBottom: '20px' } }>
						<TextControl
							label="Height (px)"
							type="number"
							value={ resizeH }
							onChange={ setResizeH }
						/>
					</div>
					<div
						style={ {
							marginBottom: '20px',
							paddingTop: '15px',
							borderTop: '1px solid #eee',
						} }
					>
						<SelectControl
							label="Method"
							value={ resizeMethod }
							options={ [
								{
									label: 'Scale (Stretch/Shrink)',
									value: 'scale',
								},
								{
									label: 'Generative Fill (Expand)',
									value: 'generative-fill',
								},
							] }
							onChange={ ( val ) => setResizeMethod( val ) }
						/>
						{ resizeMethod === 'generative-fill' && (
							<p
								style={ {
									fontSize: '12px',
									color: '#666',
									marginTop: '5px',
								} }
							>
								Canvas will be expanded and AI will
								automatically fill the empty space using
								Outpainting.
							</p>
						) }
						{ resizeMethod === 'scale' && (
							<ToggleControl
								label="Smart Crop (AI Subject Focus)"
								checked={ smartCrop }
								onChange={ setSmartCrop }
								help="Detects subject and crops to center it."
							/>
						) }
					</div>
					<Button
						variant="primary"
						style={ { width: '100%', justifyContent: 'center' } }
						onClick={ () => {
							onApplyResize( resizeMethod, null, smartCrop );
							setModalType( null );
						} }
					>
						Apply
					</Button>
				</CenteredModal>
			) }
		</div>
	);
};

export default EditorToolbar;
