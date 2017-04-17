'use strict';

const datastore = require('./storage/datastore');

const comprehension = require('./data/comprehension');
const stage = require('./stage');

const kMaxPartSize = 10;

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

        var setting = {
            partSize: parseInt(expConfig.partSize, 10)
        }
        if (!setting.partSize === NaN ||
            !(setting.partSize > 1 && setting.partSize <= kMaxPartSize)) {
            reject({
                code: 400,
                message: 'Number of participants is invalid.'
            });
        }
        resolve(setting);
    }).then((setting) => {
        // Creates a new experiment and corresponding participants with current date.
        // Return new experiment id if no error occurs.
        var expData = {
            creationDate: new Date(),
            setting
        };
        return datastore.exp.create(expData).then((exp) => {
            var partDataList = [];
            for (var i = 0; i < exp.setting.partSize; ++i) {
                partDataList.push({
                    experimentId: exp.id,
                    stage: 'instruction'
                });
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
            part.finishedRound = 0;
            part.contributions = [];
            part.balance = 0;

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
        if (!fullExp.parts.reduce((allFinished, part) => {
                return allFinished &&
                    part.finishedRound + 1 == part.contributions.length;
            }, true)) {
            return;
        }
        var result = {};
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
            part.stage = stage.VIEW_RESULT;
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
    validateComprehensionTest,
    submitContribution,
    readyForNextRound
};
// [END exports]
