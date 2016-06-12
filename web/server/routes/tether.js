'use strict';

const path = require('path');

const _ = require('lodash');

const exphbs = require('express-handlebars');

const {asyncWrap} = require('../shared/async');

const enrichWithSession = (msg, req) =>
    _.extend(msg, {
        user: _.get(req, 'session.user', {})
    });

module.exports = {
    * attach ({express, app, config, logger, graphClient}) {
        const apiRouter = express.Router();

        const viewPath = path.join(__dirname, '../../public');

        app.engine('.hbs', exphbs({
            layoutsDir: viewPath,
            partialsDir: `${viewPath}/partials`,
            extname: '.hbs'
        }));

        app.set('view engine', '.hbs');
        app.set('views', viewPath);

        apiRouter.get('/auction/:auctionId', asyncWrap(function* (req, res) {
            const {auctionId} = _.get(req, 'params', {});

            const {auctions} = yield* graphClient.query('auction', {auctionId});

            const auctionVariables = _.get(auctions, 'auction');

            enrichWithSession(auctionVariables, req);

            res.render('auction', auctionVariables);
        }));

        apiRouter.get('/', asyncWrap(function* (req, res) {
            const {auctions} = yield* graphClient.query('auctions');

            enrichWithSession(auctions, req);

            res.render('home', auctions);
        }));

        app.use('/', apiRouter);
    }
};