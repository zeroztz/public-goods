'use strict';

const express = require('express');
const bodyParser = require('body-parser');
//const datastore = require('./datastore');
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
router.use((req, res, next) => {
    console.log("Load participant");
    req.pg = {
        part: {
            stage: 'instruction'
        }
    };
    next();
});

/**
 * POST /:id/comprehension
 *
 * Evaluates submitted answers
 */
router.post('/:part/comprehension', (req, res, next) => {
    const answers = req.body;
    var pass = true;
    comprehension.questions.forEach(function(question) {
        if (answers[question.name] != question.answer) {
            pass = false;
        }
    });
    console.log(pass);
    // TODO(ztz): render coressponding page.
    next();
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
        res.render('error.pug', {
            errorMsg: `Invalid stage: ${req.pg.part.stage}`
        });
});

module.exports = router;
