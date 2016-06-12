'use strict';

const _ = require('lodash');
const assert = require('assert');
const Promise = require('bluebird');

const {
    GraphQLObjectType,
    GraphQLNonNull,
    GraphQLString,
    GraphQLList,
    GraphQLFloat
} = require('graphql');

const BaseType = require('./baseType');

class UserMutationType extends BaseType {
    constructor({name, description}, {userService}) {
        super({name, description});

        this.userService = userService;
    }

    get fields() {
        const self = this;

        const userTokenResponse = new GraphQLObjectType({
            name: 'userTokenResponse',
            description: 'A userToken response',
            fields: () => ({
                username: {
                    type: GraphQLString
                },
                userToken: {
                    type: GraphQLString
                },
                expires: {
                    type: GraphQLFloat
                },
                avatarUrl: {
                    type: GraphQLString
                }
            })
        });

        return () => ({
            register: {
                type: userTokenResponse,
                args: {
                    username: {
                        description: 'The username',
                        type: new GraphQLNonNull(GraphQLString)
                    },
                    password: {
                        description: 'The password',
                        type: new GraphQLNonNull(GraphQLString)
                    },
                    avatarUrl: {
                        description: 'The user avatar',
                        type: new GraphQLNonNull(GraphQLString)
                    }
                },
                resolve: Promise.coroutine(function* (root, {username, password, avatarUrl}) {
                    return yield* self.userService.register({username, password, avatarUrl});
                })
            },

            login: {
                type: userTokenResponse,
                args: {
                    username: {
                        description: 'The username',
                        type: new GraphQLNonNull(GraphQLString)
                    },
                    password: {
                        description: 'The password',
                        type: new GraphQLNonNull(GraphQLString)
                    }
                },
                resolve: Promise.coroutine(function* (root, {username, password}) {
                    return yield* self.userService.login({username, password});
                })
            },

            renewToken: {
                type: userTokenResponse,
                args: {
                    userToken: {
                        description: 'The token of the user',
                        type: new GraphQLNonNull(GraphQLString)
                    }
                },
                resolve: Promise.coroutine(function* (root, {userToken}) {
                    return yield* self.userService.renewToken({userToken});
                })
            }
        });
    }
}

class UserQueryType extends BaseType {
    constructor({name, description}, {userService}) {
        super({name, description});

        this.userService = userService;
    }

    get fields() {
        const self = this;

        const userAccount = new GraphQLObjectType({
            name: 'userAccount',
            description: 'A user registration response',
            fields: () => ({
                username: {
                    type: GraphQLString
                },
                avatarUrl: {
                    type: GraphQLString
                }
            })
        });

        return () => ({
            me: {
                type: userAccount,
                /* override default decompsition behaviour */
                resolve: user => user
            }
        });
    }
}

class UserEdge extends BaseType {
    constructor({type, name, description}, {userService}) {
        super({name, description});

        if (type === 'mutation') {
            this.userType = new UserMutationType({name, description}, {userService});
        }

        if (type === 'query') {
            this.userType = new UserQueryType({name, description}, {userService});
        }

        this.type = type;
    }

    get schema() {
        return {
            type: this.userType.schema,
            name: this.name,
            description: this.description,
            resolve: root => {
                if (this.type === 'query') {
                    // Require the user to authenticated
                    assert(!_.isEmpty(root), 'An active access token must be used to query information about the current user.');
                }

                return root;
            }
        };
    }
}

module.exports = UserEdge;