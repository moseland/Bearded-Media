import { render, useState, unmountComponentAtNode } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import setupUploaderInterceptor from './uploader/interceptor';
import { registerBlockExtension } from './extensions/core-image-toolbar';
import { registerFeaturedImageExtension } from './extensions/featured-image-controls.js';
import GenerateImageModal from './components/GenerateImageModal';
import StockPhotoModal from './components/StockPhotoModal';
import EditImageModal from './components/EditImageModal';
import BulkToolsModal from './components/BulkToolsModal';
import { Button } from '@wordpress/components';
import SettingsScreen from './components/SettingsScreen';

console.log( 'Bearded Media: Index loaded.' );

// Helpers
const refreshLibrary = () => {
	try {
		if ( typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
			const content = wp.media.frame.content.get();
			if ( content && content.collection && content.collection.props ) {
				content.collection.props.set( { ignore: +new Date() } );
				return;
			}

			// Fallback: Try to find any active collection
			const state = wp.media.frame.state();
			if ( state && state.get( 'library' ) ) {
				state.get( 'library' ).props.set( { ignore: +new Date() } );
				return;
			}
		}
	} catch ( e ) {
		console.warn(
			'Bearded Media: Soft refresh failed, falling back to reload.',
			e
		);
	}

	// Hard fallback
	window.location.reload();
};

const getCapabilities = () => {
	return (
		window.beardedMediaSettings?.capabilities || {
			gemini_key: false,
			stability_key: false,
			pexels_key: false,
			bfl_key: false,
		}
	);
};

// Components
// Sidebar Injector Component (Sidebar Button)
const SidebarInjector = ( { attachmentId, attachmentUrl } ) => {
	const [ isEditOpen, setIsEditOpen ] = useState( false );

	const handleSuccess = () => {
		setIsEditOpen( false );
		refreshLibrary();
	};

	return (
		<>
			<Button
				variant="secondary"
				isSmall
				onClick={ () => setIsEditOpen( true ) }
				style={ {
					width: '100%',
					marginBottom: '10px',
					justifyContent: 'center',
				} }
			>
				Open in AI Editor
			</Button>

			{ isEditOpen && (
				<EditImageModal
					isOpen={ isEditOpen }
					onClose={ () => setIsEditOpen( false ) }
					imageAttributes={ { id: attachmentId, url: attachmentUrl } }
					setAttributes={ handleSuccess }
				/>
			) }
		</>
	);
};

// Header Controls (Generate / Stock)
const HeaderControls = () => {
	const [ isGenOpen, setIsGenOpen ] = useState( false );
	const [ isStockOpen, setIsStockOpen ] = useState( false );
	const [ isEditOpen, setIsEditOpen ] = useState( false );
	const [ editAttributes, setEditAttributes ] = useState( null );

	const caps = getCapabilities();
	const canGenerate = caps.gemini_key || caps.stability_key || caps.bfl_key;
	const canStock = caps.pexels_key;

	const handleSuccess = ( data ) => {
		setIsGenOpen( false );
		setIsStockOpen( false );

		if ( data && data.openInEditor && data.id && data.url ) {
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
						setIsGenOpen( true );
					} }
				>
					Generate Image
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
					Stock Photos
				</Button>
			) }

			<GenerateImageModal
				isOpen={ isGenOpen }
				onClose={ () => setIsGenOpen( false ) }
				setAttributes={ null }
				onSuccess={ handleSuccess }
			/>

			<StockPhotoModal
				isOpen={ isStockOpen }
				onClose={ () => setIsStockOpen( false ) }
				onSuccess={ handleSuccess }
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
				alert( 'Please select images in the grid first.' );
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

// Dom Observer & Injection Logic
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

const injectSidebarButton = () => {
	const detailsContainer = document.querySelector( '.attachment-details' );
	if ( ! detailsContainer ) {
		return;
	}

	const editLink = detailsContainer.querySelector( '.edit-attachment' );

	if ( editLink && typeof wp !== 'undefined' && wp.media && wp.media.frame ) {
		const selection = wp.media.frame.state().get( 'selection' );
		if ( ! selection ) {
			return;
		}
		const singleSelection = selection.single();
		if ( ! singleSelection ) {
			return;
		}

		const attachmentId = singleSelection.id;
		const attachmentUrl = singleSelection.attributes.url;
		const containerId = `bearded-sidebar-injector-${ attachmentId }`;
		let existingContainer = document.getElementById( containerId );

		const currentIdAttr = existingContainer
			? existingContainer.getAttribute( 'data-id' )
			: null;
		if ( existingContainer && currentIdAttr !== String( attachmentId ) ) {
			unmountComponentAtNode( existingContainer );
			existingContainer.remove();
			existingContainer = null;
		}

		if ( ! existingContainer ) {
			const container = document.createElement( 'div' );
			container.id = containerId;
			container.setAttribute( 'data-id', attachmentId );
			container.className = 'bearded-sidebar-container';

			const insertionTarget = editLink.closest( '.setting' ) || editLink;
			if ( insertionTarget && insertionTarget.parentNode ) {
				insertionTarget.parentNode.insertBefore(
					container,
					insertionTarget
				);
				render(
					<SidebarInjector
						attachmentId={ attachmentId }
						attachmentUrl={ attachmentUrl }
					/>,
					container
				);
			}
		}
	}
};

const setupObservers = () => {
	injectHeaderButtons();

	const observer = new MutationObserver( ( mutations ) => {
		let shouldCheckSidebar = false;
		let shouldCheckBulk = false;

		for ( const mutation of mutations ) {
			if ( mutation.type === 'childList' ) {
				if (
					mutation.target.classList &&
					( mutation.target.classList.contains( 'media-modal' ) ||
						mutation.target.classList.contains(
							'media-frame-content'
						) )
				) {
					shouldCheckSidebar = true;
				}
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
			shouldCheckSidebar ||
			document.querySelector( '.attachment-details' )
		) {
			injectSidebarButton();
		}
		if (
			shouldCheckBulk ||
			document.querySelector( '.delete-selected-button' )
		) {
			injectBulkButtons();
		}
	} );

	observer.observe( document.body, { childList: true, subtree: true } );
	console.log( 'Bearded Media: UI Observer started.' );
};

// Initialize
domReady( () => {
	// Setup Uploader Hook
	if ( typeof wp !== 'undefined' && wp.Uploader ) {
		setupUploaderInterceptor();
	}

	// Setup UI Injection
	setupObservers();

	// Render Settings Page if we are on it
	const settingsContainer = document.getElementById(
		'bearded-media-settings'
	);
	if ( settingsContainer ) {
		render( <SettingsScreen />, settingsContainer );
	}

	// Gutenberg Block Extensions
	if ( typeof wp !== 'undefined' && wp.hooks ) {
		registerBlockExtension();
		registerFeaturedImageExtension();
	}
} );
