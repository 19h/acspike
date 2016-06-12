'use strict';

const _ = require('lodash');

class GraphClient {
	constructor ({lokkaClient}, config) {
		this.lokkaClient = lokkaClient;

		this.queries = _.get(config, 'api.queries');
		this.mutations = _.get(config, 'api.mutations');
	}

	* query (name, variables) {
		const query = _.get(this, `queries.${name}`);

		return yield this.lokkaClient.query(query, variables);
	}

	* mutate (name, variables) {
		const query = _.get(this, `mutations.${name}`);

		return yield this.lokkaClient.mutate(query, variables);
	}
}

module.exports = GraphClient;