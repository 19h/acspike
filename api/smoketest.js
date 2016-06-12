const config = require('./server/config');

const crypto = require('crypto');

const _ = require('lodash');
const jwt = require('jwt-simple');
const Promise = require('bluebird');

const chai = require('chai');
chai.use(require('chai-shallow-deep-equal'));

const {assert, expect} = chai;

const MongoArbitrator = require('./server/misc/mongo');

const Redis = require('ioredis');
const redisClient = new Redis(_.get(config, 'redis', {}));

const UserService = require('./server/services/user');
const AuctionService = require('./server/services/auctions');

const userAvatar = 'https://scontent-ams3-1.xx.fbcdn.net/v/t1.0-1/p320x320/1909_10154727194787796_2297094634999266608_n.jpg?oh=b1ad3eff8ea29334de56917f303d826e&oe=580A37F0';
const auctionImage = 'https://static1.squarespace.com/static/52784cdde4b07cdbb003018f/537abe38e4b0ff62ffbb6786/56036d26e4b008bd0ad827f0/1443065129884/Cat-in-Window-Painting-HOME.jpg?iact=rc&uact=3&dur=3024&page=3&start=45&ndsp=29&ved=0ahUKEwiJ47SClJ3NAhXJchQKHYOKAskQMwiqASg5MDk';

Promise.coroutine(function* () {
    const mongoClient = yield* MongoArbitrator.awaitInstanciation({
        config
    });

    const accounts = mongoClient.collection('accounts');
    const auctions = mongoClient.collection('auctions');

    yield accounts.drop();
    yield auctions.drop();

    yield redisClient.multi().flushall().exec();

    const userService = new UserService({mongoClient, redisClient, jwt}, config);
    const auctionService = new AuctionService({mongoClient, redisClient, userService}, config);

    const u1 = crypto.randomBytes(24).toString('hex');
    const p1 = crypto.randomBytes(24).toString('hex');

    const {userToken} = yield* userService.register({
        username: u1, password: p1, avatarUrl: userAvatar
    });

    console.log('Registering user: u: %s p: %s; userToken: %s', u1, p1, userToken);

    const {_id: userId, username} = yield* userService.getUserByToken(userToken);

    console.log('Getting user by token: %s', userToken);

    const [title, description, image] = ['Foo', 'bar asdasdasdasd ads', auctionImage];

    console.log('Creating auction: title: %s, description: %s, image: %s', title, description, image);

    const auction1 = yield* auctionService.createAuction({title, description, image}, userToken);

    console.log('Created auction', auction1);

    console.log('Trying to bid 500 times with the same known amount...');

    const op1 = Promise.coroutine(function* () {
        yield* auctionService.bidAuction({
            knownAmount: 0,
            bidAmount: 1000,
            userToken,
            auctionId: _.get(auction1, '_id')
        }, userToken);
    });

    yield Promise.all(_.map(_.times(100), op1));

    const _refA = yield* auctionService.getAuction({
        auctionId: _.get(auction1, '_id')
    });

    expect(_refA).to.shallowDeepEqual({
        author: {
            username
        },
        bids: [{
            userId, username, bidAmount: 1000, totalAmount: 1000
        }],
        highestBid: 1000,
        sold: false
    })

    console.log('Auction is correct.');

    const auction2 = yield* auctionService.createAuction({title, description, image}, userToken);

    console.log('Should only apply bid when correct constraints given..');

    let fxi = 0;

    const op2 = Promise.coroutine(function* () {
        yield* auctionService.bidAuction({
            knownAmount: fxi++,
            bidAmount: 50,
            userToken,
            auctionId: _.get(auction2, '_id')
        }, userToken);
    });

    yield Promise.all(_.map(_.times(100), op2));

    const _refB = yield* auctionService.getAuction({
        auctionId: _.get(auction2, '_id')
    });

    console.log(_refB)

    expect(_refB).to.shallowDeepEqual({
        bids: [{
            userId, username, bidAmount: 50, totalAmount: 50
        }, {
            userId, username, bidAmount: 50, totalAmount: 100
        }],
        highestBid: 100,
        sold: false
    })

    console.log(yield* auctionService.getActiveAuctions())

    process.exit();
})();
