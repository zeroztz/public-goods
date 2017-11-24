'use strict'

const inUT = process.env._.endsWith("mocha")

if (inUT) {
    console.log("inUT");
} else {
    console.log("not inUT");
}

const {part, exp} = inUT ? require('./dummy') : require('./datastore')

// [START exports]
module.exports = {
    exp,
    part
};
// [END exports]
