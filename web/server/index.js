const _ = require('lodash');

const amqp = require('amqp');
const Redis = require('ioredis');

const jwt = require('jwt-simple');

const Lokka = require('lokka').Lokka;
const LokkaTransport = require('lokka-transport-http').Transport;

const Promise = require('bluebird');

const config = require('./config');

const logger = require('./misc/logger');
const Bus = require('./misc/bus');
const GraphClient = require('./misc/graph');

const BackpipeEmitter = require('./misc/backpipeEmitter');

const router = require('./routes');

const redisClient = new Redis(_.get(config, 'redis', {}));
const bidSubClient = new Redis(_.get(config, 'redis', {}));
const bidPubClient = new Redis(_.get(config, 'redis', {}));

const lokkaClient = new Lokka({
	transport: new LokkaTransport(_.get(config, 'api.graphApi'))
});

const graphClient = new GraphClient({lokkaClient}, config);

Promise.coroutine(function* () {
	/*
		I use dependency injection below for the
		sake of testability, most of the dependencies
		would be moved into their respective files, so
		that they can be orchestrated from here.
	*/

	const bus = yield* Bus.awaitInstanciation({
		amqp, logger
	}, config);

	const backpipeEmitter = new BackpipeEmitter({
		bus, logger, bidPubClient
	});

	backpipeEmitter.attachBus(bus);

	const app = yield* router({
		config, logger, bus, jwt,

		graphClient,
		redisClient, bidSubClient, bidPubClient
	});
})();