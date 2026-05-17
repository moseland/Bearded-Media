import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	Modal,
	Button,
	SelectControl,
	TextareaControl,
	Spinner,
	Notice,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

export default function GenerateTextModal( { isOpen, onClose, onInsertText } ) {
	const [ modelsCatalog, setModelsCatalog ] = useState( [] );
	const [ providers, setProviders ] = useState( [] );
	const [ selectedProvider, setSelectedProvider ] = useState( '' );
	const [ selectedModel, setSelectedModel ] = useState( '' );
	const [ prompt, setPrompt ] = useState( '' );
	const [ generatedText, setGeneratedText ] = useState( '' );
	const [ isProcessing, setIsProcessing ] = useState( false );
	const [ isLoaded, setIsLoaded ] = useState( false );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		let isMounted = true;

		apiFetch( { path: '/bearded-media/v1/available-models' } )
			.then( ( response ) => {
				if ( ! isMounted ) {
					return;
				}

				const textModels = response.filter(
					( m ) => m.capability === 'text'
				);
				setModelsCatalog( textModels );

				const uniqueProviders = [
					...new Set( textModels.map( ( m ) => m.provider ) ),
				];

				const providerOptions = uniqueProviders.map( ( p ) => ( {
					label: p.charAt( 0 ).toUpperCase() + p.slice( 1 ),
					value: p,
				} ) );

				setProviders( providerOptions );

				if ( providerOptions.length > 0 ) {
					const firstProvider = providerOptions[ 0 ].value;
					setSelectedProvider( firstProvider );

					const modelsForProvider = textModels.filter(
						( m ) => m.provider === firstProvider
					);
					if ( modelsForProvider.length > 0 ) {
						setSelectedModel( modelsForProvider[ 0 ].value );
					}
				}
				setIsLoaded( true );
			} )
			.catch( ( err ) => {
				if ( isMounted ) {
					setError(
						err.message ||
							__( 'Failed to load models.', 'bearded-media' )
					);
					setIsLoaded( true );
				}
			} );

		return () => {
			isMounted = false;
		};
	}, [ isOpen ] );

	useEffect( () => {
		if ( selectedProvider && modelsCatalog.length > 0 ) {
			const modelsForProvider = modelsCatalog.filter(
				( m ) => m.provider === selectedProvider
			);
			if ( modelsForProvider.length > 0 ) {
				setSelectedModel( modelsForProvider[ 0 ].value );
			} else {
				setSelectedModel( '' );
			}
		}
	}, [ selectedProvider, modelsCatalog ] );

	const handleGenerate = async () => {
		if ( ! prompt || ! selectedModel ) {
			return;
		}

		setIsProcessing( true );
		setError( null );
		setGeneratedText( '' );

		try {
			const response = await apiFetch( {
				path: '/bearded-media/v1/run-task',
				method: 'POST',
				data: {
					task: 'generate-text',
					prompt,
					model: selectedModel,
					provider: selectedProvider,
				},
			} );

			if ( response.status === 'completed' && response.text ) {
				setGeneratedText( response.text );
			} else {
				setError(
					__(
						'Generation completed but no text was returned.',
						'bearded-media'
					)
				);
			}
		} catch ( err ) {
			setError(
				err.message ||
					__(
						'An error occurred during generation.',
						'bearded-media'
					)
			);
		} finally {
			setIsProcessing( false );
		}
	};

	if ( ! isOpen ) {
		return null;
	}

	const currentProviderModels = modelsCatalog
		.filter( ( m ) => m.provider === selectedProvider )
		.map( ( m ) => ( { label: m.label, value: m.value } ) );

	return (
		<Modal
			title={ __( 'AI Text Generation Assistant', 'bearded-media' ) }
			onRequestClose={ onClose }
			style={ { width: '600px', maxWidth: '100%' } }
		>
			<div className="bearded-media-text-gen-modal">
				{ error && (
					<Notice
						status="error"
						isDismissible={ false }
						style={ { marginBottom: '16px' } }
					>
						{ error }
					</Notice>
				) }

				<div
					style={ {
						display: 'flex',
						gap: '16px',
						marginBottom: '16px',
					} }
				>
					<div style={ { flex: 1 } }>
						<SelectControl
							label={ __( 'Provider', 'bearded-media' ) }
							value={ selectedProvider }
							options={
								providers.length > 0
									? providers
									: [
											{
												label: isLoaded
													? __(
															'No providers',
															'bearded-media'
													  )
													: __(
															'Loading…',
															'bearded-media'
													  ),
												value: '',
											},
									  ]
							}
							onChange={ setSelectedProvider }
							disabled={ isProcessing || providers.length === 0 }
						/>
					</div>
					<div style={ { flex: 1 } }>
						<SelectControl
							label={ __( 'AI Model', 'bearded-media' ) }
							value={ selectedModel }
							options={
								currentProviderModels.length > 0
									? currentProviderModels
									: [
											{
												label: isLoaded
													? __(
															'No models',
															'bearded-media'
													  )
													: __(
															'Loading…',
															'bearded-media'
													  ),
												value: '',
											},
									  ]
							}
							onChange={ setSelectedModel }
							disabled={
								isProcessing ||
								currentProviderModels.length === 0
							}
						/>
					</div>
				</div>

				<TextareaControl
					label={ __( 'Prompt', 'bearded-media' ) }
					value={ prompt }
					onChange={ setPrompt }
					placeholder={ __(
						'Write a catchy introduction paragraph about…',
						'bearded-media'
					) }
					rows={ 4 }
					disabled={ isProcessing }
				/>

				{ isProcessing && (
					<div
						style={ {
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							padding: '20px 0',
						} }
					>
						<Spinner />
					</div>
				) }

				{ generatedText && ! isProcessing && (
					<div style={ { marginTop: '20px' } }>
						<h3
							style={ {
								margin: '0 0 10px 0',
								fontSize: '14px',
								fontWeight: '600',
							} }
						>
							{ __( 'Generated Text', 'bearded-media' ) }
						</h3>
						<div
							style={ {
								padding: '15px',
								backgroundColor: '#f0f0f0',
								border: '1px solid #ddd',
								borderRadius: '4px',
								maxHeight: '300px',
								overflowY: 'auto',
								whiteSpace: 'pre-wrap',
							} }
						>
							{ generatedText }
						</div>
					</div>
				) }

				<div
					style={ {
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '8px',
						marginTop: '24px',
					} }
				>
					<div>
						<Button
							isSecondary
							onClick={ onClose }
							disabled={ isProcessing }
						>
							{ __( 'Cancel', 'bearded-media' ) }
						</Button>
					</div>
					<div>
						<Button
							isPrimary
							onClick={ handleGenerate }
							disabled={
								isProcessing || ! prompt || ! selectedModel
							}
						>
							{ isProcessing
								? __( 'Generating…', 'bearded-media' )
								: __( 'Generate Text', 'bearded-media' ) }
						</Button>
					</div>
					{ generatedText && ! isProcessing && (
						<div>
							<Button
								variant="primary"
								onClick={ () => {
									onInsertText( generatedText );
									onClose();
								} }
							>
								{ __(
									'Insert into Document',
									'bearded-media'
								) }
							</Button>
						</div>
					) }
				</div>
			</div>
		</Modal>
	);
}
