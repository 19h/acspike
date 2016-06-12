'use strict';

const _ = require('lodash');

const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const {asyncWrap} = require('../shared/async');

module.exports = {
	* attach ({app, config, logger, graphClient, redisClient}) {
		const defaultConfig = _.get(config, 'sessions.default');
		const redisConfig = _.get(config, 'sessions.redis');

		const sessionRedisConfig = _.extend({
			client: redisClient
		}, redisConfig);

		const expressSessionConfig = _.extend({
			store: new RedisStore(sessionRedisConfig)
		}, defaultConfig);

		app.use(session(expressSessionConfig));

		/*
			if the session initialization fails
			or the connection to redis dropped
			and is being reconnected, fail here
		*/
		app.use(asyncWrap(function* (req, res, next) {
			if (!req.session) return res.status(500).send();

			const sessionAuth = _.get(req, 'session.user');

			/* user not authed, bail */
			if (_.isEmpty(sessionAuth)) {
				return next();
			}

			const {username, userToken, expires} = sessionAuth;
			const sessionRenewalThreshold = Date.now() - defaultConfig;

			/* if token validity */
			if (expires > sessionRenewalThreshold) {
				return next();
			}

            try {
            	const result = yield* graphClient.mutate('renewToken', {userToken});

            	_.extend(sessionAuth, _.get(result, 'user.auth'));

            	session.user = sessionAuth;
            } catch(err) {
            	session.user = {};
            }

			next();
        }));
	}
};