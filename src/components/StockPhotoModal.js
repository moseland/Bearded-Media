import {
	Modal,
	TextControl,
	Button,
	CheckboxControl,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const StockPhotoModal = ( { isOpen, onClose, onSuccess } ) => {
	const [ query, setQuery ] = useState( '' );
	const [ images, setImages ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ page, setPage ] = useState( 1 );
	const [ selectedImage, setSelectedImage ] = useState( null );
	const [ isImporting, setIsImporting ] = useState( false );
	const [ openInEditor, setOpenInEditor ] = useState( false );

	if ( ! isOpen ) {
		return null;
	}

	const handleSearch = async ( newSearch = false ) => {
		setIsLoading( true );
		const p = newSearch ? 1 : page;
		if ( newSearch ) {
			setImages( [] );
			setPage( 1 );
		}

		try {
			const res = await apiFetch( {
				path: `/bearded-media/v1/stock-search?query=${ query }&page=${ p }`,
			} );
			if ( res.photos ) {
				setImages( ( prev ) =>
					newSearch ? res.photos : [ ...prev, ...res.photos ]
				);
				if ( ! newSearch ) {
					setPage( ( prev ) => prev + 1 );
				}
			}
		} catch ( e ) {
			console.error( e );
		} finally {
			setIsLoading( false );
		}
	};

	const handleImport = async () => {
		if ( ! selectedImage ) {
			return;
		}
		setIsImporting( true );
		try {
			// Use the "large2x" with "original" size as fallback for quality
			const imageUrl =
				selectedImage.src.large2x || selectedImage.src.original;

			const response = await apiFetch( {
				path: '/bearded-media/v1/save-image',
				method: 'POST',
				data: { image_url: imageUrl },
			} );

			if ( response.id ) {
				if ( onSuccess ) {
					onSuccess( { ...response, openInEditor } );
				}
				onClose();
			}
		} catch ( e ) {
			console.error( 'Bearded Media: Pexels Import Error', e );
			alert(
				'Import failed: ' +
					( e.message || 'Unknown error. check console.' )
			);
		} finally {
			setIsImporting( false );
		}
	};

	return (
		<Modal
			title="Pexels Stock Photos"
			onRequestClose={ onClose }
			style={ { width: '80vw', height: '80vh' } }
		>
			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
				} }
			>
				<div
					style={ {
						display: 'flex',
						gap: '10px',
						marginBottom: '20px',
					} }
				>
					<TextControl
						value={ query }
						onChange={ setQuery }
						placeholder="Search for photos..."
						onKeyDown={ ( e ) =>
							e.key === 'Enter' && handleSearch( true )
						}
					/>
					<Button
						variant="primary"
						onClick={ () => handleSearch( true ) }
						isBusy={ isLoading }
					>
						Search
					</Button>
				</div>

				<div
					style={ {
						flex: 1,
						overflowY: 'auto',
						display: 'grid',
						gridTemplateColumns:
							'repeat(auto-fill, minmax(150px, 1fr))',
						gap: '10px',
						padding: '10px',
						background: '#f0f0f0',
					} }
				>
					{ images.map( ( img ) => (
						<div
							key={ img.id }
							onClick={ () => setSelectedImage( img ) }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' || e.key === ' ' ) {
									setSelectedImage( img );
								}
							} }
							role="button"
							tabIndex={ 0 }
							aria-pressed={ selectedImage?.id === img.id }
							style={ {
								cursor: 'pointer',
								border:
									selectedImage?.id === img.id
										? '4px solid #2271b1'
										: 'none',
								position: 'relative',
								height: '150px',
							} }
						>
							<img
								src={ img.src.medium }
								alt={
									img.alt ||
									`Stock photo by ${ img.photographer }`
								}
								style={ {
									width: '100%',
									height: '100%',
									objectFit: 'cover',
								} }
							/>
							<div
								style={ {
									position: 'absolute',
									bottom: 0,
									left: 0,
									right: 0,
									background: 'rgba(0,0,0,0.5)',
									color: '#fff',
									fontSize: '10px',
									padding: '4px',
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
								} }
							>
								{ img.photographer }
							</div>
						</div>
					) ) }
					{ images.length > 0 && (
						<div
							style={ {
								gridColumn: '1 / -1',
								textAlign: 'center',
								padding: '20px',
							} }
						>
							<Button
								variant="secondary"
								onClick={ () => handleSearch( false ) }
								isBusy={ isLoading }
							>
								Load More
							</Button>
						</div>
					) }
				</div>

				<div
					style={ {
						marginTop: '20px',
						borderTop: '1px solid #ddd',
						paddingTop: '15px',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					} }
				>
					<CheckboxControl
						label="Open in Editor after import"
						checked={ openInEditor }
						onChange={ setOpenInEditor }
					/>
					<div style={ { display: 'flex', gap: '10px' } }>
						<Button variant="secondary" onClick={ onClose }>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={ ! selectedImage }
							isBusy={ isImporting }
							onClick={ handleImport }
						>
							Import Selected
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default StockPhotoModal;
