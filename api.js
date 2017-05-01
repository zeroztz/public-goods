'use strict';

const datastore = require('./storage/datastore');

const comprehension = require('./data/comprehension');
const stage = require('./stage');

const kMaxPartSize = 10;

function newExp(settings) {
    return {
        creationDate: new Date(),
        settings,
        finishedRound: 0,
        funds: [],
        earnings: []
    };
}

function newPart(id, expId) {
    return {
        name: 'Participant #' + id,
        experimentId: expId,
        stage: 'instruction',
        finishedRound: 0,
        contributions: [],
        endOfTurnBalances: [],
        balance: 0
    };
}

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
function createExp(expConfig) {
    return new Promise(function(resolve, reject) {
        if (expConfig.passcode != "pg")
            reject({
                code: 401,
                message: 'unauthorized'
            });

        var settings = {
            partSize: parseInt(expConfig.partSize, 10)
        }
        if (!settings.partSize === NaN ||
            !(settings.partSize > 1 && settings.partSize <= kMaxPartSize)) {
            reject({
                code: 400,
                message: 'Number of participants is invalid.'
            });
        }
        resolve(settings);
    }).then((settings) => {
        // Creates a new experiment and corresponding participants with current date.
        // Return new experiment id if no error occurs.
        var expData = newExp(settings);
        return datastore.exp.create(expData).then((exp) => {
            var partDataList = [];
            for (var i = 1; i <= exp.settings.partSize; ++i) {
                partDataList.push(newPart(i, exp.id));
            };
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
            exp
        };
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
        if (part.stage != stage.INSTRUCTION) {
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
            part.stage = stage.WAIT_FOR_COMPREHENSION;

            return datastore.part.update(part).then(() => {
                return loadFullExp(part.experimentId);
            }).then((fullExp) => {
                if (
                    fullExp.parts.reduce(
                        (allReady, part) => (
                            allReady && part.stage == stage.WAIT_FOR_COMPREHENSION
                        ), true
                    )
                ) {
                    fullExp.parts.forEach((part) => {
                        part.stage = stage.SELECT_CONTRIBUTION;
                    });
                    return datastore.part.updateMultiple(fullExp.parts);
                }
            });
        }
    }).then(() => {
        return {
            missCount
        }
    });
}

function submitContribution(id, contribution) {
    return datastore.part.read(id).then((part) => {
        if (part.stage != stage.SELECT_CONTRIBUTION) {
            return Promise.reject({
                code: 403,
                message: 'not in game stage'
            });
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
        var i = fullExp.exp.finishedRound;
        if (!fullExp.parts.reduce((allFinished, part) => {
                return allFinished &&
                    i + 1 == part.contributions.length;
            }, true)) {
            return;
        }
        fullExp.exp.funds.push(
            fullExp.parts.reduce((sum, part) => {
                part.balance += 10 - part.contributions[i];
                return sum + part.contributions[i];
            }, 0));
        fullExp.exp.earnings.push(
            fullExp.exp.funds[i] * 2);
        fullExp.parts.forEach((part) => {
            part.balance += fullExp.exp.earnings[i] / fullExp.parts.length;
            part.endOfTurnBalances.push(part.balance);
            ++part.finishedRound;
            part.stage = stage.VIEW_RESULT;
        });
        ++fullExp.exp.finishedRound;
        return datastore.exp.update(fullExp.exp).then(() => {
            return datastore.part.updateMultiple(fullExp.parts);
        });
    });
}

/**
 * Notify participant is ready for next round.
 *
 * return true if succeed.
 */
function readyForNextRound(id) {
    return datastore.part.read(id).then((part) => {
        if (part.stage != stage.VIEW_RESULT) {
            return false;
        }
        part.stage = stage.SELECT_CONTRIBUTION;
        return datastore.part.update(part).then(() => {
            return true;
        });
    })
}

// [START exports]
module.exports = {
    getExps,
    createExp,
    readExp,
    readPart,
    loadFullExp,
    validateComprehensionTest,
    submitContribution,
    readyForNextRound
};
// [END exports]
