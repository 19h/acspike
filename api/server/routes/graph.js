const expressGraphql = require('express-graphql');

const _ = require('lodash');

const querySchema = require('../graph');

module.exports = function* ({app, userService, auctionService}) {
    const initializedQuerySchema = querySchema({userService, auctionService});

    app.use('/', expressGraphql(
        req => {
            const rootValue = _.get(req, 'user', {});

            return {
                rootValue,
                /* show graphiql interface (gui) */
                graphiql: true,
                schema: initializedQuerySchema
            }
        })
    );
};
