'use strict';

const _ = require('lodash');

const config = {
    api: {
        graphApi: 'http://api:2001/',

        mutations: {
            login:
                `($username: String!, $password: String!) {
                    user {
                        user: login(username: $username, password: $password) {
                            username, avatarUrl, userToken, expires
                        }
                    }
                }`,

            register:
                `($username: String!, $password: String!, $avatarUrl: String!) {
                    user {
                        user: register(username: $username, password: $password, avatarUrl: $avatarUrl) {
                            username, userToken, expires
                        }
                    }
                }`,

            renewToken:
                `($userToken: String!) {
                    user {
                        user: renewToken(userToken: $userToken) {
                            username, userToken, expires
                        }
                    }
                }`,

            /*
                when creating an auction, we only want the id
                since we're redirecting the user to the detail
                page
            */
            createAuction:
                `($title: String!, $description: String!, $image: String!) {
                    auctions {
                        createAuction(title:$title, description: $description, image: $image) {
                            id
                        }
                    }
                }`
        },

        queries: {
            me:
                `query {
                    user {
                        me { username, avatarUrl }
                    }
                }`,

            auctions:
                `query {
                    auctions {
                        activeAuctions {
                            id item { title description image }
                        }
                    }
                }`,

            auction:
                `query ($auctionId: String!) {
                    auctions {
                        auction(auctionId: $auctionId) {
                            auctionId: id created
                            author { username, avatarUrl }
                            highestBidder { username, avatarUrl }
                            item { title description image }

                            highestBid
                        }
                    }
                }`
        }
    },
    server: {
        port: process.env.PORT || 2000
    },
    jwt: {
        /* web secret to verify packets sent to bids */
        webBidSecret: 'cOX6/YQ1zSXL/j0CFgdrLqKXjORNLzpS'
    },
    sessions: {
        default: {
            secret: '6dBkOBvMN0xxCqj9f1iuUvcGG8ZaTWhQ',

            /* do not store before session was mutated */
            saveUninitialized: false,

            /* force session update for ttl */
            resave: true,

            /* period before now when the token will be renewed */
            renewalPeriod: 3600 * 1000
        },

        redis: {
            ttl: 7200 * 1000
        },


    },
    redis: {
        host: 'redis_sessions',
        port: 6379
    },
    mq: {
        requireAcknowledgement: false,

        queues: [{
            type: 'consumer',
            host: 'rmq_bigpipe',
            queueName: 'backpipe'
        }, {
            type: 'publisher',
            host: 'rmq_bigpipe',
            queueName: 'bigpipe'
        }],

        messageDefaults: {
            appId: 'web'
        }
    }
};

try {
    _.extend(config, require('./config.local.js'));
} catch(e) {}

module.exports = config;