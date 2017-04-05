'use strict';

const datastore = require('./storage/datastore');

const comprehension = require('./data/comprehension');
const stageInstruction = 'instruction';
const stageGame = 'game';

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

/**
 * Creates a experiment with its participants.
 *
 * It will reject if passcode is incorrect.
 */
function createExp(passcode) {
    return new Promise(function(resolve, reject) {
        if (passcode == "pg")
            resolve(true);
        else
            reject({
                code: 401,
                message: 'unauthorized'
            });
    }).then(() => {
        // Creates a new experiment and corresponding participants with current date.
        // Return new experiment id if no error occurs.
        var expData = {
            creationDate: new Date()
        };
        return datastore.exp.create(expData).then((expId) => {
            var partDataList = [1, 2, 3].map(function(id) {
                return {
                    experimentId: expId,
                    stage: 'instruction'
                };
            });
            return datastore.part.createMultiple(partDataList)
                .then((partIds) => {
                    expData.participants = partIds;
                    return datastore.exp.update(expId, expData)
                        .then(function(entity) {
                            return expId;
                        });
                });
        });
    });
}

function readExp(id) {
    return datastore.exp.read(id);
}

function readPart(id) {
    return datastore.part.read(id);
}

/**
 * Validates answer of comprehension test.
 */
function validateComprehensionTest(id, answers) {
    return datastore.part.read(id).then((part) => {
        if (part.stage != stageInstruction) {
            reject(new Error(`You have already finished comprehension test`));
        }
        var missCount = 0;
        comprehension.questions.forEach(function(question) {
            if (answers[question.name] != question.answer) {
                ++missCount;
            }
        });
        if (missCount == 0) {
            part.stage = stageGame;
            part.finishedRound = 0;
            part.viewGameResult = false;
            part.contributions = [];
            part.balance = 0;
            return datastore.part.update(id, part).then(() => {
                return {
                    missCount
                }
            });
        } else {
            return {
                missCount
            }
        }
    });
}


// [START exports]
module.exports = {
    getExps,
    createExp,
    readExp,
    readPart,
    validateComprehensionTest
};
// [END exports]
