'use strict';

const _ = require('lodash');
const assert = require('assert');

const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const bodyParse = require('body-parser');

const {asyncWrap} = require('../shared/async');

module.exports = {
    * attach ({express, app, bus, jwt, config, logger, graphClient}) {
        const jwtBidSecret = _.get(config, 'jwt.webBidSecret');

        const apiRouter = express.Router();

        apiRouter.use(bodyParse.json());

        const sessionEnricher = (req, result) =>
            _.extend(req.session, _.get(result, 'user'));

        /* auth routes */
        [{
            path: '/login',
            mutation: 'login',
            custom: sessionEnricher
        }, {
            path: '/register',
            mutation: 'register',
            custom: sessionEnricher
        }, {
            path: '/auction/new',
            mutation: 'createAuction',
            custom: () => {}
        }].forEach(({path, mutation, custom}) =>
            apiRouter.post(path, asyncWrap(function* (req, res) {
                const {userToken} = _.get(req, 'session.user', {});

                const mutationVariables = _.extend({
                    userToken
                }, _.get(req, 'body'));

                const result = yield* graphClient.mutate(mutation, mutationVariables);

                if (_.has(result, 'error')) {
                    return res.json(_.pick(result, 'error'));
                }

                custom(req, result);

                res.status(200).json(result);
            }))
        );

        apiRouter.get('/logout', asyncWrap(function* (req, res) {
            req.session.destroy();

            res.status(204).send();
        }));

        apiRouter.get('/me', asyncWrap(function* (req, res) {
            const reqData = _.get(req, 'session.user', {});

            const userProjection = yield* graphClient.query('me', reqData);

            if (_.has(userProjection, 'error')) {
                return res.json(_.pick(userProjection, 'error'));
            }

            res.status(200).json(_.get(userProjection, 'user.me'));
        }));

        apiRouter.get('/auctions', asyncWrap(function* (req, res) {
            const reqData = _.get(req, 'session.user', {});

            const userProjection = yield* graphClient.query('auctions', reqData);

            if (_.has(userProjection, 'error')) {
                return res.json(_.pick(userProjection, 'error'));
            }

            res.status(200).json(userProjection);
        }));

        apiRouter.post('/auction', asyncWrap(function* (req, res) {
            const {userToken} = _.get(req, 'session.user', {});

            const queryVariables = _.extend({
                userToken
            }, _.get(req, 'body'));

            const userProjection = yield* graphClient.query('auction', queryVariables);

            if (_.has(userProjection, 'error')) {
                return res.json(_.pick(userProjection, 'error'));
            }

            res.status(200).json(userProjection);
        }));

        apiRouter.post('/auction/bid', asyncWrap(function* (req, res) {
            const {userToken} = _.get(req, 'session.user', {});
            const body = _.get(req, 'body');

            assert(!_.isEmpty(body), 'Invalid parameters sent.');
            assert(!_.isEmpty(userToken), 'Cannot accept bid without user token.');

            // verify token validity

            const {auctionId, knownAmount} = body;

            assert(!_.isEmpty(auctionId), 'AuctionId must not be falsy');

            const {bidAmount} = body;

            /*
                I'd replace the known amount with a correlation
                id so that each 'state' can be distinctively
                identified, but this would be too far here
            */
            assert(_.isNumber(knownAmount), 'Invalid knownAmount');
            assert(_.isNumber(bidAmount), 'Invalid bidAmount');

            const mqBidPacket = {
                auctionId, userToken,

                knownAmount, bidAmount
            };

            bus.emit('bigpipe', {
                bid: jwt.encode(mqBidPacket, jwtBidSecret)
            });

            res.status(201).json({});
        }));

        app.use('/api', apiRouter);
    }
};