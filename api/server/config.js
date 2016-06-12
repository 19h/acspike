'use strict';

const _ = require('lodash');

const config = {
	server: {
		port: process.env.PORT || 2001
	},
	jwt: {
		userTokenSecret: 'zaH03KRYZ/0E08HEMt79TVQtSDY=',
		bidBrokerSecret: 'FB4GmBayfMyUZqpbrG5opWH0IKmb52',

		ttl: 86400 * 1000 // one day
	},
	passwords: {
		secret: '2v24iJNmu4WVrc+diuAlfLiJiOeNWziI5Purh5sUY4E='
	},
	sessions: {
		secret: '6dBkOBvMN0xxCqj9f1iuUvcGG8ZaTWhQ',

		/* do not store before session was mutated */
		saveUninitialized: false,

		/* force session update for ttl */
		resave: true,

		ttl: 7200
	},
	redis: {
		host: 'redis_bids',
		port: 6379
	},
	mongo: {
		host: 'mongo_api',
		port: 27017,
		db: 'antagonist'
	},
	mq: {
		requireAcknowledgement: false,

		queues: [{
			type: 'consumer',
			host: 'rmq_bigpipe',
			queueName: 'smallpipe'
		}, {
			type: 'publisher',
			host: 'rmq_bigpipe',
			queueName: 'backpipe'
		}],

		messageDefaults: {
			appId: 'web'
		}
	}
};

try {
	_.extend(config, require('./config.local.js'));
} catch(e) {}

module.exports = config;