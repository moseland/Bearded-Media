import { createHigherOrderComponent } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { addFilter } from '@wordpress/hooks';
import { useSelect, useDispatch } from '@wordpress/data';
import GenerateImageModal from '../components/GenerateImageModal';
import EditImageModal from '../components/EditImageModal';
import StockPhotoModal from '../components/StockPhotoModal';

/**
 * Filter to wrap the PostFeaturedImage component.
 */
const withFeaturedImageAI = createHigherOrderComponent(
	( OriginalComponent ) => {
		return ( props ) => {
			const [ isGenOpen, setIsGenOpen ] = useState( false );
			const [ isEditOpen, setIsEditOpen ] = useState( false );
			const [ isStockOpen, setIsStockOpen ] = useState( false );

			// Capabilities Check
			const caps = window.beardedMediaSettings?.capabilities || {};
			const canGenerate =
				caps.has_gemini || caps.has_stability || caps.has_bfl;
			const canStock = caps.has_pexels;

			const { featuredImageId, featuredImage } = useSelect(
				( select ) => {
					const imageId =
						select( 'core/editor' ).getEditedPostAttribute(
							'featured_media'
						);
					return {
						featuredImageId: imageId,
						featuredImage: imageId
							? select( 'core' ).getMedia( imageId )
							: null,
					};
				},
				[]
			);

			const { editPost } = useDispatch( 'core/editor' );

			const handleGenSuccess = ( media ) => {
				if ( media && media.id ) {
					editPost( { featured_media: media.id } );
				}
				setIsGenOpen( false );
			};

			const handleEditSuccess = ( attributes ) => {
				if ( attributes && attributes.id ) {
					editPost( { featured_media: attributes.id } );
				}
				setIsEditOpen( false );
			};

			const handleStockSuccess = ( media ) => {
				setIsStockOpen( false );
				if ( media && media.id ) {
					editPost( { featured_media: media.id } );
					if ( media.openInEditor ) {
						setTimeout( () => setIsEditOpen( true ), 100 );
					}
				}
			};

			return (
				<Fragment>
					<OriginalComponent { ...props } />

					<div
						style={ {
							marginTop: '10px',
							display: 'flex',
							gap: '8px',
							flexWrap: 'wrap',
						} }
					>
						{ canGenerate && (
							<Button
								variant="secondary"
								isSmall
								onClick={ () => setIsGenOpen( true ) }
							>
								Generate Image
							</Button>
						) }

						{ canStock && (
							<Button
								variant="secondary"
								isSmall
								onClick={ () => setIsStockOpen( true ) }
							>
								Stock Photos
							</Button>
						) }

						{ featuredImageId && featuredImage && (
							<Button
								variant="secondary"
								isSmall
								onClick={ () => setIsEditOpen( true ) }
							>
								Image Editor
							</Button>
						) }
					</div>

					{ isGenOpen && (
						<GenerateImageModal
							isOpen={ isGenOpen }
							onClose={ () => setIsGenOpen( false ) }
							setAttributes={ null }
							onSuccess={ handleGenSuccess }
						/>
					) }

					{ isEditOpen && featuredImage && (
						<EditImageModal
							isOpen={ isEditOpen }
							onClose={ () => setIsEditOpen( false ) }
							imageAttributes={ {
								id: featuredImage.id,
								url: featuredImage.source_url,
							} }
							setAttributes={ handleEditSuccess }
						/>
					) }

					{ isStockOpen && (
						<StockPhotoModal
							isOpen={ isStockOpen }
							onClose={ () => setIsStockOpen( false ) }
							onSuccess={ handleStockSuccess }
						/>
					) }
				</Fragment>
			);
		};
	},
	'withFeaturedImageAI'
);

export const registerFeaturedImageExtension = () => {
	addFilter(
		'editor.PostFeaturedImage',
		'bearded-media/featured-image-ai',
		withFeaturedImageAI
	);
};
