'use strict';

const _ = require('lodash');
const assert = require('assert');
const Promise = require('bluebird');

const {
    GraphQLObjectType,
    GraphQLNonNull,
    GraphQLString,
    GraphQLBool,
    GraphQLList,
    GraphQLFloat
} = require('graphql');

const BaseType = require('./baseType');

class AuctionMutationType extends BaseType {
    constructor({name, description}, {auctionService, baseAuctionType}) {
        super({name, description});

        this.auctionService = auctionService;
        this.baseAuctionType = baseAuctionType;
    }

    get fields() {
        const self = this;

        return () => ({
            createAuction: {
                type: this.baseAuctionType,
                args: {
                    title: {
                        description: 'The title of the auction',
                        type: new GraphQLNonNull(GraphQLString)
                    },
                    description: {
                        description: 'The description of the auction',
                        type: new GraphQLNonNull(GraphQLString)
                    },
                    image: {
                        description: 'An image about the auction',
                        type: new GraphQLNonNull(GraphQLString)
                    }
                },
                resolve: Promise.coroutine(function* ({userToken}, {title, description, image}) {
                    return yield* self.auctionService.createAuction({title, description, image}, userToken);
                })
            }
        });
    }
}

class AuctionQueryType extends BaseType {
    constructor({name, description}, {auctionService, baseAuctionType}) {
        super({name, description});

        this.auctionService = auctionService;
        this.baseAuctionType = baseAuctionType;
    }

    get fields() {
        const self = this;

        return () => ({
            activeAuctions: {
                type: new GraphQLList(this.baseAuctionType),
                resolve: Promise.coroutine(function* (root) {
                    return yield* self.auctionService.getActiveAuctions();
                })
            },
            auction: {
                type: this.baseAuctionType,
                args: {
                    auctionId: {
                        description: 'An auction id',
                        type: new GraphQLNonNull(GraphQLString)
                    }
                },
                resolve: Promise.coroutine(function* (root, {auctionId}) {
                    return yield* self.auctionService.getAuction({auctionId});
                })
            }
        });
    }
}

class AuctionType extends BaseType {
    constructor({type, name, description}, {auctionService, baseAuctionType}) {
        super({name, description});

        this.type = type;

        if (type === 'mutation') {
            this.auctionType = new AuctionMutationType({name, description}, {auctionService, baseAuctionType});
        }

        if (type === 'query') {
            this.auctionType = new AuctionQueryType({name, description}, {auctionService, baseAuctionType});
        }
    }

    get schema() {
        return {
            type: this.auctionType.schema,
            name: this.name,
            description: this.description,
            resolve: root => {
                if (this.type === 'mutation') {
                    // Require the user to be authenticated
                    assert(!_.isEmpty(root), 'An active access token must be used to query information about the current user.');
                }

                return root;
            }
        };
    }
}

module.exports = AuctionType;