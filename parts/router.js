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

router.use('/:part*', (req, res, next) => {
    api.readPart(req.params.part).then((part) => {
        req.resource = {
            myself: part
        };
        next();
    });
});

/**
 * GET /:part/
 *
 * Redirects to corresponding pages.
 */
router.get('/:part/', (req, res, next) => {
    var resource = req.resource;
    var myself = req.resource.myself;
    if (myself.stage == stage.INSTRUCTION)
        res.render('parts/instruction_basic.pug', resource);
    else if (myself.stage == stage.WAIT)
        res.render('parts/wait.pug', resource);
    else {
        return api.loadFullExp(myself.experimentId).then((fullExp) => {
            resource.exp = fullExp.exp;
            resource.parts = fullExp.parts;
            if (myself.stage == stage.EXCLUSION_VOTE)
                res.render('parts/exclusion_vote.pug', resource);
            else if (myself.stage == stage.SELECT_CONTRIBUTION) {
                if (fullExp.exp.settings.kickEnabled) {
                    if (myself.excluded) {
                        res.render('parts/game_play_excluded.pug', resource);
                    } else {
                        res.render('parts/game_play_not_excluded.pug', resource);
                    }
                } else {
                    res.render('parts/game_play.pug', resource);
                }
            } else if (myself.stage == stage.VIEW_RESULT)
                res.render('parts/game_result.pug', resource);
            else
                next(new Error(`Invalid stage: ${part.stage}`));
        }).catch((err) => {
            next(err);
        });
    }
});

/**
 * GET /:part/comprehension
 *
 * Shows a comprehension test
 */
router.get('/:part/comprehension', (req, res, next) => {
    req.resource.comprehension = comprehension;
    res.render('parts/comprehension.pug', req.resource);
});

/**
 * POST /:part/comprehension
 *
 * Evaluates submitted answers.
 */
router.post('/:part/comprehension', (req, res, next) => {
    api.validateComprehensionTest(req.params.part, req.body).then((result) => {
        req.resource.comprehensionResult = result;
        if (result.missCount == 0) {
            res.render('parts/comprehension_correct.pug', req.resource);
        } else {
            res.render('parts/comprehension_missed.pug', req.resource);
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
