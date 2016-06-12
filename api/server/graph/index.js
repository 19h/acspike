'use strict';

const {
    GraphQLSchema,
    GraphQLObjectType
} = require('graphql');

const AuctionEdge = require('./auctionType');
const UserEdge = require('./userType');

const baseAuctionType = require('./shared/baseAuctionType');

class BaseTypeProvider {
    constructor(name) {
        this.name = name;
        this.fields = {};
    }

    registerType(type, schema) {
        this.fields[type] = schema;
    }

    getSchema() {
        return new GraphQLObjectType({
            name: this.name,
            fields: () => this.fields
        });
    }
}

module.exports = ({userService, auctionService}) => {
    const queryTypeProvider = new BaseTypeProvider('RootQueryType');

    const auctionQueryEdge = new AuctionEdge({
        type: 'query',

        name: 'AuctionEdge',
        description: 'Graph interface for auctions'
    }, {auctionService, baseAuctionType});

    queryTypeProvider.registerType('auctions', auctionQueryEdge.schema);

    const userEdge = new UserEdge({
        type: 'query',

        name: 'UserEdge',
        description: 'Graph interface for user projection'
    }, {userService});

    queryTypeProvider.registerType('user', userEdge.schema);

    const mutationTypeProvider = new BaseTypeProvider('RootMutationType');

    const userMutationEdge = new UserEdge({
        type: 'mutation',

        name: 'UserMutation',
        description: 'Graph interface for user mutations'
    }, {userService});

    mutationTypeProvider.registerType('user', userMutationEdge.schema);

    const auctionMutationType = new AuctionEdge({
        type: 'mutation',

        name: 'AuctionMutation',
        description: 'Graph interface for auction mutations'
    }, {auctionService, baseAuctionType});

    mutationTypeProvider.registerType('auctions', auctionMutationType.schema);

    return new GraphQLSchema({
        query: queryTypeProvider.getSchema(),
        mutation: mutationTypeProvider.getSchema()
    });
}
