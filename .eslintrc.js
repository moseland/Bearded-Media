module.exports = {
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	env: {
		browser: true,
		es6: true,
	},
	globals: {
		plupload: 'readonly',
		wp: 'readonly',
		MutationObserver: 'readonly',
		FileReader: 'readonly',
		Image: 'readonly',
		URL: 'readonly',
		File: 'readonly',
		Blob: 'readonly',
		Uint8Array: 'readonly',
		alert: 'readonly',
	},
	rules: {
		'no-console': 'off',
		'no-alert': 'off',
	},
};
