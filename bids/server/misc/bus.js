'use strict';

const assert = require('assert');
const events = require('events');

const _ = require('lodash');
const Promise = require('bluebird');

class Bus extends events {
	constructor ({amqp, logger}, config) {
		super();

		this.dependencies = {
			amqp, logger
		};

		this.config = config;

		this.pipes = {};
	}

	* _setupConnections () {
		const queues = _.get(this, 'config.mq.queues', []);

		for (const queueId in queues) {
			const {queueName} = queues[queueId];

			const pipe = yield* this._awaitReadyPipe(queues[queueId]);

			this.pipes[queueName] = pipe;
		}
	}

	* _awaitReadyPipe ({queueName, type, host}) {
		const pipe = yield (Promise.promisify(cb =>
			this._establishConnectionQueue(queueName, host, cb)
		))();

		if (type === 'consumer') {
			this.dependencies.logger.trace('Subscribing to messages for queue `%s`', queueName);

			pipe.queue.subscribe({
				/* this requires an explicit ack of messages */
				ack: _.get(this, 'config.mq.requireAcknowledgement', true)
			}, (message, headers, deliveryInfo, messageObject) => {
				const eventData = {
					queueName,

					payload: {
						message, headers, deliveryInfo, messageObject
					}
				};

				this.dependencies.logger.debug(eventData, 'Incoming message');

				this.emit('message', eventData);
			});
		}

		this.dependencies.logger.trace('Creating event listener for queue `%s`', queueName);

		this.on(queueName, message => {
			const messageDefaults = _.get(this, 'config.mq.messageDefaults', {});
			const defaultsEnrichedMessage = _.extend({}, messageDefaults, message);

			this.dependencies.logger.debug({
				queueName, payload: defaultsEnrichedMessage
			}, 'Dispatching message');

			pipe.connection.publish(queueName, defaultsEnrichedMessage);
		});

		return pipe;
	}

	_establishConnectionQueue (queueName, host, cb, retryCount = 0) {
		this.dependencies.logger.debug('Establishing connection to %s..', host);

		const connection = this.dependencies.amqp.createConnection({
			host
		});

		connection.on('error', e => {
			this.dependencies.logger.warn(e, 'Connection failed');

			this.removeAllListeners(queueName);

			/*
				Defer for 500ms, then for 1500ms x failed retries
			*/
			setTimeout(500 + (1500 * retryCount++), () =>
				this._establishConnectionQueue(queueName, host, cb, retryCount)
			);
		});

		connection.on('ready', () => {
			this.dependencies.logger.debug('Connected to %s', host);

			connection.queue(queueName, queue => {
				this.dependencies.logger.debug('Using queue %s..', queueName);

				// Subscribe to all messages in this queue
				queue.bind('#');

				cb(null, {
					connection, queue
				});
			});
		});
	}

	static * awaitInstanciation (...args) {
		const bus = new Bus(...args);

		yield* bus._setupConnections();

		return bus;
	}
}

module.exports = Bus;