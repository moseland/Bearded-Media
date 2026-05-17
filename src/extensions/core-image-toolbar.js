import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import {
	ToolbarGroup,
	ToolbarButton,
	PanelBody,
	Button,
	Modal,
} from '@wordpress/components';
import { addFilter } from '@wordpress/hooks';
import GenModal from '../components/GenerateImageModal';
import GenerateVideoModal from '../components/GenerateVideoModal';
import EditModal from '../components/EditImageModal';
import StockModal from '../components/StockPhotoModal';

const beardIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		fill="currentColor"
	>
		<path d="M12 22C6.477 22 2 17.523 2 12c0-1.822.487-3.53 1.338-5.002C3.998 8.63 5.4 9.5 7 9.5c1.47 0 2.783-.727 3.606-1.83.696.533 1.564.83 2.494.83.93 0 1.8-.297 2.494-.83.823 1.103 2.136 1.83 3.606 1.83 1.6 0 3.002-.87 3.662-2.502C23.513 8.47 24 10.178 24 12c0 5.523-4.477 10-10 10z" />
	</svg>
);

/**
 * Context-Aware Helper to Map Media Attributes smoothly matching block schema rules
 * @param {string}   blockName
 * @param {Object}   media
 * @param {Function} setAttributes
 */
const updateBlockAttributes = ( blockName, media, setAttributes ) => {
	if ( ! media || ! media.id ) {
		return;
	}

	const mediaId = media.id;
	const mediaUrl = media.url;
	const isVideo =
		media.type === 'video' ||
		( media.url &&
			( media.url.endsWith( '.mp4' ) || media.url.endsWith( '.webm' ) ) );

	if ( blockName === 'core/image' ) {
		setAttributes( {
			id: mediaId,
			url: mediaUrl,
			alt: media.alt || media.title || '',
		} );
	} else if ( blockName === 'core/video' ) {
		setAttributes( {
			id: mediaId,
			src: mediaUrl,
		} );
	} else if ( blockName === 'core/cover' ) {
		setAttributes( {
			id: mediaId,
			url: mediaUrl,
		} );
	} else if ( blockName === 'core/file' ) {
		setAttributes( {
			id: mediaId,
			href: mediaUrl,
			fileName: media.title || 'Generated File',
		} );
	} else if ( blockName === 'core/media-text' ) {
		setAttributes( {
			mediaId,
			mediaUrl,
			mediaType: isVideo ? 'video' : 'image',
		} );
	}
};

/**
 * Higher Order Component to register context-specific AI controls to supported blocks
 */
const withAIControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const allowedBlocks = [
			'core/image',
			'core/video',
			'core/cover',
			'core/file',
			'core/media-text',
		];

		if ( ! allowedBlocks.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		const { attributes, setAttributes, isSelected } = props;
		const [ isGenOpen, setIsGenOpen ] = useState( false );
		const [ isGenVideoOpen, setIsGenVideoOpen ] = useState( false );
		const [ isGatewayOpen, setIsGatewayOpen ] = useState( false );
		const [ isEditOpen, setIsEditOpen ] = useState( false );
		const [ isStockOpen, setIsStockOpen ] = useState( false );

		// Configure context boundaries dynamically
		let allowedType = 'any';
		if ( props.name === 'core/image' || props.name === 'core/cover' ) {
			allowedType = 'image';
		} else if ( props.name === 'core/video' ) {
			allowedType = 'video';
		} else {
			allowedType = 'any';
		}

		const caps = window.beardedMediaSettings?.capabilities || {};
		const canGenerate =
			caps.gemini_key ||
			caps.stability_key ||
			caps.bfl_key ||
			caps.openai_key ||
			caps.openrouter_key;
		const canStock = caps.pexels_key;

		const hasMedia =
			!! attributes.url ||
			!! attributes.src ||
			!! attributes.mediaUrl ||
			!! attributes.href;

		const handleOpen = () => {
			if ( hasMedia && allowedType === 'image' ) {
				setIsEditOpen( true );
			} else if ( allowedType === 'image' ) {
				setIsGenOpen( true );
			} else if ( allowedType === 'video' ) {
				setIsGenVideoOpen( true );
			} else if ( allowedType === 'any' ) {
				setIsGatewayOpen( true );
			}
		};

		const handleSuccess = ( data ) => {
			setIsGenOpen( false );
			setIsGenVideoOpen( false );
			setIsStockOpen( false );

			if ( data && data.id ) {
				updateBlockAttributes( props.name, data, setAttributes );

				// Open canvas inside Image editor if verified as an image asset
				const isVideo =
					data.type === 'video' ||
					( data.url &&
						( data.url.endsWith( '.mp4' ) ||
							data.url.endsWith( '.webm' ) ) );
				if ( data.openInEditor && ! isVideo ) {
					setTimeout( () => setIsEditOpen( true ), 100 );
				}
			}
		};

		const label =
			hasMedia && allowedType === 'image'
				? 'Edit Image'
				: 'Generate Media';

		if ( ! canGenerate && ! canStock && ! hasMedia ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<Fragment>
				{ isSelected && (
					<>
						<BlockControls>
							<ToolbarGroup>
								{ ( hasMedia || canGenerate ) && (
									<ToolbarButton
										icon={ beardIcon }
										label={ label }
										onClick={ handleOpen }
										showTooltip={ true }
									/>
								) }
								{ ! hasMedia && canStock && (
									<ToolbarButton
										icon="format-gallery"
										label="Stock Media"
										onClick={ () => setIsStockOpen( true ) }
									/>
								) }
							</ToolbarGroup>
						</BlockControls>
						<InspectorControls>
							<PanelBody
								title="Bearded Media"
								initialOpen={ true }
							>
								<div
									style={ {
										display: 'flex',
										flexDirection: 'column',
										gap: '10px',
									} }
								>
									{ ( hasMedia || canGenerate ) && (
										<Button
											variant="secondary"
											icon={ beardIcon }
											onClick={ handleOpen }
											style={ {
												width: '100%',
												justifyContent: 'center',
											} }
										>
											{ label }
										</Button>
									) }

									{ ! hasMedia && canStock && (
										<Button
											variant="secondary"
											icon="format-gallery"
											onClick={ () =>
												setIsStockOpen( true )
											}
											style={ {
												width: '100%',
												justifyContent: 'center',
											} }
										>
											Stock Media
										</Button>
									) }
								</div>
							</PanelBody>
						</InspectorControls>
					</>
				) }

				<GenModal
					isOpen={ isGenOpen }
					onClose={ () => setIsGenOpen( false ) }
					onSuccess={ handleSuccess }
				/>

				<GenerateVideoModal
					isOpen={ isGenVideoOpen }
					onClose={ () => setIsGenVideoOpen( false ) }
					onSuccess={ handleSuccess }
				/>

				{ isGatewayOpen && (
					<Modal
						title="AI Assistant Gateway"
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
								AI Image Assistant
							</Button>
							<Button
								variant="primary"
								onClick={ () => {
									setIsGatewayOpen( false );
									setIsGenVideoOpen( true );
								} }
								style={ { justifyContent: 'center' } }
							>
								AI Video Assistant
							</Button>
						</div>
					</Modal>
				) }

				<EditModal
					isOpen={ isEditOpen }
					onClose={ () => setIsEditOpen( false ) }
					imageAttributes={ attributes }
					setAttributes={ setAttributes }
				/>

				<StockModal
					isOpen={ isStockOpen }
					onClose={ () => setIsStockOpen( false ) }
					onSuccess={ handleSuccess }
					allowedType={ allowedType }
				/>

				<BlockEdit { ...props } />
			</Fragment>
		);
	};
}, 'withAIControls' );

export const registerBlockExtension = () => {
	addFilter(
		'editor.BlockEdit',
		'bearded-media/image-ai-controls',
		withAIControls
	);
};
