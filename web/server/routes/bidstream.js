'use strict';

const _ = require('lodash');

const {asyncWrap} = require('../shared/async');

const SocketIo = require('socket.io');

module.exports = {
	* attach ({server, config, logger, bidSubClient}) {
		const fatStream = SocketIo(server, {
			path: '/bids'
		});

		fatStream.on('connection', () => logger.debug('New bidStream connection'));
		fatStream.on('disconnect', () => logger.debug('Lost bidStream connection'));

		bidSubClient.subscribe('auctionBid');

		bidSubClient.on('message', (channel, msg) => {
			try {
				const bid = JSON.parse(msg);
				const auctionId = _.get(bid, 'auction.auctionId');

				fatStream.emit(`auction:${auctionId}`, bid)
			} catch(err) {
				logger.warn(err, 'Received invalid bidSubClient message');
				// invalid message
			}
		});
	}
};