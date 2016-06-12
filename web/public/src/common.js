'use strict';

const Promise = require('bluebird');
const EventEmitter = require('./events');

const Handlebars = require('handlebars');
const $ = require('jquery');

class APIRequest {
	constructor (XMLHttpRequest) {
		this.XMLHttpRequest = XMLHttpRequest;
	}

	_genericOperation (method, path, data, isJson) {
		return Promise.promisify(cb => {
			const xhr = new XMLHttpRequest();

			xhr.open(method, path, true);

			if (isJson) {
				xhr.setRequestHeader('Content-type', 'application/json');
			}

			xhr.onreadystatechange = function() {
				if (xhr.readyState !== 4) return;

				if (!isJson) {
					return cb(xhr.status >= 400, this.responseText);
				}

				let response;

				try {
					response = JSON.parse(this.responseText);
				} catch(err) {
					return cb(err);
				}

				cb(xhr.status >= 400, response);
			}

			xhr.send(data);
		})();
	}

	* _arbitrateResponse (msg) {
		if ('error' in msg) {
			throw new Error(msg.error.message);
		}

		return msg;
	}

	* post (path, data) {
		const result = yield this._genericOperation('POST', path, JSON.stringify(data), true);

		return yield* this._arbitrateResponse(result);
	}

	* get (path) {
		const result = yield this._genericOperation('GET', path, null, true);

		return yield* this._arbitrateResponse(result);
	}

	* rawGet (path) {
		return yield this._genericOperation('GET', path, null, false);
	}
}

class LoginController extends EventEmitter {
	constructor (topBarElement, dependencies) {
		super();

		this._topBarElement = topBarElement;
		this._dependencies = dependencies;

		this.user = null;
	}

	_registerEvent (selector, type, fn) {
		const boundFn = fn.bind(this);

		this._topBarElement.find(selector).on(type, boundFn);
	}

	_unregisterAllEvents () {
		this._topBarElement.find('*').off();
	}

	_setupLoginFormEvents () {
		/* render registration form */
		this._registerEvent('a.register-switch', 'click', (...args) =>
			this._showRegisterForm(...args)
		);

		const submitHandler = Promise.coroutine(function* () {
			yield* this._loginUser()
		});

		this._registerEvent('a.button.login-submit', 'click', submitHandler);
		this._registerEvent('input', 'keypress', e => ((e.which === 13) && submitHandler.call(this) || true));
	}

	_setupRegisterFormEvents () {
		/* render login form */
		this._registerEvent('a.login-switch', 'click', (...args) =>
			this._showLoginForm(...args)
		);

		const submitHandler = Promise.coroutine(function* () {
			yield* this._registerUser()
		});

		this._registerEvent('a.button.register-submit', 'click', submitHandler);
		this._registerEvent('input', 'keypress', e => ((e.which === 13) && submitHandler.call(this) || true));
	}

	_setupLoggedInFormEvents () {
		/* allow logout */
		this._registerEvent('a.button.logout', 'click', Promise.coroutine(function* (...args) {
			yield* this._logoutUser(...args)
		}));
	}

	_showRegisterForm () {
		this._renderRegisterForm();
	}

	_showLoginForm () {
		this._renderLoginForm();
		this._setupRegisterFormEvents();
	}

	_collectAuthFormData () {
		const username = this._topBarElement.find('input.username').val();
		const password = this._topBarElement.find('input.password').val();
		const avatarUrl = this._topBarElement.find('input.avatarUrl').val();

		return { username, password, avatarUrl };
	}

	* _loginUser () {
		const userData = this._collectAuthFormData();

		try {
			const result = yield* this._dependencies.apiRequest.post('/api/login', userData, true);

			this._setUser(result.user);
		} catch(err) {
			// this would be an error message on the page
			alert(err.message);

			return;
		}

		this._renderLoginForm();
	}

	* _logoutUser () {
		yield* this._dependencies.apiRequest.rawGet('/api/logout');

		this._setUser(null);
		this._renderLoginForm();
	}

	* _registerUser () {
		const userData = this._collectAuthFormData();

		try {
			const result = yield* this._dependencies.apiRequest.post('/api/register', userData, true);

			this._setUser(result.user);
		} catch(err) {
			// this would be an error message on the page
			alert(err.message);

			return;
		}

		this._renderLoginForm();
	}

	_setupInitialFormEvents() {
		if (!this.user) {
			return this._setupLoginFormEvents();
		}

		return this._setupLoggedInFormEvents();
	}

	_renderLoginForm () {
		this._unregisterAllEvents();

		const loginMenu = this._dependencies.mainController.getTemplate('loginMenu');

		this._topBarElement.html(loginMenu(this.user));

		this._setupInitialFormEvents();
	}

	_renderRegisterForm () {
		this._unregisterAllEvents();

		const registerForm = this._dependencies.mainController.getTemplate('registerForm');

		this._topBarElement.html(registerForm(this.user));

		this._setupRegisterFormEvents();
	}

	* _retrieveUser () {
		try {
			return yield* this._dependencies.apiRequest.get('/api/me');
		} catch(err) {
			return null;
		}
	}

	_setUser (user) {
		this.user = user;

		this.emit('user change', user);
	}

	getUser (user) {
		return this.user;
	}

	* _initializeUser () {
		const user = yield* this._retrieveUser();

		this._setUser(user);
	}

	* initialize () {
		yield* this._initializeUser();

		this._setupInitialFormEvents();
	}
}

class AuctionBidController {
	constructor (auctionBidContainer, dependencies) {
		this._auctionBidContainer = auctionBidContainer;
		this._bidButton = auctionBidContainer.find('.button.submit-bid');
		this._bidStatus = auctionBidContainer.find('.bidStatus');

		this._dependencies = dependencies;

		/* hardcoded to 1000 for now... */
		this._defaultBidAmount = 1000;

		this._isLoggedIn = false;

		this._auction = null;
		this._latestBid = null;

		this._setupListeners();
	}

	_setupListeners () {
		this._dependencies.loginController.on('user change', user =>
			this._handleUserChange(user)
		);

		this._dependencies.bidStreamEmitter.on('bid', bid =>
			this._handleStreamedBid(bid)
		);

		const self = this;

		this._bidButton.on('click', Promise.coroutine(function* () {
			yield* self._initiateBid();
		}));
	}

	_handleUserChange (user) {
		this._isLoggedIn = !!user;
	}

	_handleStreamedBid ({user, bid}) {
		const protoBidStatus = this._dependencies.mainController.getTemplate('bidStatus');

		const updatedBidStatus = $(protoBidStatus({
			highestBidder: user,
			highestBid: bid.totalAmount
		}));

		this._bidStatus.replaceWith(updatedBidStatus);
		this._bidStatus = updatedBidStatus;

		this._latestBid = {user, bid};
	}

	* _loadCurrentAuction (auctionId) {
		const result = yield* this._dependencies.apiRequest.post('/api/auction', {
			auctionId
		});

		this._auction = result.auctions.auction;
	}

	_getHighestBid () {
		/* use latest bid */
		if (this._latestBid) {
			return {
				highestBidder: this._latestBid.user,
				highestBid: this._latestBid.bid.totalAmount
			};
		}

		/* fallback to initial data */
		return this._auction;
	}

	* _initiateBid () {
		const {highestBid} = this._getHighestBid();

		yield* this._dependencies.apiRequest.post('/api/auction/bid', {
			auctionId: this._auction.auctionId,
			knownAmount: highestBid,
			bidAmount: this._defaultBidAmount
		});
	}

	* initialize (auctionId) {
		yield* this._loadCurrentAuction(auctionId);
	}
}

class BidStreamEmitter extends EventEmitter {
	constructor () {
		super();

		this._bidStream = io.connect({
			path: '/bids'
		});
	}

	handleAuctionBids (auctionId) {
		this._bidStream.on(`auction:${auctionId}`, msg =>
			this.emit('bid', msg)
		);
	}
}

class MainController {
	constructor (body, dependencies) {
		this._body = $(body);
		this._dependencies = dependencies;

		this._user = {};

		this._templates = [
			'bidStatus',
			'loginMenu',
			'registerForm'
		];

		const topBarElement = this._body.find('.top-bar > .top-bar-right > .menu');

		this._loginController = new LoginController(topBarElement, {
			mainController: this,
			apiRequest: this._dependencies.apiRequest,
			Handlebars: this._dependencies.Handlebars
		});
	}

	getTemplate (template) {
		return this._templates.get(template);
	}

	* _loadTemplates () {
		for(const templateId in this._templates) {
			const templateName = this._templates[templateId];

			const partialPath = `/partials/${templateName}.hbs`;

			const rawTemplate = yield* apiRequest.rawGet(partialPath);
			const compiledTemplate = this._dependencies.Handlebars.compile(rawTemplate);

			this._templates[templateId] = [
				templateName,
				compiledTemplate
			];
		}

		this._templates = new Map(this._templates);
	}

	_populateEnvironment () {
		try {
			const [locationPath, auctionId] = location.pathname.match(/\/auction\/(.*)\/?/);

			return {auctionId};
		} catch(err) {
			return {};
		}
	}

	* _initializeAuction (auctionId) {
		const auctionBidContainer = this._body.find('.auction-bid-flex');

		this._bidStreamEmitter = new BidStreamEmitter();
		this._bidStreamEmitter.handleAuctionBids(auctionId);

		this._auctionBidController = new AuctionBidController(auctionBidContainer, {
			mainController: this,
			loginController: this._loginController,
			bidStreamEmitter: this._bidStreamEmitter,
			apiRequest: this._dependencies.apiRequest
		});

		yield* this._auctionBidController.initialize(auctionId);
	}

	* initialize () {
		yield* this._loadTemplates();
		yield* this._loginController.initialize();

		const {auctionId} = this._populateEnvironment();

		/* only execute for auction */
		if (auctionId) {
			yield* this._initializeAuction(auctionId);
		}
	}
}

const apiRequest = new APIRequest(XMLHttpRequest);

const mainController = new MainController(document.body, {
	apiRequest, Handlebars
});

Promise.coroutine(function* () {
	yield* mainController.initialize();
})();

window.createAuction = Promise.coroutine(function* ({title, description, image}) {
	yield* apiRequest.post('/api/auction/new', {title, description, image});
});