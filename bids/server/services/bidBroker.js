'use strict';

const assert = require('assert');

const _ = require('lodash');
const Promise = require('bluebird');

class BidBroker {
	constructor ({amqp, logger, jwt, redisClient}, config) {
		this.dependencies = {
			amqp, logger, jwt, redisClient
		};

		this.config = config;
	}

	attachBus (bus) {
		bus.on('message', msg => this._handleMessage(msg));

		this.bus = bus;
	}

	_resolveUserToken (userToken) {
		try {
			const userTokenSecret = _.get(this, 'config.jwt.userTokenSecret');

			const tokenData = this.dependencies.jwt.decode(userToken, userTokenSecret);

			/* i dont trust the jwt-simple contract */
			assert(!_.isEmpty(tokenData), 'Token data is empty');

			const {challenge, username, created} = tokenData;

			/* No key should be empty */
			assert(![challenge, username, created].some(_.isEmpty), 'Not all keys are given');

			const wasCreated = new Date(created);

			/* It should not have expired */
			assert((Date.now() - wasCreated) < _.get(this, 'config.jwt.ttl'), 'Token expired');

			/* we're not doing special checks here, just basic verification */

			return {userToken, challenge};
		} catch(err) {
			this.dependencies.logger.warn(err, 'Token error');
			throw new Error('Invalid user token');
		}
	}

	_resolveWebBidToken (msg) {
		const webBidSecret = _.get(this, 'config.jwt.webBidSecret');

		return this.dependencies.jwt.decode(msg, webBidSecret);
	}

	_prepareBidCommit (msg) {
		const bidBrokerSecret = _.get(this, 'config.jwt.bidBrokerSecret');

		return this.dependencies.jwt.encode(msg, bidBrokerSecret);
	}

	* _processBid (auctionId, knownAmount, bidAmount) {
		/* see config.redis.scripts#auctionIncrEq */
		return yield this.dependencies.redisClient.multi()
				/*
					expect key at `auctionId` to be equal knownAmount,
					then commit the bidAmount.

					Requires the key to have been created by api in
					the createAuction transaction. (will otherwise
					throw `Key differs from constraint`)
				*/
				.auctionIncrEq(auctionId, knownAmount, bidAmount)
				.exec()
				/* result will be [[err, data]], unwrap it to [err, data] */
				.spread(([err]) => err);
	}

	* _ingestMessage (msg) {
		const signedBid = _.get(msg, 'payload.message.bid');
		const bid = this._resolveWebBidToken(signedBid);

		['auctionId', 'knownAmount', 'bidAmount'].forEach(requiredKey =>
			assert(_.has(bid, requiredKey), `Invalid ${requiredKey} not given`)
		);

		const {auctionId, knownAmount, bidAmount, userToken} = bid;

		const {username, created} = this._resolveUserToken(userToken);

		/* conditionally commit the bid request from the user */
		const result = yield* this._processBid(auctionId, knownAmount, bidAmount);

		if (result instanceof Error) {
			/* either invalid auction id or the knownAmount does not apply anymore */

			const txDebugInformation = {
				tx: result,
				user: {username, created}
			};

			this.dependencies.logger.info(txDebugInformation, 'Transaction did not succeed');

			/*
				TODO: Provide feedback to the user about his failed tx
			*/

			/* bail: cannot commit transaction */
			return;
		}

		/* Emit successful bid over smallpipe to api */
		this.bus.emit('smallpipe', {
			bid: this._prepareBidCommit(bid)
		});
	}
}

BidBroker.prototype._handleMessage = Promise.coroutine(function* (msg) {
	yield* this._ingestMessage(msg);
});

module.exports = BidBroker;