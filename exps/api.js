'use strict';

const datastore = require('../storage/datastore');

function getExps(token) {
    // Lists all experiments in the Datastore sorted desending by creation time.
    // The ``limit`` argument determines the maximum amount of results to
    // return per page. The ``token`` argument allows requesting additional
    // pages.
    const query = {
        limit: 10,
        order: {
            key: 'creationDate',
            options: {
                descending: true
            }
        },
        startToken: token
    };
    return datastore.exp.runQuery(query).then(function(entities, cursor) {
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
        // Creates a new experiment and corresponding participants with current date.
        // Return new experiment id if no error occurs.
        return datastore.exp.create({
            creationDate: new Date()
        }).then((experimentEntity) => {
            var parts = [1, 2, 3].map(function(id) {
                return {
                    experimentId: experimentEntity.key.id,
                    stage: 'instruction'
                };
            });
            return datastore.part.createMultiple(parts)
                .then(function(participantEntities) {
                    experimentEntity.data.participants =
                        participantEntities.map(
                            (entity) => {
                                return entity.key.id;
                            });
                    return datastore.exp.update(experimentEntity)
                        .then(function(entity) {
                            return entity.key.id;
                        });
                });
        });
    });
}

function readExp(id) {
    return datastore.exp.read(id);
}

// [START exports]
module.exports = {
    getExps,
    createExp,
    readExp
};
// [END exports]
