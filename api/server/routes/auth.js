'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const bodyParse = require('body-parser');

module.exports = function* ({app, userService}) {
    app.use(bodyParse.json());

    app.use((req, res, next) => {
        Promise.coroutine(function* () {
            const {query, body, headers} = req;

            const inlineUserToken = _.get(body, 'variables');

            const mergedParameters = _.extend({}, query, body, inlineUserToken, headers);

            /*
                try extracting the userToken from:
                1) graph variables
                2) query parameters
                3) headers
                4) post body
            */
            const userToken = _.get(mergedParameters, 'userToken');

            if (!_.isEmpty(userToken)) {
                const user = yield* userService.getUserByToken(userToken);

                req.user = _.extend({userToken}, user);
            }

            next();
        })().catch(err =>
            res.status(400).json({
                errors: [{
                    message: err.message,
                    type: err.name
                }]
            })
        );
    });
};
