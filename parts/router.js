'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const datastore = require('./datastore');
const comprehension = require('../data/comprehension');

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
 * Loads participant information.
 */
router.use('/:part*', (req, res, next) => {
    datastore.loadParticipant(req.params.part, (err, part) => {
        if (err) {
            next(err);
            return;
        }
        req.pg = {
            part
        };
        console.log(req.pg);
        next();
    });
});

/**
 * POST /:id/comprehension
 *
 * Evaluates submitted answers.
 */
router.post('/:part/comprehension', (req, res, next) => {
    const answers = req.body;
    var pass = true;
    comprehension.questions.forEach(function(question) {
        if (answers[question.name] != question.answer) {
            pass = false;
        }
    });
    if (pass) {
        req.pg.part.stage = 'game'
        req.pg.part.finishedRound = 0
        datastore.saveParticipant(req.params.part, req.pg.part);
        res.redirect(`${req.baseUrl}`);
    } else {
        next(new Error('Incorrect'));
    }
});

/**
 * GET /:part
 *
 * Redirects to corresponding pages.
 */
router.get('/:part', (req, res, next) => {
    if (req.pg.part.stage == 'instruction')
        res.redirect(`${req.baseUrl}/${req.params.part}/instruction`);
    else
        next(new Error(`Invalid stage: ${req.pg.part.stage}`));
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
