'use strict'

const inUT = process.env.LOADED_MOCHA_OPTS == "true";

const {part, exp} = inUT ? require('./dummy') : require('./datastore')

// [START exports]
module.exports = {
    exp,
    part
};
// [END exports]
