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

/*
 * Loads all participants in a experiment.
 */
function loadFullExp(expId) {
    return datastore.exp.read(expId).then((exp) => {
        var fullExp = {
            exp: {
                id: expId,
                data: exp
            }
        }
        return datastore.part.readMultiple(exp.participants).then((parts) => {
            fullExp.parts = parts;
            return fullExp;
        });
    });
}

/**
 * Validates answer of comprehension test.
 */
function validateComprehensionTest(id, answers) {
    var missCount = 0;
    return datastore.part.read(id).then((part) => {
        if (part.stage != stageInstruction) {
            return new Promise((resolve, reject) => {
                reject({
                    code: 403,
                    message: 'You have already finished comprehension test'
                });
            });
        }
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
            part.readyForGame = false;

            return datastore.part.update(id, part).then(() => {
                return loadFullExp(part.experimentId).then((fullExp) => {
                    if (
                        fullExp.parts.reduce(
                            (allReady, part) => (
                                allReady && part.data.stage == stageGame
                            ), true
                        )
                    ) {
                        fullExp.parts.forEach((part) => {
                            part.data.readyForGame = true;
                        });
                        return datastore.part.updateMultiple(fullExp.parts);
                    }
                });
            });
        }
    }).then(() => {
        return {
            missCount
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
