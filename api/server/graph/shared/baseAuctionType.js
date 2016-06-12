'use strict';

const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLList,
    GraphQLInt
} = require('graphql');

const baseAuctionAuthor = new GraphQLObjectType({
    name: 'AuctionAuthor',
    description: 'An auction author',
    fields: () => ({
        username: {
            type: GraphQLString
        },
        avatarUrl: {
            type: GraphQLString
        }
    })
});

const baseAuctionHighestBidder = new GraphQLObjectType({
    name: 'AuctionHighestBidder',
    description: 'An auction highest bidder',
    fields: () => ({
        username: {
            type: GraphQLString
        },
        avatarUrl: {
            type: GraphQLString
        }
    })
});

const baseAuctionItem = new GraphQLObjectType({
    name: 'AuctionItem',
    description: 'An auction',
    fields: () => ({
        title: {
            type: GraphQLString
        },
        description: {
            type: GraphQLString
        },
        image: {
            type: GraphQLString
        }
    })
});

const baseAuctionBid = new GraphQLObjectType({
    name: 'AuctionBid',
    description: 'An auction bid',
    fields: () => ({
        username: {
            type: GraphQLString
        },
        bidAmount: {
            type: GraphQLInt
        },
        totalAmount: {
            type: GraphQLInt
        },
        date: {
            type: GraphQLString
        }
    })
});

const baseAuctionType = new GraphQLObjectType({
    name: 'Auction',
    description: 'An auction',
    fields: () => ({
        id: {
            type: GraphQLString,
            resolve: ({_id}) => _id
        },

        author: {
            type: baseAuctionAuthor
        },
        highestBidder: {
            type: baseAuctionHighestBidder
        },
        created: {
            type: GraphQLString
        },
        item: {
            type: baseAuctionItem
        },
        bids: {
            type: new GraphQLList(baseAuctionBid)
        },
        highestBid: {
            type: GraphQLInt
        }
    })
});

module.exports = baseAuctionType;