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
        claimedFunds: [],
        earnings: [],
        kickedParts: ['None'],
        multipliers: []
    };
}

function newPart(id, expId) {
    return {
        name: 'Participant #' + id,
        experimentId: expId,
        stage: 'instruction',
        excluded: false,
        finishedRound: 0,
        contributions: [],
        claimedContributions: [],
        incomes: [],
        claimedIncomes: [],
        exclusionVotes: ['None'],
        balance: 0,
        claimedBalance: 0
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
            partSize: parseInt(expConfig.partSize, 10),
            kickEnabled: (expConfig.kickEnabled == "true"),
            fakeReputationEnabled: (expConfig.fakeReputationEnabled == "true"),
            numRounds: 8
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

function allWait(fullExp) {
    return fullExp.parts.reduce(
        (allFinished, part) => {
            return allFinished &&
                part.stage == stage.WAIT;
        }, true);
}

/**
 * Validates answer of comprehension test.
 */
function validateComprehensionTest(id, answers) {
    var missedQuestions = [];
    return datastore.part.read(id).then((part) => {
        if (part.stage != stage.INSTRUCTION) {
            return Promise.reject({
                code: 403,
                message: 'You have already finished comprehension test'
            });
        }
        comprehension.questions.forEach(function(question) {
            if (answers[question.name] != question.answer) {
                missedQuestions.push(question.legend);
            }
        });
        if (missedQuestions.length == 0) {
            part.stage = stage.WAIT;

            return datastore.part.update(part).then(() => {
                return loadFullExp(part.experimentId);
            }).then((fullExp) => {
                if (allWait(fullExp)) {
                    fullExp.parts.forEach((part) => {
                        part.stage = stage.SELECT_CONTRIBUTION;
                    });
                    return datastore.part.updateMultiple(fullExp.parts);
                }
            });
        }
    }).then(() => {
        return {
            missedQuestions
        }
    });
}

function submitContribution(id, contribution, claimedContribution) {
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
        if (part.excluded) {
            part.contributions.push(0);
            part.claimedContributions.push(0);
        } else {
            var parsedContribution = parseInt(contribution, 10);
            var parsedClaimedContribution = parseInt(claimedContribution, 10);
            if (parsedClaimedContribution < parsedContribution)
                parsedClaimedContribution = parsedContribution;
            part.contributions.push(parsedContribution);
            part.claimedContributions.push(parsedClaimedContribution);
        }
        part.stage = stage.WAIT;
        return datastore.part.update(part).then(() => {
            return loadFullExp(part.experimentId);
        });
    }).then((fullExp) => {
        if (!allWait(fullExp)) {
            return;
        }
        var exp = fullExp.exp;
        var parts = fullExp.parts;
        var i = exp.finishedRound;
        var numParts = parts.length;
        if (exp.settings.kickEnabled && exp.kickedParts[i] != 'None') {
            numParts--;
            exp.multipliers.push(1.5);
        } else {
            exp.multipliers.push(2);
        }

        exp.funds.push(
            parts.reduce((sum, part) => {
                if (!part.excluded) {
                    part.incomes.push(10 - part.contributions[i]);
                } else {
                    part.incomes.push(0);
                }
                return sum + part.contributions[i];
            }, 0));
        exp.claimedFunds.push(
            parts.reduce((sum, part) => {
                if (part.claimedContributions[i] > part.contributions[i])
                    part.incomes[i] -= (part.claimedContributions[i] - part.contributions[i]) * 0.2;
                if (!part.excluded) {
                    part.claimedIncomes.push(10 - part.claimedContributions[i]);
                } else {
                    part.claimedIncomes.push(0);
                }
                return sum + part.claimedContributions[i];
            }, 0));
        exp.earnings.push(
            exp.funds[i] * exp.multipliers[i]);
        parts.forEach((part) => {
            if (!part.excluded) {
                part.incomes[i] += exp.earnings[i] / numParts;
                part.claimedIncomes[i] += exp.earnings[i] / numParts;
            }
            part.balance += part.incomes[i];
            part.claimedBalance += part.claimedIncomes[i];
            part.stage = stage.VIEW_RESULT;
            ++part.finishedRound;
        });
        ++exp.finishedRound;
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
        return datastore.exp.read(part.experimentId).then((exp) => {
            if (exp.settings.kickEnabled)
                if (part.excluded)
                    part.stage = stage.WAIT;
                else 
                    part.stage = stage.EXCLUSION_VOTE;
            else
                part.stage = stage.SELECT_CONTRIBUTION;
            return datastore.part.update(part);
        }).then(() => {
            return true;
        });
    });
}

/**
 * Submit exclusion vote.
 *
 * return true if vote is valid.
 */
function submitExclusionVote(id, vote) {
    return datastore.part.read(id).then((part) => {
        if (part.stage != stage.EXCLUSION_VOTE) {
            return Promise.reject({
                code: 403,
                message: 'not ready for exclusion vote'
            });
        }
        part.exclusionVotes.push(vote);
        part.stage = stage.WAIT;
        return datastore.part.update(part).then(() => {
            return loadFullExp(part.experimentId);
        });
    }).then((fullExp) => {
        if (!allWait(fullExp)) {
            return;
        }
        var exp = fullExp.exp;
        var parts = fullExp.parts;
        var i = exp.finishedRound;
        var kickedParts = [];

        parts.map((part) => {
            part.excluded = false;
            if (parts.reduce((totalVotes, otherPart) => {
                    if (otherPart.exclusionVotes[i] == part.name) {
                        return totalVotes + 1;
                    }
                    return totalVotes;
                }, 0) * 2 >= exp.settings.partSize) {
                kickedParts.push(part);
            }
            part.stage = stage.SELECT_CONTRIBUTION;
        });
        if (kickedParts.length > 0) {
            var kickedPart = kickedParts[
                Math.floor(Math.random() * kickedParts.length)];
            kickedPart.excluded = true;
            exp.kickedParts.push(kickedPart.name);
        } else {
            exp.kickedParts.push('None');
        }
        return datastore.exp.update(fullExp.exp).then(() => {
            return datastore.part.updateMultiple(fullExp.parts);
        });
    });
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
    readyForNextRound,
    submitExclusionVote,
};
// [END exports]
