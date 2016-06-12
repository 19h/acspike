'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const mongodb = require('mongodb');
const {MongoClient} = mongodb;

class MongoArbitrator extends MongoClient {
	constructor ({config}) {
		super();

		this.config = config;
	}

	* establishConnection () {
		const {host, port, db} = _.get(this, 'config.mongo', {});

		return yield (Promise.promisify(cb =>
			this.connect(`mongodb://${host}:${port}/${db}`, cb)
		))();
	}

	static * awaitInstanciation ({config}) {
		const mongoArbitrator = new MongoArbitrator({config});

		return yield* mongoArbitrator.establishConnection();
	}
}

module.exports = MongoArbitrator;