'use strict'

const datastore = require('./datastore')
const dummy = require('./dummy')

// [START exports]
module.exports = {
    datastore.exp,
    datastore.part
};
// [END exports]
