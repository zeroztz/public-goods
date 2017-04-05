'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const api = require(`../api`);

// TODO: remove
const datastore = require('./datastore');
const comprehension = require('../data/comprehension');
const stageInstruction = 'instruction';
const stageGame = 'game';
// end TODO

const router = express.Router();

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({
    extended: false
}));

// Set Content-Type for all responses for these ruotes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

/**
 * GET /:part/instruction
 *
 * Instructions of the experiment.
 */
router.get('/:part/instruction', (req, res, next) => {
    // TODO(ztz): make instruction extensible.
    res.render('parts/instruction_basic.pug');
});

/**
 * GET /:part/comprehension
 *
 * Shows a comprehension test
 */
router.get('/:part/comprehension', (req, res, next) => {
    res.render('parts/comprehension.pug', comprehension);
});

/**
 * Loads participant on all /:part*.
 */
// TODO remove this part when pg is not used anymore.
router.use('/:part*', (req, res, next) => {
    api.readPart(req.params.part).then((result) => {
        if (!result) {
            next({
                code: 404,
                message: 'Not found'
            });
            return;
        }
        if (req.pg === undefined) {
            req.pg = {};
        }
        req.pg.part = result;
        next();
    }).catch(function(err) {
        next(err);
    });
});

/**
 * GET /:part
 *
 * Redirects to corresponding pages.
 */
router.get('/:part', (req, res, next) => {
    api.readPart(req.params.part).then((result) => {
        if (result.stage == stageInstruction)
            res.redirect(`${req.baseUrl}/${req.params.part}/instruction`);
        else if (result.stage == stageGame)
            res.redirect(`${req.baseUrl}/${req.params.part}/game`);
        else
            next(new Error(`Invalid stage: ${result.stage}`));
    }).catch((err) => {
        next(err);
    });
});

/**
 * POST /:part/comprehension
 *
 * Evaluates submitted answers.
 */
router.post('/:part/comprehension', (req, res, next) => {
    api.validateComprehensionTest(req.params.part, req.body).then((result) => {
        if (result.missCount == 0) {
            res.redirect(`${req.originalUrl}/correct`);
        } else {
            res.render('parts/comprehension_missed.pug', {
                missCount
            });
        }
    });
});

/**
 * GET /:part/comprehension/correct
 *
 * Shows comprehension test passing message and guide participant to game.
 * Checks whether it's in the correct stage, if not show an error message instead.
 */
router.get('/:part/comprehension/correct', (req, res, next) => {
    if (req.pg.part.stage != stageInstruction) {
        res.render('parts/comprehension_correct.pug');
    } else {
        next(new Error("You didn't finish comprehension check!"));
    }
});

/**
 * GET /:part/game
 *
 * Plays a round of game or shows result of a round.
 */
router.get('/:part/game', (req, res, next) => {
    // TODO(ztz): big issue. Some participans might start game before other finished comprehension test.
    if (req.pg.part.stage == stageInstruction) {
        next(new Error("You have not finished comprehension check!"));
        return;
    }
    if (req.pg.part.stage != stageGame) {
        next(new Error("You have finished all the game rounds!"));
        return;
    }
    if (req.pg.part.viewGameResult) {
        // TODO(ztz): store result in exp and display it here.
        res.redirect(`${req.baseUrl}/${req.params.part}/game/result`);
    } else {
        res.render('parts/game_play.pug');
    }
});

/**
 * POST /:part/game
 *
 * Receives contribution of a round.
 */
function computeResult(err, fullExperiment, res, next) {
    if (err) {
        next(err);
        return;
    }
    var participants = fullExperiment.participants;
    var allFinished =
        participants.reduce((allPreviousFinished, participant) => {
            return allPreviousFinished &&
                participant.data.finishedRound + 1 ==
                participant.data.contributions.length;
        }, true);
    if (!allFinished) {
        res.render('parts/game_wait.pug');
        return;
    }
    var result = {
        participantContributions: participants.map((participant) =>
            participant.data.contributions[participant.data.finishedRound])
    };
    result.groupFund =
        result.participantContributions.reduce((sum, contribution) =>
            sum + contribution);
    result.groupEarning =
        result.groupFund * 2;
    result.participantBalances = participants.map((participant) => {
        participant.data.balance += result.groupEarning / participants.length;
        ++participant.data.finishedRound;
        participant.data.viewGameResult = true;
        return participant.data.balance;
    });
    console.log(result);
    fullExperiment.experiment.results.push(result);
    datastore.updateFullExperiment(participants, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.render('parts/game_result.pug', result);
    });
}
router.post('/:part/game', (req, res, next) => {
    if (req.pg.part.stage != stageGame) {
        next(new Error("You are not in game stage"));
        return;
    }
    const form = req.body;
    if (req.pg.part.contributions.length !=
        req.pg.part.finishedRound) {
        next(new Error("You have already made contribution this round"));
    } else {
        console.log("a", form.contribution);
        req.pg.part.contributions.push(parseInt(form.contribution));
        console.log("b", req.pg.part.contributions[0]);
    }
    datastore.saveParticipant(req.params.part, req.pg.part, (err) => {
        if (err) {
            next(err);
            return;
        }
        datastore.loadFullExperiment(req.pg.part.experimentId,
            (err, fullExperiment) => {
                console.log(fullExperiment);
                computeResult(err, fullExperiment, res, next);
            });
    });
});


/**
 * Errors on "/*" routes.
 */
router.use((err, req, res, next) => {
    // Format error and forward to generic error handler for logging and
    // responding to the request
    err.response = err.message;
    next(err);
});

module.exports = router;
