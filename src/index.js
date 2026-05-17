import {
	render,
	useState,
	useEffect,
	unmountComponentAtNode,
} from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import setupUploaderInterceptor from './uploader/interceptor';
import { registerBlockExtension } from './extensions/core-image-toolbar';
import { registerFeaturedImageExtension } from './extensions/featured-image-controls.js';
import './extensions/text-toolbar-extension.js';
import GenerateImageModal from './components/GenerateImageModal';
import GenerateVideoModal from './components/GenerateVideoModal';
import StockPhotoModal from './components/StockPhotoModal';
import EditImageModal from './components/EditImageModal';
import BulkToolsModal from './components/BulkToolsModal';
import { Button, Modal } from '@wordpress/components';
import SettingsScreen from './components/SettingsScreen';

console.log( 'Bearded Media: Index loaded.' );

// Helper to soft-refresh the WordPress Media Library grid
const refreshLibrary = () => {
	try {
		if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
			const content = wp.media.frame.content.get();
			if ( content && content.collection && content.collection.props ) {
				content.collection.props.set( { ignore: +new Date() } );
				return;
			}

			// Fallback: Try to find any active selection state
			const state = wp.media.frame.state();
			if ( state && state.get( 'library' ) ) {
				state.get( 'library' ).props.set( { ignore: +new Date() } );
				return;
			}
		}
	} catch ( e ) {
		console.warn(
			'Bearded Media: Soft library refresh failed, falling back to page reload.',
			e
		);
	}

	// Hard fallback reload
	window.location.reload();
};

const getCapabilities = () => {
	return (
		window.beardedMediaSettings?.capabilities || {
			gemini_key: false,
			stability_key: false,
			pexels_key: false,
			bfl_key: false,
			openai_key: false,
			openrouter_key: false,
		}
	);
};

// Backbone.js Interception helper to register custom editor hijack
const registerMediaLibraryOverrides = ( onTriggerAIEditor ) => {
	if (
		typeof wp === 'undefined' ||
		! wp.media ||
		! wp.media.view ||
		! wp.media.view.Attachment.Details
	) {
		return;
	}

	// 1. Hijack the Grid view & Modal Attachment Details view
	const originalEditAttachment =
		wp.media.view.Attachment.Details.prototype.editAttachment;

	wp.media.view.Attachment.Details.prototype.editAttachment = function (
		event
	) {
		if ( event ) {
			event.preventDefault();
			event.stopPropagation();
		}

		// Extract the current asset metadata straight from the Backbone view's model instance
		const attachmentId = this.model.id;
		const attachmentUrl = this.model.get( 'url' );
		const mimeType = this.model.get( 'mime' ) || '';

		// Only divert image assets to the AI workspace
		if ( mimeType.indexOf( 'image/' ) === 0 ) {
			onTriggerAIEditor( { id: attachmentId, url: attachmentUrl } );
		} else {
			// Fallback to default behavior if the asset is non-image (e.g. video crop hooks)
			originalEditAttachment.apply( this, arguments );
		}
	};

	// 2. Hijack the split Two-Column layout variant used across modern templates
	if ( wp.media.view.Attachment.Details.TwoColumn ) {
		wp.media.view.Attachment.Details.TwoColumn.prototype.editAttachment =
			wp.media.view.Attachment.Details.prototype.editAttachment;
	}
};

// Global container to mount custom React editor dynamically and wire event streams
const RootAIEditorContainer = () => {
	const [ activeImage, setActiveImage ] = useState( null );

	// Listen to the Backbone event stream wireup
	useEffect( () => {
		registerMediaLibraryOverrides( ( data ) => {
			setActiveImage( data );
		} );

		// Handle List-view click interactions (See Part 2 below)
		const handleListClick = ( e ) => {
			const target = e.target.closest( '.bearded-media-list-action' );
			if ( target ) {
				e.preventDefault();
				setActiveImage( {
					id: parseInt( target.getAttribute( 'data-id' ), 10 ),
					url: target.getAttribute( 'data-url' ),
				} );
			}
		};

		document.addEventListener( 'click', handleListClick );
		return () => document.removeEventListener( 'click', handleListClick );
	}, [] );

	if ( ! activeImage ) {
		return null;
	}

	return (
		<EditImageModal
			isOpen={ !! activeImage }
			onClose={ () => setActiveImage( null ) }
			imageAttributes={ activeImage }
			setAttributes={ () => {
				setActiveImage( null );
				refreshLibrary();
			} }
		/>
	);
};

// Header Actions (AI Assistant Gateway) inside the standalone Media Page
const HeaderControls = () => {
	const [ isGenOpen, setIsGenOpen ] = useState( false );
	const [ isGenVideoOpen, setIsGenVideoOpen ] = useState( false );
	const [ isGatewayOpen, setIsGatewayOpen ] = useState( false );
	const [ isStockOpen, setIsStockOpen ] = useState( false );
	const [ isEditOpen, setIsEditOpen ] = useState( false );
	const [ editAttributes, setEditAttributes ] = useState( null );

	const caps = getCapabilities();
	const canGenerate =
		caps.gemini_key ||
		caps.stability_key ||
		caps.bfl_key ||
		caps.openai_key ||
		caps.openrouter_key;
	const canStock = caps.pexels_key;

	const handleSuccess = ( data ) => {
		setIsGenOpen( false );
		setIsGenVideoOpen( false );
		setIsStockOpen( false );

		// Detect if saved resource is a video to block opening EditImageModal
		const isVideo =
			data &&
			( data.type === 'video' ||
				( data.url &&
					( data.url.endsWith( '.mp4' ) ||
						data.url.endsWith( '.webm' ) ) ) );

		if ( data && data.openInEditor && data.id && data.url && ! isVideo ) {
			setEditAttributes( { id: data.id, url: data.url } );
			setTimeout( () => setIsEditOpen( true ), 100 );
			return;
		}

		refreshLibrary();
	};

	const handleEditSave = () => {
		setIsEditOpen( false );
		setEditAttributes( null );
		refreshLibrary();
	};

	if ( ! canGenerate && ! canStock ) {
		return null;
	}

	return (
		<>
			{ canGenerate && (
				<Button
					variant="secondary"
					className="page-title-action"
					style={ { marginLeft: '0px' } }
					onClick={ ( e ) => {
						e.preventDefault();
						setIsGatewayOpen( true );
					} }
				>
					Generation Media
				</Button>
			) }

			{ canStock && (
				<Button
					variant="secondary"
					className="page-title-action"
					style={ { marginLeft: '8px' } }
					onClick={ ( e ) => {
						e.preventDefault();
						setIsStockOpen( true );
					} }
				>
					Stock Media
				</Button>
			) }

			{ isGatewayOpen && (
				<Modal
					title="AI Media Generation"
					onRequestClose={ () => setIsGatewayOpen( false ) }
					style={ { maxWidth: '340px' } }
				>
					<div
						style={ {
							display: 'flex',
							flexDirection: 'column',
							gap: '12px',
							padding: '10px 0',
						} }
					>
						<Button
							variant="primary"
							onClick={ () => {
								setIsGatewayOpen( false );
								setIsGenOpen( true );
							} }
							style={ { justifyContent: 'center' } }
						>
							Generate Image
						</Button>
						<Button
							variant="primary"
							onClick={ () => {
								setIsGatewayOpen( false );
								setIsGenVideoOpen( true );
							} }
							style={ { justifyContent: 'center' } }
						>
							Generate Video
						</Button>
					</div>
				</Modal>
			) }

			<GenerateImageModal
				isOpen={ isGenOpen }
				onClose={ () => setIsGenOpen( false ) }
				setAttributes={ null }
				onSuccess={ handleSuccess }
			/>

			<GenerateVideoModal
				isOpen={ isGenVideoOpen }
				onClose={ () => setIsGenVideoOpen( false ) }
				onSuccess={ handleSuccess }
			/>

			<StockPhotoModal
				isOpen={ isStockOpen }
				onClose={ () => setIsStockOpen( false ) }
				onSuccess={ handleSuccess }
				allowedType="any"
			/>

			{ isEditOpen && editAttributes && (
				<EditImageModal
					isOpen={ isEditOpen }
					onClose={ () => setIsEditOpen( false ) }
					imageAttributes={ editAttributes }
					setAttributes={ handleEditSave }
				/>
			) }
		</>
	);
};

// Bulk action controls
const BulkControls = () => {
	const [ isBulkOpen, setIsBulkOpen ] = useState( false );
	const [ selection, setSelection ] = useState( null );

	const handleBulkClick = ( e ) => {
		e.preventDefault();
		if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
			const sel = wp.media.frame.state().get( 'selection' );
			if ( sel && sel.length > 0 ) {
				setSelection( sel );
				setIsBulkOpen( true );
			} else {
				alert( 'Please select items in the grid first.' );
			}
		}
	};

	return (
		<>
			<button
				type="button"
				className="button media-button button-secondary button-large"
				style={ { margin: '10px' } }
				onClick={ handleBulkClick }
			>
				Bulk AI Tools
			</button>

			<BulkToolsModal
				isOpen={ isBulkOpen }
				onClose={ () => setIsBulkOpen( false ) }
				selection={ selection }
				onSuccess={ () => {
					refreshLibrary();
				} }
			/>
		</>
	);
};

// DOM Injection Observer logic
const injectHeaderButtons = () => {
	if ( ! window.beardedMediaSettings?.is_media_page ) {
		return;
	}

	const pageTitleAction =
		document.querySelector( '.wp-heading-inline' ) ||
		document.querySelector( 'h1.wp-heading-inline' ) ||
		document.querySelector( 'h1' );
	const existingContainer = document.querySelector(
		'.bearded-media-header-wrapper'
	);

	if ( pageTitleAction && ! existingContainer ) {
		const btnContainer = document.createElement( 'span' );
		btnContainer.className = 'bearded-media-header-wrapper';
		btnContainer.style.marginLeft = '10px';

		if ( pageTitleAction.nextSibling ) {
			pageTitleAction.parentNode.insertBefore(
				btnContainer,
				pageTitleAction.nextSibling
			);
		} else {
			pageTitleAction.parentNode.appendChild( btnContainer );
		}

		render( <HeaderControls />, btnContainer );
	}
};

const injectBulkButtons = () => {
	if ( ! window.beardedMediaSettings?.is_media_page ) {
		return;
	}

	const deleteBtn = document.querySelector( '.delete-selected-button' );
	const existingContainer = document.querySelector(
		'.bearded-media-bulk-wrapper'
	);
	const isDeleteVisible = deleteBtn && deleteBtn.offsetParent !== null;

	if ( isDeleteVisible ) {
		if ( ! existingContainer ) {
			const btnContainer = document.createElement( 'span' );
			btnContainer.className = 'bearded-media-bulk-wrapper';
			deleteBtn.parentNode.insertBefore( btnContainer, deleteBtn );
			render( <BulkControls />, btnContainer );
		}
	} else if ( existingContainer ) {
		unmountComponentAtNode( existingContainer );
		existingContainer.remove();
	}
};

const setupObservers = () => {
	injectHeaderButtons();

	const observer = new MutationObserver( ( mutations ) => {
		let shouldCheckBulk = false;

		for ( const mutation of mutations ) {
			if ( mutation.type === 'childList' ) {
				if (
					mutation.target.className &&
					mutation.target.className.includes( 'media-toolbar' )
				) {
					shouldCheckBulk = true;
				}
			}
		}

		injectHeaderButtons();
		if (
			shouldCheckBulk ||
			document.querySelector( '.delete-selected-button' )
		) {
			injectBulkButtons();
		}
	} );

	observer.observe( document.body, { childList: true, subtree: true } );
	console.log( 'Bearded Media: Observer monitoring initialized.' );
};

// Initialization hook
domReady( () => {
	if ( typeof wp !== 'undefined' && wp.Uploader ) {
		setupUploaderInterceptor();
	}

	setupObservers();

	// Load settings screen layout
	const settingsContainer = document.getElementById(
		'bearded-media-settings'
	);
	if ( settingsContainer ) {
		render( <SettingsScreen />, settingsContainer );
	}

	// Mount RootAIEditorContainer for Backbone interception & list view action handling
	const rootEditorContainer = document.createElement( 'div' );
	rootEditorContainer.id = 'bearded-media-root-editor';
	document.body.appendChild( rootEditorContainer );
	render( <RootAIEditorContainer />, rootEditorContainer );

	// Gutenberg Blocks Filter registration
	if ( typeof wp !== 'undefined' && wp.hooks ) {
		registerBlockExtension();
		registerFeaturedImageExtension();
	}
} );
