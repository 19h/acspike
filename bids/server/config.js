'use strict';

const _ = require('lodash');

const config = {
	jwt: {
		/* web secret to verify packets sent to bids */
        webBidSecret: 'cOX6/YQ1zSXL/j0CFgdrLqKXjORNLzpS',

		userTokenSecret: 'zaH03KRYZ/0E08HEMt79TVQtSDY=',

		/* used by the api to resolve bid requests */
		bidBrokerSecret: 'FB4GmBayfMyUZqpbrG5opWH0IKmb52',

		ttl: 86400 * 1000 // one day
	},
	passwords: {
		secret: '2v24iJNmu4WVrc+diuAlfLiJiOeNWziI5Purh5sUY4E='
	},
	redis: {
		host: 'redis_bids',
		port: 6379,

		scripts: [{
			name: 'auctionIncrEq',
			script: {
				numberOfKeys: 1,

				lua:
					`
					-- retrieve auction from redis --
					local res = redis.call('GET', KEYS[1]);

					-- check that it exists --
					if res ~= nil then
						res = tonumber(res);

						-- only increment when auction is equal --
						if res ~= nil and res == tonumber(ARGV[1]) then
							-- increase auction by bid amount --
							res = redis.call('INCRBY', KEYS[1], ARGV[2]);
						else
							return {err="Key differs from constraint"};
						end
					else
						-- only increment when auction is equal --
						return {err="Key does not exist"};
					end

					return res`
			}
		}]
	},
	mq: {
		requireAcknowledgement: false,

		queues: [{
			type: 'consumer',
			host: 'rmq_bigpipe',
			queueName: 'bigpipe'
		}, {
			type: 'publisher',
			host: 'rmq_bigpipe',
			queueName: 'smallpipe'
		}],

		messageDefaults: {
			appId: 'bids'
		}
	}
};

try {
	_.extend(config, require('./config.local.js'));
} catch(e) {}

module.exports = config;