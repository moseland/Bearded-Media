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
		width="20"
		height="20"
		fill="currentColor"
	>
		<path d="M5 11h14v2H5z" />
	</svg>
);

// Custom Zoom Reset Icon (Fit to Screen - Viewport Frame matching design image)
const zoomResetIcon = (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M6 6H10V4H4V10H6V6Z" fill="currentColor" />
		<path d="M10 18H6V14H4V20H10V18Z" fill="currentColor" />
		<path d="M14 6H18V10H20V4H14V6Z" fill="currentColor" />
		<path d="M14 18H18V14H20V20H14V18Z" fill="currentColor" />
		<path
			d="M12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5Z"
			fill="currentColor"
		/>
	</svg>
);

// Valid Move Icon
const moveIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="20"
		height="20"
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
		width="20"
		height="20"
		fill="currentColor"
	>
		<path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z" />
	</svg>
);

// Shape Rectangle Icon
const rectIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<rect x="4" y="4" width="16" height="16" rx="2" />
	</svg>
);

// Shape Circle Icon
const circleIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<circle cx="12" cy="12" r="8" />
	</svg>
);

// CenteredModal helper
const CenteredModal = ( { title, children, onClose } ) => (
	<button
		type="button"
		style={ {
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0,0,0,0.7)',
			zIndex: 100000,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backdropFilter: 'blur(4px)',
			border: 'none',
			width: '100vw',
			height: '100vh',
		} }
		onClick={ onClose }
	>
		{ /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */ }
		<section
			style={ {
				background: '#1e1e1e',
				color: '#ffffff',
				padding: '24px',
				borderRadius: '16px',
				width: '340px',
				boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
				border: '1px solid #333',
				textAlign: 'left',
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
					borderBottom: '1px solid #333',
					paddingBottom: '12px',
				} }
			>
				<strong
					id="modal-title"
					style={ {
						fontSize: '18px',
						fontWeight: 600,
						color: '#f0f0f0',
					} }
				>
					{ title }
				</strong>
				<Button
					icon={ close }
					onClick={ onClose }
					label="Close"
					variant="tertiary"
					style={ { color: '#888' } }
				/>
			</div>
			{ children }
		</section>
	</button>
);

// EditorToolbar (Floating Top Bar Component)
const EditorToolbar = ( {
	activeTool,
	setActiveTool,
	setIsAiMasking,
	onUndo,
	canUndo,
	onRedo,
	canRedo,
	zoom,
	onZoomIn,
	onZoomOut,
	onResetZoom,
	onSave,
	onDownload,
	isProcessing,
	onClose,
} ) => {
	const activeColor = '#007cba';
	const baseButtonStyle = {
		color: '#444444',
		borderRadius: '8px',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '6px',
		minWidth: '36px',
		height: '36px',
		cursor: 'pointer',
		border: 'none',
		background: 'transparent',
	};

	const getToolStyle = ( toolId ) => {
		const isActive =
			activeTool === toolId ||
			( toolId === 'brand' && activeTool === 'branding' );
		return {
			...baseButtonStyle,
			background: isActive ? 'rgba(0, 124, 186, 0.12)' : 'transparent',
			color: isActive ? activeColor : '#444444',
			fontWeight: isActive ? '600' : '400',
		};
	};

	const dividerStyle = {
		width: '1px',
		height: '24px',
		background: '#e2e8f0',
		alignSelf: 'center',
		margin: '0 4px',
	};

	return (
		<div
			className="bearded-editor-toolbar"
			style={ {
				position: 'absolute',
				top: '20px',
				left: '50%',
				transform: 'translateX(-50%)',
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'center',
				background: '#ffffff',
				borderRadius: '16px',
				boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
				padding: '8px 16px',
				gap: '8px',
				zIndex: 1000,
				border: '1px solid #e2e8f0',
				pointerEvents: 'auto',
			} }
		>
			{ /* Navigation Tools */ }
			<Button
				style={ getToolStyle( 'move' ) }
				icon={ moveIcon }
				label="Select / Pan"
				onClick={ () => setActiveTool( 'move' ) }
				tooltipPosition="bottom"
			/>

			<div style={ dividerStyle } />

			{ /* Canvas Tools */ }
			<Button
				style={ getToolStyle( 'crop' ) }
				icon={ crop }
				label="Crop Canvas"
				onClick={ () => {
					setActiveTool( 'crop' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>
			<Button
				style={ getToolStyle( 'brush' ) }
				icon={ brush }
				label="Brush Tool"
				onClick={ () => {
					setActiveTool( 'brush' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>
			<Button
				style={ getToolStyle( 'draw-rect' ) }
				icon={ rectIcon }
				label="Draw Rectangle"
				onClick={ () => {
					setActiveTool( 'draw-rect' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>
			<Button
				style={ getToolStyle( 'draw-circle' ) }
				icon={ circleIcon }
				label="Draw Circle"
				onClick={ () => {
					setActiveTool( 'draw-circle' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>

			<div style={ dividerStyle } />

			{ /* AI Labs */ }
			<Button
				style={ getToolStyle( 'ai' ) }
				icon={ aiIcon }
				label="AI Assistant Lab"
				onClick={ () => {
					setActiveTool( 'ai' );
					setIsAiMasking( true );
				} }
				tooltipPosition="bottom"
			/>

			{ /* Adjustments */ }
			<Button
				style={ getToolStyle( 'adjust' ) }
				icon={ adjustIcon }
				label="Color Corrections"
				onClick={ () => {
					setActiveTool( 'adjust' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>

			{ /* Branding */ }
			<Button
				style={ getToolStyle( 'brand' ) }
				icon={ tag }
				label="Text & Brand Overlays"
				onClick={ () => {
					setActiveTool( 'brand' );
					setIsAiMasking( false );
				} }
				tooltipPosition="bottom"
			/>

			<div style={ dividerStyle } />

			{ /* Undo / Redo */ }
			<Button
				style={ { ...baseButtonStyle, opacity: canUndo ? 1 : 0.4 } }
				icon={ undo }
				label="Undo"
				disabled={ ! canUndo }
				onClick={ onUndo }
				tooltipPosition="bottom"
			/>
			<Button
				style={ { ...baseButtonStyle, opacity: canRedo ? 1 : 0.4 } }
				icon={ redo }
				label="Redo"
				disabled={ ! canRedo }
				onClick={ onRedo }
				tooltipPosition="bottom"
			/>

			<div style={ dividerStyle } />

			{ /* Zoom Utilities */ }
			<Button
				style={ baseButtonStyle }
				icon={ minus }
				label="Zoom Out"
				onClick={ onZoomOut }
				tooltipPosition="bottom"
			/>
			<span
				style={ {
					fontSize: '12px',
					minWidth: '40px',
					textAlign: 'center',
					color: '#444',
					fontWeight: '600',
				} }
			>
				{ Math.round( zoom * 100 ) }%
			</span>
			<Button
				style={ baseButtonStyle }
				icon={ plus }
				label="Zoom In"
				onClick={ onZoomIn }
				tooltipPosition="bottom"
			/>
			<Button
				style={ baseButtonStyle }
				icon={ zoomResetIcon }
				label="Reset Zoom"
				onClick={ onResetZoom }
				tooltipPosition="bottom"
			/>

			<div style={ dividerStyle } />

			{ /* Primary Actions */ }
			<Button
				variant="primary"
				style={ {
					borderRadius: '8px',
					height: '36px',
					fontWeight: '600',
					padding: '0 16px',
					display: 'flex',
					alignItems: 'center',
					background: '#007cba',
					color: '#fff',
				} }
				onClick={ onSave }
				disabled={ isProcessing }
			>
				Save
			</Button>

			<Button
				style={ baseButtonStyle }
				icon={ download }
				label="Download File"
				onClick={ onDownload }
				tooltipPosition="bottom"
			/>

			<Button
				style={ {
					...baseButtonStyle,
					background: '#f1f5f9',
					marginLeft: '4px',
				} }
				icon={ close }
				label="Close Suite"
				onClick={ onClose }
				tooltipPosition="bottom"
			/>
		</div>
	);
};

// InspectorPanel (Right Contextual Sidebar Component)
const InspectorPanel = ( {
	activeTool,
	setActiveTool,
	isAiMasking,
	brushSize,
	setBrushSize,
	brushColor,
	setBrushColor,
	onClearMask,
	aiMode,
	setAiMode,
	aiTaskOptions,
	aiPrompt,
	setAiPrompt,
	aiSelectPrompt,
	setAiSelectPrompt,
	onRunAI,
	isProcessing,
	onUploadStyle,
	styleImage,
	activeOverlay,
	onAddText,
	onSetDrawMode,
	onUploadWatermark,
	onUpdateOverlay,
	onRemoveOverlay,
	onApplyOverlay,
	onRotate,
	onFlip,
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
	onApplyCrop,
	onCancelCrop,
	canApplyCrop,
	imageAttributes,
} ) => {
	const [ modalType, setModalType ] = useState( null );
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

	// Accent Header Style
	const headerStyle = {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderBottom: '1px solid #2d2d2d',
		paddingBottom: '12px',
		marginBottom: '20px',
	};

	const sectionTitleStyle = {
		fontSize: '12px',
		textTransform: 'uppercase',
		color: '#94a3b8',
		fontWeight: '700',
		letterSpacing: '0.05em',
	};

	const contentWrapperStyle = {
		padding: '24px',
		height: '100%',
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column',
		boxSizing: 'border-box',
	};

	// 1. BRUSH MASK PANEL
	const renderBrushPanel = () => (
		<div style={ contentWrapperStyle }>
			<div style={ headerStyle }>
				<span style={ sectionTitleStyle }>Standard Brush Tool</span>
			</div>
			<p
				style={ {
					fontSize: '13px',
					color: '#94a3b8',
					marginBottom: '24px',
					lineHeight: 1.5,
				} }
			>
				Paint directly onto the canvas space. Your drawing strokes will
				be merged onto the image on mouse release.
			</p>
			<RangeControl
				label="Brush Radius Size"
				value={ brushSize }
				onChange={ setBrushSize }
				min={ 1 }
				max={ 100 }
				withInputField={ true }
			/>
			<div style={ { marginTop: '20px' } }>
				<span
					style={ {
						fontSize: '13px',
						display: 'block',
						marginBottom: '8px',
						color: '#cbd5e1',
					} }
				>
					Brush Paint Color
				</span>
				<ColorPalette
					colors={ [
						{ name: 'White', color: '#ffffff' },
						{ name: 'Black', color: '#000000' },
						{ name: 'Red', color: '#ef4444' },
						{ name: 'Blue', color: '#3b82f6' },
						{ name: 'Yellow', color: '#eab308' },
						{ name: 'Green', color: '#22c55e' },
					] }
					value={ brushColor }
					onChange={ setBrushColor }
				/>
			</div>
		</div>
	);

	// 2. AI LAB PANEL
	const renderAIPanel = () => {
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
			<div style={ contentWrapperStyle }>
				<div style={ headerStyle }>
					<span style={ sectionTitleStyle }>AI Engine Lab</span>
				</div>

				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '20px',
					} }
				>
					<div>
						<label
							style={ {
								display: 'block',
								marginBottom: '6px',
								color: '#cbd5e1',
								fontSize: '12px',
								fontWeight: '600',
							} }
							htmlFor="ai-task-dropdown"
						>
							Select AI Skill Task
						</label>
						<SelectControl
							id="ai-task-dropdown"
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
									setActiveTool( 'ai' );
								}
							} }
						/>
					</div>

					{ needsStyleImage && (
						<div
							style={ {
								background: '#242424',
								padding: '16px',
								borderRadius: '12px',
								border: '1px solid #333',
							} }
						>
							<strong
								style={ {
									fontSize: '13px',
									display: 'block',
									marginBottom: '8px',
									color: '#f1f5f9',
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
								variant="secondary"
								onClick={ () => styleInputRef.current.click() }
								style={ {
									width: '100%',
									justifyContent: 'center',
									background: '#333',
									border: 'none',
									color: '#fff',
								} }
							>
								{ styleImage
									? 'Change Reference Image'
									: 'Upload Style Reference' }
							</Button>
							{ styleImage && (
								<img
									src={ styleImage }
									alt="Style Reference"
									style={ {
										width: '100%',
										height: '80px',
										objectFit: 'cover',
										borderRadius: '8px',
										marginTop: '12px',
										border: '1px solid #444',
									} }
								/>
							) }
						</div>
					) }

					{ needsMask && (
						<div
							style={ {
								background: '#242424',
								padding: '16px',
								borderRadius: '12px',
								border: '1px solid #333',
							} }
						>
							<div
								style={ {
									display: 'flex',
									justifyContent: 'space-between',
									marginBottom: '8px',
								} }
							>
								<strong
									style={ {
										fontSize: '13px',
										color: '#f1f5f9',
									} }
								>
									Brush Mask
								</strong>
								<Button
									isSmall
									variant="link"
									onClick={ onClearMask }
									style={ {
										color: '#ef4444',
										textDecoration: 'none',
									} }
								>
									Reset Mask
								</Button>
							</div>
							<div
								style={ {
									display: 'flex',
									gap: '8px',
									alignItems: 'center',
									marginTop: '12px',
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
									style={ { height: '36px', width: '36px' } }
								/>
								<div style={ { flex: 1 } }>
									<RangeControl
										value={ brushSize }
										onChange={ setBrushSize }
										min={ 5 }
										max={ 100 }
										withInputField={ false }
										style={ { marginBottom: 0 } }
									/>
								</div>
							</div>
						</div>
					) }

					{ needsSelect && (
						<div>
							<label
								style={ {
									display: 'block',
									marginBottom: '6px',
									color: '#cbd5e1',
									fontSize: '12px',
									fontWeight: '600',
								} }
								htmlFor="ai-select-input"
							>
								Select Target Object
							</label>
							<TextControl
								id="ai-select-input"
								value={ aiSelectPrompt }
								onChange={ setAiSelectPrompt }
								placeholder="e.g. The red car, blue flower..."
							/>
						</div>
					) }

					{ needsPrompt && (
						<div>
							<label
								style={ {
									display: 'block',
									marginBottom: '6px',
									color: '#cbd5e1',
									fontSize: '12px',
									fontWeight: '600',
								} }
								htmlFor="ai-prompt-input"
							>
								Creative Prompt
							</label>
							<TextareaControl
								id="ai-prompt-input"
								value={ aiPrompt }
								onChange={ setAiPrompt }
								rows={ 4 }
								placeholder="Describe in detail what you want the AI to generate or modify..."
							/>
						</div>
					) }

					<Button
						variant="primary"
						isBusy={ isProcessing }
						onClick={ onRunAI }
						style={ {
							justifyContent: 'center',
							marginTop: '16px',
							height: '42px',
							borderRadius: '8px',
							fontSize: '14px',
							fontWeight: '600',
							background: '#007cba',
							color: '#fff',
						} }
					>
						{ isProcessing
							? 'Processing AI...'
							: 'Run Generation Task' }
					</Button>
				</div>
			</div>
		);
	};

	// 3. COLOR CORRECTIONS PANEL
	const renderAdjustPanel = () => (
		<div style={ contentWrapperStyle }>
			<div style={ headerStyle }>
				<span style={ sectionTitleStyle }>Image Adjustments</span>
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
						color: '#ef4444',
						fontSize: '12px',
					} }
				>
					Reset All
				</Button>
			</div>

			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					gap: '24px',
				} }
			>
				<RangeControl
					label="Brightness Adjustment"
					value={ brightness }
					onChange={ setBrightness }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ true }
					help={ `${ brightness }%` }
				/>
				<RangeControl
					label="Contrast Enhancement"
					value={ contrast }
					onChange={ setContrast }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ true }
					help={ `${ contrast }%` }
				/>
				<RangeControl
					label="Saturation Vibrancy"
					value={ saturation }
					onChange={ setSaturation }
					min={ 0 }
					max={ 200 }
					initialPosition={ 100 }
					withInputField={ true }
					help={ `${ saturation }%` }
				/>
			</div>
		</div>
	);

	// 4. BRANDING & OVERLAYS PANEL
	const renderBrandingPanel = () => {
		if ( activeOverlay ) {
			return (
				<div style={ contentWrapperStyle }>
					<div style={ headerStyle }>
						<span style={ sectionTitleStyle }>
							Editing { activeOverlay.type } Layer
						</span>
						<Button
							isSmall
							variant="link"
							style={ {
								color: '#ef4444',
								textDecoration: 'none',
							} }
							onClick={ onRemoveOverlay }
						>
							Delete Layer
						</Button>
					</div>

					<div
						style={ {
							display: 'flex',
							flexDirection: 'column',
							gap: '20px',
							flex: 1,
						} }
					>
						{ activeOverlay.type === 'text' && (
							<>
								<TextControl
									label="Text Layer Content"
									value={ activeOverlay.content }
									onChange={ ( v ) =>
										onUpdateOverlay( { content: v } )
									}
								/>
								<SelectControl
									label="Typography Font Set"
									value={
										activeOverlay.fontFamily || 'sans-serif'
									}
									options={ [
										{
											label: 'Sans Serif',
											value: 'sans-serif',
										},
										{ label: 'Serif', value: 'serif' },
										{
											label: 'Monospace',
											value: 'monospace',
										},
										{ label: 'Arial', value: 'Arial' },
										{
											label: 'Helvetica',
											value: 'Helvetica',
										},
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
								label="Width / Scale Size"
								value={
									activeOverlay.width || activeOverlay.size
								}
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
									label="Shape Vertical Height"
									value={
										activeOverlay.height ||
										activeOverlay.size
									}
									onChange={ ( v ) =>
										onUpdateOverlay( { height: v } )
									}
									min={ 10 }
									max={ 1000 }
								/>
							) }
							{ activeOverlay.type === 'rect' && (
								<RangeControl
									label="Border Radius (px)"
									value={ activeOverlay.borderRadius || 0 }
									onChange={ ( v ) =>
										onUpdateOverlay( { borderRadius: v } )
									}
									min={ 0 }
									max={ 100 }
								/>
							) }
						</div>

						<RangeControl
							label="Layer Opacity %"
							value={ ( activeOverlay.opacity || 1 ) * 100 }
							onChange={ ( v ) =>
								onUpdateOverlay( { opacity: v / 100 } )
							}
							min={ 0 }
							max={ 100 }
						/>

						{ activeOverlay.type !== 'image' && (
							<div>
								<span
									style={ {
										fontSize: '13px',
										display: 'block',
										marginBottom: '8px',
										color: '#cbd5e1',
									} }
								>
									Layer Palette Color
								</span>
								<ColorPalette
									colors={ [
										{ name: 'White', color: '#ffffff' },
										{ name: 'Black', color: '#000000' },
										{ name: 'Red', color: '#ef4444' },
										{ name: 'Blue', color: '#3b82f6' },
										{ name: 'Yellow', color: '#eab308' },
										{ name: 'Green', color: '#22c55e' },
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
								gap: '12px',
								paddingTop: '20px',
							} }
						>
							<Button
								variant="secondary"
								onClick={ onRemoveOverlay }
								style={ {
									flex: 1,
									justifyContent: 'center',
									background: '#333',
									color: '#fff',
									border: 'none',
								} }
							>
								Discard
							</Button>
							<Button
								variant="primary"
								onClick={ onApplyOverlay }
								style={ {
									flex: 1,
									justifyContent: 'center',
									background: '#007cba',
									color: '#fff',
								} }
							>
								Confirm Overlay
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div style={ contentWrapperStyle }>
				<div style={ headerStyle }>
					<span style={ sectionTitleStyle }>Branding Overlays</span>
				</div>

				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '14px',
					} }
				>
					<Button
						variant="secondary"
						onClick={ onAddText }
						style={ {
							justifyContent: 'center',
							height: '40px',
							background: '#242424',
							color: '#fff',
							border: '1px solid #333',
						} }
					>
						Add Custom Text Layer
					</Button>

					<div style={ { display: 'flex', gap: '10px' } }>
						<Button
							variant={
								activeTool === 'draw-rect'
									? 'primary'
									: 'secondary'
							}
							onClick={ () => onSetDrawMode( 'draw-rect' ) }
							style={ {
								flex: 1,
								justifyContent: 'center',
								height: '40px',
							} }
						>
							Draw Rectangle
						</Button>
						<Button
							variant={
								activeTool === 'draw-circle'
									? 'primary'
									: 'secondary'
							}
							onClick={ () => onSetDrawMode( 'draw-circle' ) }
							style={ {
								flex: 1,
								justifyContent: 'center',
								height: '40px',
							} }
						>
							Draw Circle
						</Button>
					</div>

					{ ( activeTool === 'draw-rect' ||
						activeTool === 'draw-circle' ) && (
						<div
							style={ {
								fontSize: '12px',
								color: '#94a3b8',
								background: '#181818',
								padding: '12px',
								textAlign: 'center',
								borderRadius: '8px',
								border: '1px dashed #333',
								lineHeight: 1.4,
							} }
						>
							Click & drag directly on the canvas space to draw
							shapes.
						</div>
					) }

					<div
						style={ {
							borderTop: '1px solid #2d2d2d',
							paddingTop: '16px',
							marginTop: '8px',
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
							style={ {
								width: '100%',
								justifyContent: 'center',
								height: '40px',
								background: '#242424',
								color: '#fff',
								border: '1px solid #333',
							} }
						>
							Upload Custom Watermark
						</Button>
					</div>
				</div>
			</div>
		);
	};

	// 5. CROP PANEL
	const renderCropPanel = () => (
		<div style={ contentWrapperStyle }>
			<div style={ headerStyle }>
				<span style={ sectionTitleStyle }>Crop Dimensions</span>
			</div>
			<p
				style={ {
					fontSize: '13px',
					color: '#94a3b8',
					marginBottom: '24px',
					lineHeight: 1.5,
				} }
			>
				Drag a selection bounds on the canvas to set your desired crop
				area.
			</p>

			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
				} }
			>
				<Button
					variant="primary"
					onClick={ onApplyCrop }
					disabled={ ! canApplyCrop }
					style={ {
						width: '100%',
						justifyContent: 'center',
						height: '42px',
						borderRadius: '8px',
						fontWeight: '600',
						background: '#007cba',
						color: '#fff',
					} }
				>
					Confirm & Apply Crop
				</Button>
				<Button
					variant="secondary"
					onClick={ onCancelCrop }
					style={ {
						width: '100%',
						justifyContent: 'center',
						height: '40px',
						borderRadius: '8px',
						background: '#2d2d2d',
						color: '#fff',
						border: 'none',
					} }
				>
					Discard
				</Button>
			</div>
		</div>
	);

	// 6. DEFAULT / FALLBACK EMPTY STATE (MOVE TOOL)
	const renderEmptyState = () => {
		const name =
			imageAttributes?.url?.split( '/' ).pop() || 'media-asset.jpg';

		return (
			<div style={ contentWrapperStyle }>
				<div style={ headerStyle }>
					<span style={ sectionTitleStyle }>Creative Workspace</span>
				</div>

				<div
					style={ {
						display: 'flex',
						flexDirection: 'column',
						gap: '20px',
					} }
				>
					<div
						style={ {
							background: '#242424',
							padding: '16px',
							borderRadius: '12px',
							border: '1px solid #333',
						} }
					>
						<span
							style={ {
								fontSize: '11px',
								textTransform: 'uppercase',
								color: '#94a3b8',
								fontWeight: '700',
							} }
						>
							Active File Details
						</span>
						<strong
							style={ {
								display: 'block',
								fontSize: '14px',
								color: '#f1f5f9',
								marginTop: '6px',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							} }
						>
							{ name }
						</strong>
						<div
							style={ {
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gap: '10px',
								marginTop: '12px',
								fontSize: '12px',
								color: '#cbd5e1',
							} }
						>
							<div>
								<span
									style={ {
										color: '#94a3b8',
										display: 'block',
									} }
								>
									Dimension X:
								</span>
								<span>{ resizeW }px</span>
							</div>
							<div>
								<span
									style={ {
										color: '#94a3b8',
										display: 'block',
									} }
								>
									Dimension Y:
								</span>
								<span>{ resizeH }px</span>
							</div>
						</div>
					</div>

					{ /* Transform Actions Section */ }
					<div
						style={ {
							borderTop: '1px solid #2d2d2d',
							paddingTop: '16px',
						} }
					>
						<span
							style={ {
								...sectionTitleStyle,
								display: 'block',
								marginBottom: '12px',
							} }
						>
							Canvas Transforms
						</span>
						<div
							style={ {
								display: 'flex',
								gap: '8px',
								marginBottom: '12px',
							} }
						>
							<Button
								variant="secondary"
								icon={ rotateRight }
								onClick={ onRotate }
								label="Rotate 90"
								style={ {
									flex: 1,
									justifyContent: 'center',
									height: '38px',
									background: '#242424',
									color: '#fff',
									border: '1px solid #333',
								} }
							/>
							<Button
								variant="secondary"
								icon={ flipHorizontal }
								onClick={ () => onFlip( 'horizontal' ) }
								label="Flip H"
								style={ {
									flex: 1,
									justifyContent: 'center',
									height: '38px',
									background: '#242424',
									color: '#fff',
									border: '1px solid #333',
								} }
							/>
							<Button
								variant="secondary"
								icon={ flipVertical }
								onClick={ () => onFlip( 'vertical' ) }
								label="Flip V"
								style={ {
									flex: 1,
									justifyContent: 'center',
									height: '38px',
									background: '#242424',
									color: '#fff',
									border: '1px solid #333',
								} }
							/>
						</div>
						<Button
							variant="secondary"
							onClick={ () => setModalType( 'resize' ) }
							style={ {
								width: '100%',
								justifyContent: 'center',
								height: '38px',
								background: '#242424',
								color: '#fff',
								border: '1px solid #333',
							} }
						>
							Resize Canvas Layout...
						</Button>
					</div>

					{ /* Quick Tips Section */ }
					<div
						style={ {
							borderTop: '1px solid #2d2d2d',
							paddingTop: '16px',
							fontSize: '12px',
							color: '#94a3b8',
							lineHeight: 1.5,
						} }
					>
						<span
							style={ {
								...sectionTitleStyle,
								display: 'block',
								marginBottom: '8px',
							} }
						>
							Suite Shortcuts
						</span>
						<ul style={ { margin: 0, paddingLeft: '16px' } }>
							<li style={ { marginBottom: '6px' } }>
								Drag canvas while Select tool is active to pan
								around.
							</li>
							<li style={ { marginBottom: '6px' } }>
								Use top-center floating menu for quick utility
								transitions.
							</li>
							<li style={ { marginBottom: '6px' } }>
								Double click layers on canvas to open settings
								inspector.
							</li>
						</ul>
					</div>
				</div>

				{ modalType === 'resize' && (
					<CenteredModal
						title="Resize Asset Layout"
						onClose={ () => setModalType( null ) }
					>
						<div style={ { marginBottom: '14px' } }>
							<TextControl
								label="Width Size (px)"
								type="number"
								value={ resizeW }
								onChange={ setResizeW }
							/>
						</div>
						<div style={ { marginBottom: '20px' } }>
							<TextControl
								label="Height Size (px)"
								type="number"
								value={ resizeH }
								onChange={ setResizeH }
							/>
						</div>
						<div
							style={ {
								marginBottom: '20px',
								paddingTop: '15px',
								borderTop: '1px solid #333',
							} }
						>
							<SelectControl
								label="Transform Method"
								value={ resizeMethod }
								options={ [
									{
										label: 'Scale Aspect (Stretch/Shrink)',
										value: 'scale',
									},
									{
										label: 'AI Generative Expand (Inpaint)',
										value: 'generative-fill',
									},
								] }
								onChange={ ( val ) => setResizeMethod( val ) }
							/>
							{ resizeMethod === 'generative-fill' && (
								<p
									style={ {
										fontSize: '12px',
										color: '#94a3b8',
										marginTop: '6px',
										lineHeight: 1.4,
									} }
								>
									Canvas coordinates will grow, prompting AI
									Outpaint to seamlessly fill expanded border
									territories.
								</p>
							) }
							{ resizeMethod === 'scale' && (
								<ToggleControl
									label="Focus Aspect Smart Crop"
									checked={ smartCrop }
									onChange={ setSmartCrop }
									help="Leverages AI models to lock focal attention subjects while cropping to fit."
								/>
							) }
						</div>
						<Button
							variant="primary"
							style={ {
								width: '100%',
								justifyContent: 'center',
								height: '40px',
								background: '#007cba',
								color: '#fff',
							} }
							onClick={ () => {
								onApplyResize( resizeMethod, smartCrop );
								setModalType( null );
							} }
						>
							Apply Scale Transform
						</Button>
					</CenteredModal>
				) }
			</div>
		);
	};

	// DYNAMIC COMPONENT STATE MAPPING BASED ON activeTool VALUE
	const renderActiveContent = () => {
		const needsMask =
			isAiMasking &&
			[
				'stability-erase',
				'stability-inpaint',
				'stability-outpaint',
				'eraser',
				'fill',
			].includes( aiMode );

		if ( activeTool === 'brush' && needsMask ) {
			return renderAIPanel();
		}

		switch ( activeTool ) {
			case 'brush':
				return renderBrushPanel();
			case 'ai':
				return renderAIPanel();
			case 'adjust':
				return renderAdjustPanel();
			case 'brand':
			case 'branding':
			case 'draw-rect':
			case 'draw-circle':
				return renderBrandingPanel();
			case 'crop':
				return renderCropPanel();
			case 'move':
			default:
				return renderEmptyState();
		}
	};

	return (
		<aside
			className="bearded-editor-inspector"
			style={ {
				width: '320px',
				height: '100%',
				background: '#1e1e1e',
				borderLeft: '1px solid #2d2d2d',
				display: 'flex',
				flexDirection: 'column',
				zIndex: 20,
				position: 'relative',
				color: '#ffffff',
			} }
		>
			{ renderActiveContent() }
		</aside>
	);
};

export default EditorToolbar;
export { InspectorPanel };
