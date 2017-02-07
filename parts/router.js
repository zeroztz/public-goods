'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const datastore = require('./datastore');
const comprehension = require('../data/comprehension');

const router = express.Router();

const stageInstruction = 'instruction';
const stageGame = 'game';

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
router.use('/:part*', (req, res, next) => {
    datastore.loadParticipant(req.params.part, (err, part) => {
        if (err) {
            next(err);
            return;
        }
        if (req.pg === undefined) {
            req.pg = {};
        }
        req.pg.part = part;
        next();
    });
});

/**
 * GET /:part
 *
 * Redirects to corresponding pages.
 */
router.get('/:part', (req, res, next) => {
    if (req.pg.part.stage == stageInstruction)
        res.redirect(`${req.baseUrl}/${req.params.part}/instruction`);
    else if (req.pg.part.stage == stageGame)
        res.redirect(`${req.baseUrl}/${req.params.part}/game`);
    else
        next(new Error(`Invalid stage: ${req.pg.part.stage}`));
});

/**
 * POST /:part/comprehension
 *
 * Evaluates submitted answers.
 */
router.post('/:part/comprehension', (req, res, next) => {
    if (req.pg.part.stage != stageInstruction) {
        next(new Error(`You have already finished comprehension test`));
        return;
    }
    const answers = req.body;
    var missCount = 0;
    comprehension.questions.forEach(function(question) {
        if (answers[question.name] != question.answer) {
            ++missCount;
        }
    });
    if (missCount == 0) {
        req.pg.part.stage = stageGame;
        req.pg.part.finishedRound = 0;
        req.pg.part.viewGameResult = false;
        req.pg.part.contributions = [];
        req.pg.part.balance = 0;
        datastore.saveParticipant(req.params.part, req.pg.part, (err) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect(`${req.originalUrl}/correct`);
        });
    } else {
        res.render('parts/comprehension_missed.pug', {
            missCount
        });
    }
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
    if (req.pg.part.stage == stageInstruction) {
        next(new Error("You have not finished comprehension check!"));
        return;
    }
    if (req.pg.part.stage != stageGame) {
        next(new Error("You have finished all the game rounds!"));
        return;
    }
    if (req.pg.part.viewGameResult) {
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
function computeResult(err, participants, res, next) {
    if (err) {
        next(err);
        return;
    }
    boolean allFinished =
        pariticipants.reduce((allPreviousFinished, participant) => {
            return allPreviousFinished &&
                participant.data.finishedRound + 1 ==
                participant.data.contribution.length;
        });
    if (!allFinished) {
        // TODO(ztz): redirect to a page to wait for all participant finish
        // their rounds.
        next(new Error("Please wait"));
        return;
    }
    var result = {
        participantContributions: participants.map((participant) =>
            participant.data.contribution[participant.data.finishedRound])
    };
    result.groupFund =
        result.participantContributions.reduce((sum, contribution) =>
            sum + contribution);
    result.groupEarning =
        result.groupFund * 2;
    result.participantBalances = participants.map((participant) => {
        participant.data.balance += result.groupEarnings / participants.length;
        ++participant.data.finishedRound;
        participant.data.viewResult = true;
        return participant.data.balance;
    });
    saveAllParticipants(participants);
    console.log(result);
    res.render('parts/game_result.pug', result);
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
        return;
    }
    req.pg.part.contributions.push(parseInt(form.contribution));
    datastore.saveParticipant(req.params.part, req.pg.part, (err) => {
        if (err) {
            next(err);
            return;
        }
        datastore.loadAllParticipants(req.pg.part.experimentId,
            (err, participants) => {
                computeResult(err, participants, res, next);
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
