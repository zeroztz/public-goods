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
    return datastore.exp.runQuery(query);
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
        return datastore.exp.create(expData).then((exp) => {
            var partDataList = [1, 2, 3].map(function(id) {
                return {
                    experimentId: exp.id,
                    stage: 'instruction'
                };
            });
            return datastore.part.createMultiple(partDataList)
                .then((parts) => {
                    exp.participants = parts.map((part) => part.id);
                    return datastore.exp.update(exp)
                        .then(function() {
                            return exp.id;
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
            return Promise.reject({
                code: 403,
                message: 'You have already finished comprehension test'
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

            return datastore.part.update(part).then(() => {
                return loadFullExp(part.experimentId).then((fullExp) => {
                    if (
                        fullExp.parts.reduce(
                            (allReady, part) => (
                                allReady && part.stage == stageGame
                            ), true
                        )
                    ) {
                        fullExp.parts.forEach((part) => {
                            part.readyForGame = true;
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

function submitContribution(id, contribution) {
    let result = {};
    return datastore.part.read(id).then((part) => {
        if (part.stage != stageGame) {
            return Promise.reject('not in game stage');
        }
        if (part.contributions.length != part.finishedRound) {
            return Promise.reject({
                code: 403,
                message: "You have already made contribution this round"
            });
        }
        part.contributions.push(parseInt(contribution, 10));
        return datastore.part.update(part).then(() => {
            return loadFullExp(part.experimentId);
        });
    }).then((fullExp) => {
        if (!fullExp.parts.reduce((allFinished, part) => {
                return allFinished &&
                    part.finishedRound + 1 == part.contributions.length;
            }, true)) {
            return Promise.reject('not all finished');
        }
        result.participantContributions = fullExp.parts.map(
            (part) => {
                var contributions = part.contributions[part.finishedRound];
                part.balance += 10 - contributions;
                return contributions;
            });

        result.groupFund =
            result.participantContributions.reduce((sum, contribution) =>
                sum + contribution);
        result.groupEarning =
            result.groupFund * 2;
        result.participantBalances = fullExp.parts.map((part) => {
            part.balance += result.groupEarning / fullExp.parts.length;
            ++part.finishedRound;
            part.viewGameResult = true;
            return part.balance;
        });
        if (fullExp.exp.results === undefined) {
            fullExp.exp.results = [result];
        } else {
            fullExp.exp.results.push(result);
        }
        return datastore.exp.update(fullExp.exp).then(() => {
            return datastore.part.updateMultiple(fullExp.parts);
        });
    }).then(() => {
        return result;
    });
}

// [START exports]
module.exports = {
    getExps,
    createExp,
    readExp,
    readPart,
    validateComprehensionTest,
    submitContribution
};
// [END exports]
