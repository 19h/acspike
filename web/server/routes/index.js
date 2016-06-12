'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const http = require('http');
const express = require('express');

/* Route handlers */
const api = require('./api');
const tether = require('./tether');
const sessions = require('./sessions');
const bidstream = require('./bidstream');
const staticAssets = require('./static');

module.exports = function* ({config, logger, bus, jwt, redisClient, bidSubClient, bidPubClient, graphClient}) {
	const port = _.get(config, 'server.port');

	const app = express();
	const server = http.createServer(app);

	yield* sessions.attach({app, config, logger, graphClient, redisClient});

	yield* bidstream.attach({server, config, logger, bidSubClient});

	yield* api.attach({express, app, jwt, config, logger, graphClient, bus});
	yield* tether.attach({express, app, config, logger, graphClient});

	yield* staticAssets.attach({express, app, logger});

	yield (Promise.promisify(cb =>
		server.listen(port, cb))
	)();

	logger.info('Online, using port %s', port);
};