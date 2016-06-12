'use strict';

const Promise = require('bluebird');

module.exports = {
    asyncWrap:
        generatorFunction => (req, res, ...args) =>
            Promise.coroutine(generatorFunction)(req, res, ...args)
                   .catch(err =>
                        res.status(200).json({
                            error: {
                                message: err.message,
                                type: err.name
                            }
                        })
                    )
};