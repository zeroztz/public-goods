'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const api = require(`../api`);

const comprehension = require('../data/comprehension');
const stageInstruction = 'instruction';
const stageGame = 'game';

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
 * GET /:part
 *
 * Redirects to corresponding pages.
 */
router.get('/:part', (req, res, next) => {
    api.readPart(req.params.part).then((part) => {
        if (part.stage == stageInstruction)
            res.redirect(`${req.baseUrl}/${req.params.part}/instruction`);
        else if (part.stage == stageGame)
            res.redirect(`${req.baseUrl}/${req.params.part}/game`);
        else
            next(new Error(`Invalid stage: ${part.stage}`));
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
            res.render('parts/comprehension_correct.pug');
        } else {
            res.render('parts/comprehension_missed.pug', result);
        }
    }).catch((err) => {
        next(err);
    });
});

/**
 * GET /:part/game
 *
 * Plays a round of game or shows result of a round.
 */
router.get('/:part/game', (req, res, next) => {
    api.readPart(req.params.part).then((part) => {
        if (part.stage != stageGame) {
            res.redirect(`${req.baseUrl}/${req.params.part}`);
        } else if (!part.readyForGame) {
            res.render('parts/comprehension_wait.pug');
        } else if (part.viewGameResult) {
            return api.readExp(part.experimentId).then((exp) => {
                res.render('parts/game_result.pug', exp.results[exp.results.length - 1]);
            });
        } else {
            res.render('parts/game_play.pug');
        }
    }, (err) => {
        next(err);
    });
});

/**
 * POST /:part/game
 *
 * Receives contribution of a round.
 */
router.post('/:part/game', (req, res, next) => {
    api.submitContribution(req.params.part, req.body.contribution).then(
        (result) => {
            res.render('parts/game_result.pug', result);
        }, (err) => {
            if (err == 'not in game stage')
                res.redirect(`${req.baseUrl}/${req.params.part}`);
            else if (err == 'not all finished')
                res.render('parts/game_wait.pug');
            else
                next(err);
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
