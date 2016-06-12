'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const amqp = require('amqp');
const jwt = require('jwt-simple');

const Redis = require('ioredis');

const config = require('./config');

const logger = require('./misc/logger');
const Bus = require('./misc/bus');

const BidBroker = require('./services/bidBroker');

const redisClient = new Redis(_.get(config, 'redis', {}));

_.each(_.get(config, 'redis.scripts'), ({name, script}) =>
	redisClient.defineCommand(name, script)
);

Promise.coroutine(function* () {
    /* wait for rabbitmq to be ready */
    const bus = yield* Bus.awaitInstanciation({
        amqp, logger
    }, config);

    const bidBroker = new BidBroker({amqp, logger, jwt, redisClient}, config);

    /* forward messages to broker */
    bidBroker.attachBus(bus);

    logger.info('Hey there');
})().catch(err => logger.fatal(err));