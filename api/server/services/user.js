'use strict';

const crypto = require('crypto');
const assert = require('assert');

const _ = require('lodash');

const BaseError = require('../util/errors');

class UserService {
	constructor ({mongoClient, redisClient, jwt}, config) {
		this.dependencies = {
			mongoClient, redisClient, jwt
		};

		this.config = config;

		this.jwtSecret = _.get(config, 'jwt.userTokenSecret');
		this.passwordSecret = _.get(config, 'passwords.secret');

		this.accounts = mongoClient.collection('accounts');
	}

	/*
		Calculate a hmac challenge based on our
		secret and the users challenge
	*/
	_hmac (plain, challenge) {
		const hmacChallenge =
			crypto.createHmac('SHA256', this.passwordSecret)
				  .update(challenge)
				  .digest('base64');

		return crypto.createHmac('SHA256', hmacChallenge)
					 .update(plain)
					 .digest('base64');
	}

	* userExists ({username}) {
		return !_.isEmpty(yield this.accounts.findOne({username}, {_id: 1}));
	}

	* login ({username, password}) {
		const passwordChallenge = this._hmac(password, username);

		const user = yield this.accounts.findOne({
			username,
			password: this._hmac(password, username)
		}, {_id: 1});

		if (_.isEmpty(user)) {
			throw new this.NotFoundError('Cannot verify user / password combination');
		}

		return yield* this.createUserToken({username});
	}

	* register ({username, password, avatarUrl}) {
		if (yield* this.userExists({username})) {
			throw new this.ConflictError('User already exists');
		}

		const createOperation = yield this.accounts.insert({
			username,
			// hash the password using hmac256
			password: this._hmac(password, username),

			// pretty useless, but cool to show user avatar capabilities
			avatarUrl
		});

		const {userToken, expires} = yield* this.createUserToken({username});

		return {
			username,

			// retrieve id of created document
			id: _.get(createOperation, 'ops.0._id'),

			userToken, expires
		}
	}

	* verifyUserToken (userToken) {
		try {
			const tokenData = this.dependencies.jwt.decode(userToken, this.jwtSecret);

			/* i dont trust the jwt-simple contract */
			assert(!_.isEmpty(tokenData));

			const {challenge, username, created} = tokenData;

			/* No key should be empty */
			assert(![challenge, username, created].some(_.isEmpty));

			const wasCreated = new Date(created);

			/* It should not have expired */
			assert((Date.now() - wasCreated) < _.get(this, 'config.jwt.ttl'));

			const user = yield this.accounts.findOne({username}, {
				password: 1
			});

			const computedChallenge = this._hmac(username, _.get(user, 'password'));

			/* If our challenge is different, the user changed his password */
			assert(challenge === computedChallenge);

			return true;
		} catch(err) {
			return false;
		}
	}

	* createUserToken ({username}) {
		const user = yield this.accounts.findOne({username}, {
			password: 1, avatarUrl: 1
		});

		if (_.isEmpty(user)) {
			throw new this.NotFoundError('User does not exist');
		}

		const nowTimestamp = (new Date()).toISOString();

		const tokenData = {
			username,
			created: nowTimestamp,
			/*
				create a hmac based on user + hmac(password)
				so that the token is invalidated when the
				user changes his password
			*/
			challenge: this._hmac(username, _.get(user, 'password'))
		};

		const avatarUrl = _.get(user, 'avatarUrl');

		return {
			username, avatarUrl,

			userToken: this.dependencies.jwt.encode(tokenData, this.jwtSecret),
			expires: Date.now() + _.get(this, 'config.jwt.ttl')
		}
	}

	* getUsernameByToken (userToken) {
		if (!(yield* this.verifyUserToken(userToken))) {
			throw new this.TokenError('Invalid user token');
		}

		/* this operation is safe because we validated the token^ */
		const {username} = this.dependencies.jwt.decode(userToken, this.jwtSecret);

		return username;
	}

	* getUserByUsername (username) {
		// The userToken validation is implicit
		const user = yield this.accounts.findOne({
			username
		});

		// Make sure the password hash is not
		// even leaked to ourselves
		return _.omit(user, 'password');
	}

	* getUserByToken (userToken) {
		const username = yield* this.getUsernameByToken(userToken);

		return yield* this.getUserByUsername(username);
	}

	* renewToken({userToken}) {
		const username = yield* this.getUsernameByToken(userToken);

		return yield* this.createUserToken({username});
	}
}

_.extend(UserService.prototype, {
	NotFoundError: class NotFoundError extends BaseError {},
	ConflictError: class ConflictError extends BaseError {},
	TokenError: class TokenError extends BaseError {}
});

module.exports = UserService;