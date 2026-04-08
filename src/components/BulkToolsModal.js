import { Modal, Button, CheckboxControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const BulkToolsModal = ( { isOpen, onClose, selection, onSuccess } ) => {
	const [ isRunning, setIsRunning ] = useState( false );
	const [ progress, setProgress ] = useState( 0 );
	const [ log, setLog ] = useState( [] );

	// Options
	const [ doAlt, setDoAlt ] = useState( true );
	const [ doRename, setDoRename ] = useState( false );

	if ( ! isOpen ) {
		return null;
	}

	const items = selection ? selection.models : [];
	const total = items.length;

	const runBatch = async () => {
		setIsRunning( true );
		setLog( [] );
		setProgress( 0 );

		for ( let i = 0; i < total; i++ ) {
			const item = items[ i ];
			const id = item.id;
			const filename = item.get( 'filename' );

			setLog( ( prev ) => [ ...prev, `Processing ${ filename }...` ] );

			try {
				await apiFetch( {
					path: '/bearded-media/v1/analyze-image',
					method: 'POST',
					data: { id, rename: doRename },
				} );
				setLog( ( prev ) => {
					const n = [ ...prev ];
					n[ n.length - 1 ] = `Processed ${ filename } ✅`;
					return n;
				} );
			} catch ( e ) {
				setLog( ( prev ) => {
					const n = [ ...prev ];
					n[
						n.length - 1
					] = `Failed ${ filename } ❌ (${ e.message })`;
					return n;
				} );
			}

			setProgress( ( ( i + 1 ) / total ) * 100 );
		}

		setIsRunning( false );
		if ( onSuccess ) {
			onSuccess();
		}
	};

	return (
		<Modal
			title={ `Bulk AI Tools (${ total } items)` }
			onRequestClose={ onClose }
			style={ { maxWidth: '600px' } }
		>
			<div style={ { padding: '20px' } }>
				{ ! isRunning && progress === 0 && (
					<>
						<p>
							Select actions to perform on the{ ' ' }
							<strong>{ total }</strong> selected images:
						</p>
						<div
							style={ {
								background: '#f9f9f9',
								padding: '15px',
								borderRadius: '4px',
								marginBottom: '20px',
							} }
						>
							<CheckboxControl
								label="Generate Alt Text & Titles"
								checked={ doAlt }
								onChange={ setDoAlt }
								help="Uses Gemini Vision to describe the image."
							/>
							<CheckboxControl
								label="Smart Rename File (SEO)"
								checked={ doRename }
								onChange={ setDoRename }
								help="⚠️ Renames physical files. May break external links."
							/>
						</div>
						<div
							style={ {
								display: 'flex',
								justifyContent: 'end',
								gap: '10px',
							} }
						>
							<Button variant="secondary" onClick={ onClose }>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={ runBatch }
								disabled={ ! doAlt && ! doRename }
							>
								Start Batch
							</Button>
						</div>
					</>
				) }

				{ ( isRunning || progress > 0 ) && (
					<div>
						<div
							style={ {
								height: '10px',
								background: '#eee',
								borderRadius: '5px',
								overflow: 'hidden',
								marginBottom: '10px',
							} }
						>
							<div
								style={ {
									width: `${ progress }%`,
									height: '100%',
									background: '#007cba',
									transition: 'width 0.3s ease',
								} }
							></div>
						</div>
						<div
							style={ {
								height: '200px',
								overflowY: 'auto',
								background: '#1e1e1e',
								color: '#0f0',
								padding: '10px',
								fontFamily: 'monospace',
								fontSize: '12px',
								marginTop: '15px',
							} }
						>
							{ log.map( ( l, i ) => (
								<div key={ i }>{ l }</div>
							) ) }
							{ ! isRunning && (
								<div
									style={ {
										color: 'white',
										marginTop: '10px',
									} }
								>
									Batch Complete.
								</div>
							) }
						</div>
						{ ! isRunning && (
							<div
								style={ {
									marginTop: '15px',
									textAlign: 'right',
								} }
							>
								<Button variant="primary" onClick={ onClose }>
									Close
								</Button>
							</div>
						) }
					</div>
				) }
			</div>
		</Modal>
	);
};

export default BulkToolsModal;
