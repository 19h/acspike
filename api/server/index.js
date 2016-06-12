'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const amqp = require('amqp');
const bunyan = require('bunyan');
const jwt = require('jwt-simple');

const Redis = require('ioredis');

const express = require('express');
const app = express();

const MongoArbitrator = require('./misc/mongo');

const config = require('./config');

const logger = require('./misc/logger');
const Bus = require('./misc/bus');

const authMiddleware = require('./routes/auth');
const graphInterface = require('./routes/graph');

const redisClient = new Redis(_.get(config, 'redis', {}));

const UserService = require('./services/user');
const AuctionService = require('./services/auctions');

const BidIngester = require('./services/bidIngester');

Promise.coroutine(function* () {
    /* wait for mongodb to be connected */
    const mongoClient = yield* MongoArbitrator.awaitInstanciation({
        config
    });

    const userService = new UserService({mongoClient, redisClient, jwt}, config);
    const auctionService = new AuctionService({mongoClient, redisClient, userService}, config);

    /* wait for rabbitmq to be ready */
    const bus = yield* Bus.awaitInstanciation({
        amqp, logger
    }, config);

    const bidIngester = new BidIngester({amqp, logger, jwt, auctionService, redisClient}, config);

    /* forward messages to broker */
    bidIngester.attachBus(bus);

    yield* authMiddleware({
        app, userService
    });

    yield* graphInterface({
    	app, userService, auctionService
    });

    const port = _.get(config, 'server.port');

    yield (Promise.promisify(cb =>
        app.listen(port, cb)
    ))();

    logger.info('Online, using port %s', port);
})().catch(err => logger.fatal(err));