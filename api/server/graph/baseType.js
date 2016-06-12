'use strict';

const {
    GraphQLObjectType
} = require('graphql');

module.exports = class BaseType {
    constructor({name, description}) {
        this.name = name;
        this.description = description;
    }

    get schema() {
        return new GraphQLObjectType({
            name: this.name,
            description: this.description,
            fields: this.fields
        });
    }

    get fields() {
        return () => ({});
    }
};
