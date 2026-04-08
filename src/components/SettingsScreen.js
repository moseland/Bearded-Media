import React, { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import '../styles/SettingsScreen.scss';

/**
 * Bearded Media Settings Screen
 */
const App = () => {
	const [ settings, setSettings ] = useState( {
		auto_alt: false,
		seo_rename: false,
		auto_webp: false,
		max_width: 2500,
		max_height: 2500,
	} );

	const [ apiKeys, setApiKeys ] = useState( {
		gemini_key: '',
		stability_key: '',
		pexels_key: '',
		bfl_key: '',
	} );

	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );

	/**
	 * Fetch settings on mount.
	 * Uses apiFetch to query the WP Settings API.
	 */
	useEffect( () => {
		const fetchSettings = async () => {
			try {
				// Accessing settings registered with 'show_in_rest' => true in PHP
				const wpSettings = await apiFetch( {
					path: '/wp/v2/settings',
				} );

				if ( wpSettings ) {
					setSettings( {
						auto_alt:
							wpSettings.bearded_media_settings?.auto_alt ??
							false,
						seo_rename:
							wpSettings.bearded_media_settings?.seo_rename ??
							false,
						auto_webp:
							wpSettings.bearded_media_settings?.auto_webp ??
							false,
						max_width:
							wpSettings.bearded_media_settings?.max_width ??
							2500,
						max_height:
							wpSettings.bearded_media_settings?.max_height ??
							2500,
					} );

					setApiKeys( {
						gemini_key:
							wpSettings.bearded_media_api_keys?.gemini_key ?? '',
						stability_key:
							wpSettings.bearded_media_api_keys?.stability_key ??
							'',
						pexels_key:
							wpSettings.bearded_media_api_keys?.pexels_key ?? '',
						bfl_key:
							wpSettings.bearded_media_api_keys?.bfl_key ?? '',
					} );
				}
			} catch ( err ) {
				setNotice( {
					type: 'error',
					message: __(
						'Failed to connect to the WordPress API. Please check your user permissions.',
						'bearded-media'
					),
				} );
			} finally {
				setIsLoading( false );
			}
		};

		fetchSettings();
	}, [] );

	/**
	 * Persist settings to the database.
	 */
	const handleSave = async () => {
		setIsSaving( true );
		setNotice( null );

		try {
			await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: {
					bearded_media_settings: settings,
					bearded_media_api_keys: apiKeys,
				},
			} );

			setNotice( {
				type: 'success',
				message: __(
					'Settings updated successfully.',
					'bearded-media'
				),
			} );
		} catch ( error ) {
			setNotice( {
				type: 'error',
				message:
					error.message ||
					__( 'Failed to save settings.', 'bearded-media' ),
			} );
		} finally {
			setIsSaving( false );
			setTimeout( () => setNotice( null ), 4500 );
		}
	};

	const updateSetting = ( key, value ) => {
		setSettings( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	const updateKey = ( key, value ) => {
		setApiKeys( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	if ( isLoading ) {
		return (
			<div className="bearded-settings loading-plugin">
				<div className="spinner"></div>
				<p className="font-medium">
					{ __( 'Loading plugin state…', 'bearded-media' ) }
				</p>
			</div>
		);
	}

	return (
		<div className="bearded-settings">
			{ /* Header */ }
			<header>
				<div>
					<h1>{ __( 'Bearded Media', 'bearded-media' ) }</h1>
					<p>
						{ __(
							'Enterprise AI Asset Orchestration',
							'bearded-media'
						) }
					</p>
				</div>
				<div className="version-info">
					<span className="badge">v2.1.0-stable</span>
					<span className="psr-note">
						{ __( 'PSR-4 Compliant Backend', 'bearded-media' ) }
					</span>
				</div>
			</header>

			{ /* Notifications */ }
			<div className="notice-container">
				{ notice && (
					<div className={ `notice ${ notice.type }` }>
						<div className="notice-content">
							<StatusIcon type={ notice.type } />
							<span>{ notice.message }</span>
						</div>
						<button
							onClick={ () => setNotice( null ) }
							className="close-notice"
							aria-label="Close notice"
						>
							<svg
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				) }
			</div>

			<div className="grid-layout">
				{ /* Main Logic */ }
				<div className="main-content">
					<SectionCard
						title={ __( 'Automated Pipelines', 'bearded-media' ) }
						icon={ <BoltIcon /> }
					>
						<div>
							<SettingRow
								id="auto_alt"
								label={ __(
									'Vision Analysis & Alt Text',
									'bearded-media'
								) }
								description={ __(
									'Leverage Gemini Pro to describe images for accessibility and search indices automatically on upload.',
									'bearded-media'
								) }
							>
								<Toggle
									id="auto_alt"
									checked={ settings.auto_alt }
									onChange={ ( val ) =>
										updateSetting( 'auto_alt', val )
									}
								/>
							</SettingRow>

							<SettingRow
								id="seo_rename"
								label={ __(
									'Physical File Sanitization',
									'bearded-media'
								) }
								description={ __(
									'Analyze content and rename server files to SEO-friendly slugs. Essential for high-traffic content strategies.',
									'bearded-media'
								) }
								warning={ __(
									'May impact existing image references in legacy content.',
									'bearded-media'
								) }
							>
								<Toggle
									id="seo_rename"
									checked={ settings.seo_rename }
									onChange={ ( val ) =>
										updateSetting( 'seo_rename', val )
									}
								/>
							</SettingRow>

							<SettingRow
								id="auto_webp"
								label={ __(
									'Client-Side Optimization',
									'bearded-media'
								) }
								description={ __(
									'Convert assets to WebP in-browser to reduce server CPU load and bandwidth consumption.',
									'bearded-media'
								) }
							>
								<Toggle
									id="auto_webp"
									checked={ settings.auto_webp }
									onChange={ ( val ) =>
										updateSetting( 'auto_webp', val )
									}
								/>
							</SettingRow>
						</div>
					</SectionCard>

					<SectionCard
						title={ __( 'Media Constraints', 'bearded-media' ) }
						icon={ <ScaleIcon /> }
					>
						<div className="grid-2-col">
							<InputField
								id="max_width"
								label={ __(
									'Global Max Width (px)',
									'bearded-media'
								) }
								value={ settings.max_width }
								onChange={ ( val ) =>
									updateSetting(
										'max_width',
										parseInt( val ) || 0
									)
								}
							/>
							<InputField
								id="max_height"
								label={ __(
									'Global Max Height (px)',
									'bearded-media'
								) }
								value={ settings.max_height }
								onChange={ ( val ) =>
									updateSetting(
										'max_height',
										parseInt( val ) || 0
									)
								}
							/>
						</div>
					</SectionCard>
				</div>

				{ /* API Sidebar */ }
				<div className="sidebar">
					<SectionCard
						title={ __( 'Service Credentials', 'bearded-media' ) }
						icon={ <KeyIcon /> }
					>
						<div className="sidebar-content">
							<InputField
								id="gemini_key"
								label={ __( 'Google Gemini', 'bearded-media' ) }
								type="password"
								placeholder="••••••••••••"
								value={ apiKeys.gemini_key }
								onChange={ ( v ) =>
									updateKey( 'gemini_key', v )
								}
							/>
							<InputField
								id="stability_key"
								label={ __( 'Stability AI', 'bearded-media' ) }
								type="password"
								placeholder="••••••••••••"
								value={ apiKeys.stability_key }
								onChange={ ( v ) =>
									updateKey( 'stability_key', v )
								}
							/>
							<InputField
								id="pexels_key"
								label={ __( 'Pexels', 'bearded-media' ) }
								type="password"
								placeholder="••••••••••••"
								value={ apiKeys.pexels_key }
								onChange={ ( v ) =>
									updateKey( 'pexels_key', v )
								}
							/>
							<InputField
								id="bfl_key"
								label={ __( 'Flux (BFL)', 'bearded-media' ) }
								type="password"
								placeholder="••••••••••••"
								value={ apiKeys.bfl_key }
								onChange={ ( v ) => updateKey( 'bfl_key', v ) }
							/>
						</div>
						<div
							style={ {
								marginTop: '2.5rem',
								paddingTop: '2rem',
								borderTop: '1px solid #f1f5f9',
							} }
						>
							<button
								onClick={ handleSave }
								disabled={ isSaving }
								className={ `sync-button ${
									isSaving ? 'loading' : ''
								}` }
							>
								{ isSaving ? (
									<div
										className="spinner"
										style={ {
											width: '1.25rem',
											height: '1.25rem',
											border: '2px solid white',
											borderTopColor: 'transparent',
											marginBottom: 0,
										} }
									></div>
								) : (
									__( 'Sync to Database', 'bearded-media' )
								) }
							</button>
							<p
								style={ {
									marginTop: '1.5rem',
									fontSize: '11px',
									color: '#94a3b8',
									textAlign: 'center',
									lineHeight: '1.625',
									padding: '0 1rem',
								} }
							>
								{ __(
									'Credentials are secured via WordPress nonces and the REST API permission callback.',
									'bearded-media'
								) }
							</p>
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	);
};

/* --- Sub-Components --- */

const SectionCard = ( { title, icon, description, children } ) => (
	<div className="section-card">
		<div className="card-header">
			<span className="header-icon">{ icon }</span>
			<h2>{ title }</h2>
		</div>
		<div className="card-body">
			{ description && (
				<p className="section-description">{ description }</p>
			) }
			{ children }
		</div>
	</div>
);

const SettingRow = ( { id, label, description, warning, children } ) => (
	<div className="setting-row">
		<div className="content">
			<label htmlFor={ id }>{ label }</label>
			<p>{ description }</p>
			{ warning && (
				<div className="warning-badge">
					<svg
						width="16"
						height="16"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							fillRule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clipRule="evenodd"
						/>
					</svg>
					{ warning }
				</div>
			) }
		</div>
		<div className="action">{ children }</div>
	</div>
);

const Toggle = ( { id, checked, onChange } ) => (
	<button
		id={ id }
		type="button"
		onClick={ () => onChange( ! checked ) }
		className={ `bearded-toggle ${ checked ? 'checked' : '' }` }
		role="switch"
		aria-checked={ checked }
	>
		<div className="handle" />
	</button>
);

const InputField = ( {
	id,
	label,
	type = 'text',
	value,
	onChange,
	placeholder = '',
} ) => (
	<div className="input-field">
		<label htmlFor={ id }>{ label }</label>
		<input
			id={ id }
			type={ type }
			value={ value }
			onChange={ ( e ) => onChange( e.target.value ) }
			placeholder={ placeholder }
		/>
	</div>
);

const StatusIcon = ( { type } ) =>
	type === 'success' ? (
		<svg
			width="24"
			height="24"
			style={ { color: '#10b981' } }
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fillRule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
				clipRule="evenodd"
			/>
		</svg>
	) : (
		<svg
			width="24"
			height="24"
			style={ { color: '#f43f5e' } }
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				fillRule="evenodd"
				d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
				clipRule="evenodd"
			/>
		</svg>
	);

const BoltIcon = () => (
	<svg
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			d="M13 10V3L4 14h7v7l9-11h-7z"
		/>
	</svg>
);

const ScaleIcon = () => (
	<svg
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
		/>
	</svg>
);

const KeyIcon = () => (
	<svg
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
		/>
	</svg>
);

export default App;
