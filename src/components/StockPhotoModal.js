import {
	Modal,
	TextControl,
	Button,
	CheckboxControl,
	ButtonGroup,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

/**
 * Play Icon SVG overlay for Video thumbnails
 */
const PlayIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		style={ { verticalAlign: 'middle', marginRight: '4px' } }
	>
		<polygon points="5 3 19 12 5 21 5 3"></polygon>
	</svg>
);

/**
 * Media Grid Item component handling lightweight hover states
 * @param {Object}   root0
 * @param {Object}   root0.item
 * @param {string}   root0.type
 * @param {boolean}  root0.isSelected
 * @param {Function} root0.onSelect
 */
const MediaGridItem = ( { item, type, isSelected, onSelect } ) => {
	const [ isHovered, setIsHovered ] = useState( false );

	const isVideo = type === 'video';
	let thumbSrc = '';
	let altText = '';
	let previewVideo = null;

	if ( isVideo ) {
		thumbSrc = item.video_pictures?.[ 0 ]?.picture || '';
		altText = `Stock video by ${ item.user?.name || 'unknown' }`;

		// Sort video files ascending to find the smallest resolution for lightweight hover previews
		const previewFiles = [ ...( item.video_files || [] ) ].sort(
			( a, b ) => a.width * a.height - b.width * b.height
		);
		previewVideo = previewFiles[ 0 ]?.link;
	} else {
		thumbSrc = item.src?.medium || '';
		altText = item.alt || `Stock photo by ${ item.photographer }`;
	}

	return (
		<div
			onClick={ () => onSelect( item ) }
			onKeyDown={ ( e ) => {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					onSelect( item );
				}
			} }
			onMouseEnter={ () => setIsHovered( true ) }
			onMouseLeave={ () => setIsHovered( false ) }
			role="button"
			tabIndex={ 0 }
			aria-pressed={ isSelected }
			style={ {
				cursor: 'pointer',
				border: isSelected ? '4px solid #2271b1' : 'none',
				position: 'relative',
				height: '150px',
				overflow: 'hidden',
				background: '#e0e0e0',
				borderRadius: '4px',
				boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
				transition: 'transform 0.15s ease-in-out',
			} }
		>
			{ /* HTML5 loop preview triggered cleanly on hover without unmount race conditions */ }
			{ isVideo && isHovered && previewVideo ? (
				<video
					src={ previewVideo }
					autoPlay
					muted
					loop
					playsInline
					style={ {
						width: '100%',
						height: '100%',
						objectFit: 'cover',
					} }
				/>
			) : (
				<img
					src={ thumbSrc }
					alt={ altText }
					style={ {
						width: '100%',
						height: '100%',
						objectFit: 'cover',
					} }
				/>
			) }

			{ isVideo && (
				<div
					style={ {
						position: 'absolute',
						top: '8px',
						right: '8px',
						background: 'rgba(0,0,0,0.75)',
						color: '#fff',
						padding: '2px 6px',
						borderRadius: '3px',
						fontSize: '11px',
						fontWeight: '600',
						display: 'flex',
						alignItems: 'center',
						boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
					} }
				>
					<PlayIcon />
					{ item.duration ? `${ item.duration }s` : 'Video' }
				</div>
			) }

			<div
				style={ {
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					background:
						'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
					color: '#fff',
					fontSize: '10px',
					padding: '12px 8px 6px 8px',
					whiteSpace: 'nowrap',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					fontWeight: '500',
				} }
			>
				{ isVideo ? item.user?.name : item.photographer }
			</div>
		</div>
	);
};

/**
 * Main StockPhotoModal Dashboard Component
 * @param {Object}   root0
 * @param {boolean}  root0.isOpen
 * @param {Function} root0.onClose
 * @param {Function} root0.onSuccess
 * @param {string}   root0.allowedType
 */
const StockPhotoModal = ( {
	isOpen,
	onClose,
	onSuccess,
	allowedType = 'any',
} ) => {
	const initialType = allowedType === 'video' ? 'video' : 'photo';

	// Component States
	const [ searchType, setSearchType ] = useState( initialType );
	const [ query, setQuery ] = useState( '' );
	const [ photos, setPhotos ] = useState( [] );
	const [ videos, setVideos ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ page, setPage ] = useState( 1 );
	const [ selectedItem, setSelectedItem ] = useState( null );
	const [ isImporting, setIsImporting ] = useState( false );
	const [ openInEditor, setOpenInEditor ] = useState( false );

	if ( ! isOpen ) {
		return null;
	}

	/**
	 * Search handler for Photos and Videos
	 * @param {boolean} newSearch
	 */
	const handleSearch = async ( newSearch = false ) => {
		setIsLoading( true );
		const p = newSearch ? 1 : page;

		if ( newSearch ) {
			if ( searchType === 'photo' ) {
				setPhotos( [] );
			} else {
				setVideos( [] );
			}
			setSelectedItem( null );
		}

		try {
			const res = await apiFetch( {
				path: `/bearded-media/v1/stock-search?query=${ query }&page=${ p }&type=${ searchType }`,
			} );

			if ( searchType === 'photo' && res.photos ) {
				setPhotos( ( prev ) =>
					newSearch ? res.photos : [ ...prev, ...res.photos ]
				);
			} else if ( searchType === 'video' && res.videos ) {
				setVideos( ( prev ) =>
					newSearch ? res.videos : [ ...prev, ...res.videos ]
				);
			}

			// Fix pagination duplicate-page-fetch bug by setting next sequential page
			setPage( p + 1 );
		} catch ( e ) {
			console.error( 'Bearded Media Stock Search Error:', e );
		} finally {
			setIsLoading( false );
		}
	};

	/**
	 * Toggle between Photos & Videos tab views
	 * @param {string} type
	 */
	const handleTypeChange = ( type ) => {
		setSearchType( type );
		setPage( 1 );
		setSelectedItem( null );
	};

	/**
	 * Import and download selected asset directly to the WordPress Media Library
	 */
	const handleImport = async () => {
		if ( ! selectedItem ) {
			return;
		}
		setIsImporting( true );
		try {
			let mediaUrl = '';

			if ( searchType === 'photo' ) {
				mediaUrl =
					selectedItem.src.large2x || selectedItem.src.original;
			} else {
				// Sort descending to find the highest resolution video file link
				const sortedFiles = [
					...( selectedItem.video_files || [] ),
				].sort( ( a, b ) => b.width * b.height - a.width * a.height );
				mediaUrl = sortedFiles[ 0 ]?.link;
			}

			if ( ! mediaUrl ) {
				throw new Error(
					'Could not extract a valid media asset link.'
				);
			}

			const response = await apiFetch( {
				path: '/bearded-media/v1/save-image',
				method: 'POST',
				data: {
					image_url: mediaUrl,
					media_type: searchType,
				},
			} );

			if ( response.id ) {
				if ( onSuccess ) {
					onSuccess( { ...response, openInEditor } );
				}
				onClose();
			} else {
				throw new Error(
					'Save controller failed to return attachment details.'
				);
			}
		} catch ( e ) {
			console.error( 'Bearded Media: Pexels Import Error', e );
			alert(
				'Import failed: ' +
					( e.message ||
						'Unknown error occurred. Please check system logs.' )
			);
		} finally {
			setIsImporting( false );
		}
	};

	const currentItems = searchType === 'photo' ? photos : videos;

	return (
		<Modal
			title={ `Pexels Stock ${
				searchType === 'video' ? 'Videos' : 'Photos'
			}` }
			onRequestClose={ onClose }
			style={ { width: '85vw', height: '80vh' } }
		>
			<div
				style={ {
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
				} }
			>
				{ /* Selective visibility for Media type selector tags based on allowed field limits */ }
				{ allowedType === 'any' && (
					<div style={ { marginBottom: '16px' } }>
						<ButtonGroup>
							<Button
								variant={
									searchType === 'photo'
										? 'primary'
										: 'secondary'
								}
								onClick={ () => handleTypeChange( 'photo' ) }
								style={ {
									minWidth: '80px',
									justifyContent: 'center',
								} }
							>
								Photos
							</Button>
							<Button
								variant={
									searchType === 'video'
										? 'primary'
										: 'secondary'
								}
								onClick={ () => handleTypeChange( 'video' ) }
								style={ {
									minWidth: '80px',
									justifyContent: 'center',
								} }
							>
								Videos
							</Button>
						</ButtonGroup>
					</div>
				) }

				<div
					style={ {
						display: 'flex',
						gap: '12px',
						marginBottom: '20px',
					} }
				>
					<TextControl
						value={ query }
						onChange={ setQuery }
						placeholder={ `Search Pexels for ${
							searchType === 'video' ? 'videos' : 'photos'
						}...` }
						onKeyDown={ ( e ) =>
							e.key === 'Enter' && handleSearch( true )
						}
					/>
					<Button
						variant="primary"
						onClick={ () => handleSearch( true ) }
						isBusy={ isLoading }
						style={ { minWidth: '90px', justifyContent: 'center' } }
					>
						Search
					</Button>
				</div>

				{ /* Scrollable Asset Presentation Grid */ }
				<div
					style={ {
						flex: 1,
						overflowY: 'auto',
						display: 'grid',
						gridTemplateColumns:
							'repeat(auto-fill, minmax(180px, 1fr))',
						gap: '12px',
						padding: '12px',
						background: '#f6f7f7',
						border: '1px solid #dcdcde',
						borderRadius: '4px',
					} }
				>
					{ currentItems.map( ( item ) => (
						<MediaGridItem
							key={ item.id }
							item={ item }
							type={ searchType }
							isSelected={ selectedItem?.id === item.id }
							onSelect={ setSelectedItem }
						/>
					) ) }

					{ currentItems.length > 0 && (
						<div
							style={ {
								gridColumn: '1 / -1',
								textAlign: 'center',
								padding: '24px',
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
						borderTop: '1px solid #dcdcde',
						paddingTop: '15px',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
					} }
				>
					<div>
						{ searchType !== 'video' && (
							<CheckboxControl
								label="Open in Editor after import"
								checked={ openInEditor }
								onChange={ setOpenInEditor }
							/>
						) }
					</div>
					<div style={ { display: 'flex', gap: '12px' } }>
						<Button variant="secondary" onClick={ onClose }>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={ ! selectedItem }
							isBusy={ isImporting }
							onClick={ handleImport }
							style={ {
								minWidth: '130px',
								justifyContent: 'center',
							} }
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
