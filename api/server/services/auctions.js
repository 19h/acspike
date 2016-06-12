'use strict';

const crypto = require('crypto');
const assert = require('assert');

const _ = require('lodash');

const {ObjectId} = require('mongodb');

const BaseError = require('../util/errors');

class AuctionService {
	constructor ({mongoClient, redisClient, userService}, config) {
		this.dependencies = {
			mongoClient, redisClient, userService
		};

		this.config = config;

		this.auctions = mongoClient.collection('auctions');
	}

	/* omit author user id */
	_stripAuction (auction) {
		return _.chain(auction)
				/* make sure we dont leak userId */
		 		.extend({author: _.omit(_.get(auction, 'author'), '_id')})
		 		.value();
	}

	* _createAuctionRedisEntry (auctionId) {
		/* see config.redis.scripts#auctionIncrEq */
		return yield this.dependencies.redisClient.multi()
				/* only overwrite auction if key does not exist */
				.setnx(auctionId, 0)
				.exec()
				.spread(([err]) => err);
	}

	* createAuction ({title, description, image}, userToken) {
		const user = yield* this.dependencies.userService.getUserByToken(userToken);

		/* implicitly checks userToken */
		const {_id: userId, username} = user;

		const nowTimestamp = (new Date()).toISOString();

		const createOperation = yield this.auctions.insert({
			item: {
				title, description, image
			},

			/*
				Bid storage... this would be in a different
				place in a realworld scenario
			*/
			bids: [],
			highestBid: 0,

			sold: false,
			created: nowTimestamp,
			author: { userId, username }
		});

		const strippedAuction = this._stripAuction(_.get(createOperation, 'ops.0'));

		try {
			yield* this._createAuctionRedisEntry(strippedAuction._id);
		} catch(err) {
			yield this.auctions.deleteOne({
				_id: strippedAuction._id
			});

			throw new Error('Could not create auction entry in Redis store, rolling back.');
		}

		return strippedAuction;
	}

	* verifyAuction ({auctionId}) {
		const auction = yield this.auctions.findOne({
			_id: ObjectId(auctionId),
			sold: false // if it is true, we will not see it
		}, {
			_id: 1
		});

		if(_.isEmpty(auction)) {
			throw new this.NotFoundError(`Auction with id '${auctionId}' does not exist or has been sold.`);
		}
	}

	* getAuction ({auctionId}) {
		yield* this.verifyAuction({auctionId});

		const auction = yield this.auctions.findOne({
			_id: ObjectId(auctionId)
		});

		const bids = _.get(auction, 'bids');

		/* enrich with highest bidder */

		if (_.size(bids)) {
			const shallowBids = [].slice.call(bids);

			/* get username of first bid when sorted by date */
			const {username} = _.first(shallowBids.sort((a, b) => b.date - a.date));

			/* get avatarUrl from account */
			const {avatarUrl} = yield* this.dependencies.userService.getUserByUsername(username);

			_.extend(auction, {
				highestBidder: {
					username, avatarUrl
				}
			});
		}

		{
			/* enrich with author */
			const {username} = _.get(auction, 'author');
			const {avatarUrl} = yield* this.dependencies.userService.getUserByUsername(username);

			_.assign(auction, {
				author: {username, avatarUrl}
			});
		};

		return this._stripAuction(auction);
	}

	* getActiveAuctions (offset=0, limit=0) {
		const auctions = yield this.auctions.find({
			sold: false
		}, {
			limit, skip: offset,
    		sort: {
    			created: -1
    		}
		}).toArray();

		return _.map(auctions, this._stripAuction);
	}

    /*
    	ingest a bid coming from bids; knownAmount is amount
    	as seen when placing bid.
    */
	* bidAuction ({knownAmount, bidAmount, userToken, auctionId}) {
		yield* this.verifyAuction({auctionId});

		const user = yield* this.dependencies.userService.getUserByToken(userToken);

		const {_id: userId, username, avatarUrl} = user;

		const now = Date.now();

		const totalAmount = bidAmount + knownAmount;

		yield this.auctions.update({
			_id: ObjectId(auctionId),
			/* atomically check for this condition before write */
			highestBid: { $eq: knownAmount }
		}, {
			/* increase highestBid by bidSize */
			$inc: { highestBid: bidAmount },

			$push: {
				/* record bid */
				bids: {
					userId,
					username,
					bidAmount,
					totalAmount,
					date: now
				}
			}
		});

		return {
			auction: { auctionId },
			user: { username, avatarUrl },
			bid: { bidAmount, totalAmount, date: now }
		};
	}
}

_.extend(AuctionService.prototype, {
	NotFoundError: class NotFoundError extends BaseError {},
	ConflictError: class ConflictError extends BaseError {}
});

module.exports = AuctionService;