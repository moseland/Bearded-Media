import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import {
	ToolbarGroup,
	ToolbarButton,
	PanelBody,
	Button,
} from '@wordpress/components';
import { addFilter } from '@wordpress/hooks';
import GenModal from '../components/GenerateImageModal';
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

const withAIControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( props.name !== 'core/image' ) {
			return <BlockEdit { ...props } />;
		}

		const { attributes, setAttributes, isSelected } = props;
		const [ isGenOpen, setIsGenOpen ] = useState( false );
		const [ isEditOpen, setIsEditOpen ] = useState( false );
		const [ isStockOpen, setIsStockOpen ] = useState( false );

		// Capabilities Check
		const caps = window.beardedMediaSettings?.capabilities || {};
		const canGenerate =
			caps.gemini_key || caps.stability_key || caps.bfl_key;
		const canStock = caps.pexels_key;

		const hasImage = !! attributes.url;
		const handleOpen = () => {
			if ( hasImage ) {
				setIsEditOpen( true );
			} else {
				setIsGenOpen( true );
			}
		};

		const handleStockSuccess = ( data ) => {
			setIsStockOpen( false );
			if ( data.id ) {
				setAttributes( {
					id: data.id,
					url: data.url,
					alt: data.alt || '',
				} );
				if ( data.openInEditor ) {
					setTimeout( () => setIsEditOpen( true ), 100 );
				}
			}
		};

		const label = hasImage ? 'Edit Image' : 'Generate Image';

		// Don't render toolbar if no features available
		if ( ! canGenerate && ! canStock && ! hasImage ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<Fragment>
				{ isSelected && (
					<>
						<BlockControls>
							<ToolbarGroup>
								{ ( hasImage || canGenerate ) && (
									<ToolbarButton
										icon={ beardIcon }
										label={ label }
										onClick={ handleOpen }
										showTooltip={ true }
									/>
								) }
								{ ! hasImage && canStock && (
									<ToolbarButton
										icon="format-gallery"
										label="Stock Photos"
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
									{ ( hasImage || canGenerate ) && (
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

									{ ! hasImage && canStock && (
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
											Stock Photos
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
					setAttributes={ setAttributes }
				/>

				<EditModal
					isOpen={ isEditOpen }
					onClose={ () => setIsEditOpen( false ) }
					imageAttributes={ attributes }
					setAttributes={ setAttributes }
				/>

				<StockModal
					isOpen={ isStockOpen }
					onClose={ () => setIsStockOpen( false ) }
					onSuccess={ handleStockSuccess }
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
