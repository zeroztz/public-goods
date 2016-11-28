'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const datastore = require('./datastore');

const router = express.Router();

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({
    extended: false
}));

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

/**
 * GET /
 *
 * Display a page of experiments (up to ten at a time).
 */
router.get('/', (req, res, next) => {
    datastore.listExpByCreationTime(10, req.query.pageToken,
        (err, entities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            res.render('exps/list.pug', {
                exps: entities,
                nextPageToken: cursor
            });
        });
});

/**
 * GET /create
 *
 * Display a form for creating an experiment.
 */
// [START create_get]
router.get('/create', (req, res) => {
    res.render('exps/create.pug', {
        credential: {}
    });
});
// [END create_get]


/**
 * POST /create
 *
 * Create an experiment.
 */
// [START create_post]
router.post('/create', (req, res, next) => {
    const credential = req.body;

    if (credential.passcode == "pg") {
        // create a new experiment with current date.
        datastore.createNewExperiment(new Date(), (err, id) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect(`${req.baseUrl}/${id}`);
        });
    } else {
        next(new Error(`wrong pass code: ${credential.passcode}`));
    }
});
// [END create_post]

/**
 * GET /:exp
 *
 * Display an experiment.
 */
router.get('/:exp', (req, res, next) => {
    datastore.readExperiment(req.params.exp, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        res.render('exps/view.pug', {
            exp: entity
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
