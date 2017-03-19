'use strict';

const datastore = require('./datastore');

function getExps(token) {
    return datastore.listExpByCreationTime(10, token)
        .then(function(entities, cursor) {
            return {
                exps: entities,
                nextPageToken: cursor
            };
        });
}

function createExp(passcode) {
    return new Promise(function(resolve, reject) {
        if (passcode == "pg")
            resolve();
        else
            reject(new Error(`wrong pass code: ${credential.passcode}`));
    }).then(() => {
        // create a new experiment with current date.
        return datastore.createNewExperiment(new Date())
    });
}

function readExp(id) {
    return datastore.readExperiment(id);
}

// [START exports]
module.exports = {
    getExps,
    createExp,
    readExp
};
// [END exports]
