'use strict';

const assert = require('assert');

const _ = require('lodash');
const Promise = require('bluebird');

class BackpipeEmitter {
	constructor ({logger, bus, bidPubClient}, config) {
		this._dependencies = {
			bus, logger, bidPubClient
		};

		this._config = config;
	}

	attachBus (bus) {
		bus.on('message', msg => this._handleMessage(msg));

		this._bus = bus;
	}

	* _emitMessage (msg) {
		const bidData = _.get(msg, 'payload.message');
		const auctionId = _.get(bidData, 'auction.auctionId');

		this._dependencies.bidPubClient.publish('auctionBid', JSON.stringify(bidData));
	}
}

BackpipeEmitter.prototype._handleMessage = Promise.coroutine(function* (msg) {
	yield* this._emitMessage(msg);
});

module.exports = BackpipeEmitter;