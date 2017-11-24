'use strict'

const inUT = process.env._.endsWith("mocha")

const {part, exp} = inUT ? require('./dummy') : require('./datastore')

// [START exports]
module.exports = {
    exp,
    part
};
// [END exports]
