'use strict';

const assert = require('assert');

const _ = require('lodash');
const Promise = require('bluebird');

class BidIngester {
	constructor ({amqp, logger, jwt, auctionService, redisClient}, config) {
		this._dependencies = {
			auctionService,

			amqp, logger, jwt, redisClient
		};

		this._config = config;
	}

	attachBus (bus) {
		bus.on('message', msg => this._handleMessage(msg));

		this._bus = bus;
	}

	_resolveBidBrokerToken (msg) {
		const bidBrokerSecret = _.get(this, '_config.jwt.bidBrokerSecret');

		return this._dependencies.jwt.decode(msg, bidBrokerSecret);
	}

	* _ingestMessage (msg) {
		const signedBid = _.get(msg, 'payload.message.bid');
		const bid = this._resolveBidBrokerToken(signedBid);

		/* extract only required keys */
		const {auctionId, knownAmount, bidAmount, userToken} = bid;

		const resolvedBid = yield* this._dependencies.auctionService.bidAuction({
			auctionId, knownAmount, bidAmount, userToken
		});

		this._bus.emit('backpipe', resolvedBid);
	}
}

BidIngester.prototype._handleMessage = Promise.coroutine(function* (msg) {
	yield* this._ingestMessage(msg);
});

module.exports = BidIngester;