import {
	useEffect,
	useRef,
	useState,
	forwardRef,
	useImperativeHandle,
	useCallback,
} from '@wordpress/element';

const CanvasWorkspace = forwardRef(
	(
		{
			imageSrc,
			brushSize,
			onMaskChange,
			onCropChange,
			activeTool,
			rotation = 0,
			drawingEnabled,
			brightness = 100,
			contrast = 100,
			saturation = 100,
			zoom = 1,
			pan = { x: 0, y: 0 },
			onPanChange,

			// Branding / Overlay Props
			overlay,
			onOverlayChange,
			onOverlayCreate,
		},
		ref
	) => {
		const canvasRef = useRef( null );
		const imageRef = useRef( null );
		const overlayImageRef = useRef( null );
		const maskCanvasRef = useRef( document.createElement( 'canvas' ) );

		const [ isDrawing, setIsDrawing ] = useState( false );
		const [ isPanning, setIsPanning ] = useState( false );
		const [ isDraggingOverlay, setIsDraggingOverlay ] = useState( false );

		// Shape Drawing State
		const [ shapeStart, setShapeStart ] = useState( null );
		const [ currentShape, setCurrentShape ] = useState( null ); // { x, y, w, h }

		const [ dragStart, setDragStart ] = useState( { x: 0, y: 0 } );
		const [ context, setContext ] = useState( null );
		const [ maskContext, setMaskContext ] = useState( null );

		// Crop State
		const [ cropStart, setCropStart ] = useState( null );
		const [ cropRect, setCropRect ] = useState( null );

		const drawCanvas = useCallback(
			( showUI = true ) => {
				const canvas = canvasRef.current;
				const maskCanvas = maskCanvasRef.current;
				const img = imageRef.current;
				if ( ! canvas || ! img ) {
					return;
				}

				const ctx = canvas.getContext( '2d' );
				setContext( ctx );
				const mCtx = maskCanvas.getContext( '2d' );
				setMaskContext( mCtx );

				const safeRotation = rotation || 0;
				const isVertical = safeRotation % 180 !== 0;

				const naturalWidth = isVertical ? img.height : img.width;
				const naturalHeight = isVertical ? img.width : img.height;

				canvas.width = naturalWidth;
				canvas.height = naturalHeight;
				maskCanvas.width = naturalWidth;
				maskCanvas.height = naturalHeight;

				// Draw Base Image
				ctx.save();
				ctx.filter = `brightness(${ brightness }%) contrast(${ contrast }%) saturate(${ saturation }%)`;
				ctx.translate( canvas.width / 2, canvas.height / 2 );
				ctx.rotate( ( safeRotation * Math.PI ) / 180 );
				ctx.drawImage(
					img,
					-img.width / 2,
					-img.height / 2,
					img.width,
					img.height
				);
				ctx.restore();

				// Helper to draw an overlay item
				const drawItem = ( item ) => {
					ctx.save();
					ctx.globalAlpha =
						item.opacity !== undefined ? item.opacity : 1;

					const x = item.x || canvas.width / 2;
					const y = item.y || canvas.height / 2;

					if ( item.type === 'text' ) {
						ctx.font = `${ item.size || 40 }px ${
							item.fontFamily || 'sans-serif'
						}`;
						ctx.fillStyle = item.color || '#ffffff';
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.shadowColor = 'rgba(0,0,0,0.5)';
						ctx.shadowBlur = 4;
						ctx.fillText( item.content || 'Text', x, y );
					} else if ( item.type === 'rect' ) {
						const w = item.width || item.size || 100;
						const h = item.height || item.size || 100;
						ctx.fillStyle = item.color || 'red';
						ctx.fillRect( x - w / 2, y - h / 2, w, h );
					} else if ( item.type === 'circle' ) {
						const w = item.width || item.size || 100;
						const h = item.height || item.size || 100;
						ctx.beginPath();
						// Support Ovals using ellipse
						ctx.ellipse(
							x,
							y,
							Math.abs( w ) / 2,
							Math.abs( h ) / 2,
							0,
							0,
							2 * Math.PI
						);
						ctx.fillStyle = item.color || 'red';
						ctx.fill();
					} else if (
						item.type === 'image' &&
						overlayImageRef.current
					) {
						const oImg = overlayImageRef.current;
						const scale = ( item.size || 100 ) / 100;
						const w = oImg.width * scale;
						const h = oImg.height * scale;
						ctx.drawImage( oImg, x - w / 2, y - h / 2, w, h );
					}

					ctx.restore();
				};

				// Draw Existing Overlay
				if ( overlay ) {
					drawItem( overlay );

					// Draw Selection Outline (Only if showUI is true)
					if ( showUI && activeTool === 'branding' ) {
						ctx.save();
						ctx.strokeStyle = '#00f7ff';
						ctx.lineWidth = 2;
						ctx.setLineDash( [ 5, 5 ] );

						const bx = overlay.x || canvas.width / 2;
						const by = overlay.y || canvas.height / 2;
						let bw = 10;
						let bh = 10;
						if ( overlay.type === 'text' ) {
							bw =
								( overlay.size || 40 ) *
								( overlay.content?.length || 4 ) *
								0.6;
							bh = ( overlay.size || 40 ) * 1.2;
						} else if (
							overlay.type === 'rect' ||
							overlay.type === 'circle'
						) {
							bw = overlay.width || overlay.size || 100;
							bh = overlay.height || overlay.size || 100;
						} else if (
							overlay.type === 'image' &&
							overlayImageRef.current
						) {
							const s = ( overlay.size || 100 ) / 100;
							bw = overlayImageRef.current.width * s;
							bh = overlayImageRef.current.height * s;
						}
						ctx.strokeRect( bx - bw / 2, by - bh / 2, bw, bh );
						ctx.restore();
					}
				}

				// Draw Shape currently being created
				if ( showUI && currentShape ) {
					const tempItem = {
						type: activeTool === 'draw-circle' ? 'circle' : 'rect',
						x: currentShape.x + currentShape.w / 2,
						y: currentShape.y + currentShape.h / 2,
						width: Math.abs( currentShape.w ),
						height: Math.abs( currentShape.h ),
						color: '#ff0000',
						opacity: 0.5,
					};
					drawItem( tempItem );

					// Drag guide
					ctx.strokeStyle = '#00f7ff';
					ctx.lineWidth = 1;
					ctx.strokeRect(
						currentShape.x,
						currentShape.y,
						currentShape.w,
						currentShape.h
					);
				}

				// Draw Mask Overlay
				mCtx.fillStyle = 'black';
				mCtx.fillRect( 0, 0, maskCanvas.width, maskCanvas.height );

				// Draw Crop Lines (Only if showUI)
				if ( showUI && cropRect ) {
					ctx.strokeStyle = '#00f7ff';
					ctx.lineWidth = Math.max( 2, canvas.width / 500 );
					ctx.setLineDash( [ 10 ] );
					ctx.strokeRect(
						cropRect.x,
						cropRect.y,
						cropRect.w,
						cropRect.h
					);
					ctx.setLineDash( [] );

					ctx.fillStyle = 'rgba(0,0,0,0.5)';
					ctx.fillRect( 0, 0, canvas.width, cropRect.y );
					ctx.fillRect(
						0,
						cropRect.y + cropRect.h,
						canvas.width,
						canvas.height - ( cropRect.y + cropRect.h )
					);
					ctx.fillRect( 0, cropRect.y, cropRect.x, cropRect.h );
					ctx.fillRect(
						cropRect.x + cropRect.w,
						cropRect.y,
						canvas.width - ( cropRect.x + cropRect.w ),
						cropRect.h
					);
				}
			},
			[
				activeTool,
				brightness,
				contrast,
				currentShape,
				overlay,
				rotation,
				saturation,
				cropRect,
			]
		);

		// Expose canvas to parent
		useImperativeHandle( ref, () => ( {
			getCanvas: () => canvasRef.current,
			getCleanDataURL: ( type ) => {
				// Draw without UI
				drawCanvas( false );
				const data = canvasRef.current.toDataURL( type );
				// Restore UI
				drawCanvas( true );
				return data;
			},
		} ) );

		// 1. Load Main Image
		useEffect( () => {
			const img = new Image();
			img.src = imageSrc;
			img.crossOrigin = 'Anonymous';
			img.onload = () => {
				imageRef.current = img;
				setCropRect( null );
				drawCanvas();
			};
		}, [ imageSrc, drawCanvas ] );

		// 2. Load Overlay Image (if watermark)
		useEffect( () => {
			if ( overlay && overlay.type === 'image' && overlay.src ) {
				const img = new Image();
				img.src = overlay.src;
				img.crossOrigin = 'Anonymous';
				img.onload = () => {
					overlayImageRef.current = img;
					drawCanvas();
				};
			} else {
				overlayImageRef.current = null;
			}
		}, [ overlay, drawCanvas ] );

		// 3. Redraw
		useEffect( () => {
			drawCanvas();
		}, [
			rotation,
			cropRect,
			brightness,
			contrast,
			saturation,
			overlay,
			currentShape,
			drawCanvas,
		] );

		const getMousePos = ( e ) => {
			const canvas = canvasRef.current;
			if ( ! canvas ) {
				return { x: 0, y: 0 };
			}
			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			return {
				x: ( e.clientX - rect.left ) * scaleX,
				y: ( e.clientY - rect.top ) * scaleY,
			};
		};

		const handleMouseDown = ( e ) => {
			const pos = getMousePos( e );

			// 1. Draw Shape Mode
			if ( activeTool === 'draw-rect' || activeTool === 'draw-circle' ) {
				setShapeStart( pos );
				setCurrentShape( { x: pos.x, y: pos.y, w: 0, h: 0 } );
				return;
			}

			if ( ! context ) {
				return;
			}

			// 2. Move / Drag Mode
			if ( activeTool === 'branding' && overlay ) {
				setIsDraggingOverlay( true );
				setDragStart( { x: pos.x, y: pos.y } );
				return;
			}

			if ( activeTool === 'move' ) {
				setIsPanning( true );
				setDragStart( { x: e.clientX, y: e.clientY } );
				return;
			}

			setIsDrawing( true );

			if ( activeTool === 'crop' ) {
				setCropStart( pos );
				setCropRect( { x: pos.x, y: pos.y, w: 0, h: 0 } );
			} else if (
				activeTool === 'brush' &&
				drawingEnabled &&
				maskContext
			) {
				context.beginPath();
				context.moveTo( pos.x, pos.y );
				context.lineCap = 'round';
				context.lineJoin = 'round';
				context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
				context.lineWidth = brushSize;

				maskContext.beginPath();
				maskContext.moveTo( pos.x, pos.y );
				maskContext.lineCap = 'round';
				maskContext.lineJoin = 'round';
				maskContext.strokeStyle = '#ffffff';
				maskContext.lineWidth = brushSize;
			}
		};

		const handleMouseMove = ( e ) => {
			// Shape Drawing
			if (
				shapeStart &&
				( activeTool === 'draw-rect' || activeTool === 'draw-circle' )
			) {
				const pos = getMousePos( e );
				let w = pos.x - shapeStart.x;
				let h = pos.y - shapeStart.y;

				if ( e.shiftKey ) {
					const s = Math.max( Math.abs( w ), Math.abs( h ) );
					w = w < 0 ? -s : s;
					h = h < 0 ? -s : s;
				}

				setCurrentShape( {
					x: shapeStart.x,
					y: shapeStart.y,
					w,
					h,
				} );
				return;
			}

			// Overlay Dragging
			if ( isDraggingOverlay && overlay ) {
				const pos = getMousePos( e );
				const dx = pos.x - dragStart.x;
				const dy = pos.y - dragStart.y;

				const newX = ( overlay.x || canvasRef.current.width / 2 ) + dx;
				const newY = ( overlay.y || canvasRef.current.height / 2 ) + dy;

				if ( onOverlayChange ) {
					onOverlayChange( { ...overlay, x: newX, y: newY } );
				}
				setDragStart( pos );
				return;
			}

			if ( isPanning && activeTool === 'move' ) {
				const dx = e.clientX - dragStart.x;
				const dy = e.clientY - dragStart.y;
				if ( onPanChange ) {
					onPanChange( { x: pan.x + dx, y: pan.y + dy } );
				}
				setDragStart( { x: e.clientX, y: e.clientY } );
				return;
			}

			if ( ! isDrawing || ! context ) {
				return;
			}
			const pos = getMousePos( e );

			if ( activeTool === 'crop' && cropStart ) {
				const w = pos.x - cropStart.x;
				const h = pos.y - cropStart.y;
				const x = w < 0 ? cropStart.x + w : cropStart.x;
				const y = h < 0 ? cropStart.y + h : cropStart.y;
				setCropRect( { x, y, w: Math.abs( w ), h: Math.abs( h ) } );
			} else if (
				activeTool === 'brush' &&
				drawingEnabled &&
				maskContext
			) {
				context.lineTo( pos.x, pos.y );
				context.stroke();
				maskContext.lineTo( pos.x, pos.y );
				maskContext.stroke();
			}
		};

		const handleMouseUp = () => {
			// Finish Shape Drawing
			if ( shapeStart && currentShape && onOverlayCreate ) {
				const w = Math.abs( currentShape.w );
				const h = Math.abs( currentShape.h );

				// Only create if it has some size
				if ( w > 5 && h > 5 ) {
					const newItem = {
						type: activeTool === 'draw-circle' ? 'circle' : 'rect',
						x: shapeStart.x + currentShape.w / 2, // Center X
						y: shapeStart.y + currentShape.h / 2, // Center Y
						width: w,
						height: h,
						size: Math.max( w, h ), // fallback
						color: '#ff0000',
						opacity: 1,
					};
					onOverlayCreate( newItem );
				}

				setShapeStart( null );
				setCurrentShape( null );
				return;
			}

			setIsDraggingOverlay( false );
			if ( isPanning ) {
				setIsPanning( false );
				return;
			}

			if ( ! isDrawing ) {
				return;
			}

			if ( activeTool === 'brush' && context && maskContext ) {
				context.closePath();
				maskContext.closePath();
				if ( onMaskChange && maskCanvasRef.current ) {
					onMaskChange(
						maskCanvasRef.current.toDataURL( 'image/png' )
					);
				}
			} else if ( activeTool === 'crop' && cropRect ) {
				if ( onCropChange ) {
					onCropChange( cropRect );
				}
			}

			setIsDrawing( false );
		};

		return (
			<div
				style={ {
					width: '100%',
					height: '100%',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					overflow: 'hidden',
					cursor: ( () => {
						if ( activeTool === 'move' ) {
							return isPanning ? 'grabbing' : 'grab';
						}
						if ( activeTool === 'branding' ) {
							return 'move';
						}
						return 'crosshair';
					} )(),
					padding: '20px',
					boxSizing: 'border-box',
				} }
			>
				<canvas
					ref={ canvasRef }
					onMouseDown={ handleMouseDown }
					onMouseMove={ handleMouseMove }
					onMouseUp={ handleMouseUp }
					onMouseLeave={ handleMouseUp }
					style={ {
						maxWidth: '100%',
						maxHeight: '100%',
						width: 'auto',
						height: 'auto',
						objectFit: 'contain',
						boxShadow: '0 0 20px rgba(0,0,0,0.5)',
						display: 'block',
						transform: `translate(${ pan.x }px, ${ pan.y }px) scale(${ zoom })`,
						transformOrigin: 'center',
						transition: isPanning
							? 'none'
							: 'transform 0.1s ease-out',
					} }
				/>
			</div>
		);
	}
);

export default CanvasWorkspace;
