import { registerFormatType, insert } from '@wordpress/rich-text';
import { BlockControls } from '@wordpress/block-editor';
import { ToolbarGroup, ToolbarButton } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import GenerateTextModal from '../components/GenerateTextModal';

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

const EditComponent = ( { isActive, value, onChange } ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );

	const handleInsertText = ( generatedText ) => {
		// Insert the generated text at the current cursor position/selection
		const newValue = insert( value, generatedText );
		onChange( newValue );
	};

	return (
		<>
			<BlockControls group="block">
				<ToolbarGroup>
					<ToolbarButton
						icon={ beardIcon }
						title={ __( 'Bearded AI Text', 'bearded-media' ) }
						onClick={ () => setIsModalOpen( true ) }
						isActive={ isActive }
					/>
				</ToolbarGroup>
			</BlockControls>
			{ isModalOpen && (
				<GenerateTextModal
					isOpen={ isModalOpen }
					onClose={ () => setIsModalOpen( false ) }
					onInsertText={ handleInsertText }
				/>
			) }
		</>
	);
};

registerFormatType( 'bearded-media/text-generator', {
	title: __( 'Bearded AI Text', 'bearded-media' ),
	tagName: 'span',
	className: 'bearded-ai-generated-text',
	edit: EditComponent,
} );
