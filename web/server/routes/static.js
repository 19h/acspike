'use strict';

const path = require('path');

module.exports = {
	* attach ({express, app, logger}) {
		/* Static files */
		const assetSource = path.join(__dirname, '../../public');

		app.use(express.static(assetSource, {
			etag: true,
			maxage: 6 * 3600
		}));

		logger.info('Using \'%s\' for static assets.', assetSource);
	}
};