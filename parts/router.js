'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const api = require(`../api`);

const comprehension = require('../data/comprehension');
const stage = require('../stage');

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
 * GET /:part/
 *
 * Redirects to corresponding pages.
 */
router.get('/:part/', (req, res, next) => {
    api.readPart(req.params.part).then((part) => {
        if (part.stage == stage.INSTRUCTION)
            res.render('parts/instruction_basic.pug');
        else if (part.stage == stage.WAIT)
            res.render('parts/wait.pug');
        else if (part.stage == stage.EXCLUSION_VOTE)
            return api.loadFullExp(part.experimentId).then((fullExp) => {
                res.render('parts/exclusion_vote.pug', fullExp);
            });
        else if (part.stage == stage.SELECT_CONTRIBUTION) {
            return api.loadFullExp(part.experimentId).then((fullExp) => {
                if (fullExp.exp.settings.kickEnabled) {
                    if (part.excluded) {
                        res.render('parts/game_play_excluded.pug');
                    } else {
                        res.render('parts/game_play_not_excluded.pug',
                            fullExp);
                    }
                } else {
                    res.render('parts/game_play.pug', fullExp);
                }
            });
        } else if (part.stage == stage.VIEW_RESULT)
            return api.loadFullExp(part.experimentId).then((fullExp) => {
                fullExp.myself = part;
                res.render('parts/game_result.pug', fullExp);
            });
        else
            next(new Error(`Invalid stage: ${part.stage}`));
    }).catch((err) => {
        next(err);
    });
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
 * POST /:part/game
 *
 * Receives contribution of a round.
 */
router.post('/:part/game', (req, res, next) => {
    api.submitContribution(req.params.part, req.body.contribution, req.body.claimedContribution).then(() => {
        res.redirect(`${req.baseUrl}/${req.params.part}/`);
    }, (err) => {
        next(err);
    });
});

/**
 * POST /:part/next-round
 *
 * Receives signal that participant is ready for next round.
 */
router.post('/:part/next-round', (req, res, next) => {
    api.readyForNextRound(req.params.part).then(() => {
        res.redirect(`${req.baseUrl}/${req.params.part}/`);
    }, (err) => {
        next(err);
    });
});

/**
 * POST /:part/exclusion-vote
 *
 * Receives signal that participant is ready for next round.
 */
router.post('/:part/exclusion-vote', (req, res, next) => {
    api.submitExclusionVote(req.params.part, req.body.vote).then(() => {
        res.redirect(`${req.baseUrl}/${req.params.part}/`);
    }, (err) => {
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
