'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const api = require(`./api`);

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
    api.getExps(req.query.pagetoken).then(function(result) {
        res.render(`exps/list.pug`, result);
    }).catch(function(err) {
        next(err);
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
    api.createExp(req.body.passcode).then(function(id) {
        res.redirect(`${req.baseUrl}/${id}`);
    }).catch(function(err) {
        next(err);
    });
});
// [END create_post]

/**
 * GET /:exp
 *
 * Display an experiment.
 */
router.get('/:exp', (req, res, next) => {
    api.readExp(req.params.exp).then(function(result) {
        if (!result) {
            next({
                code: 404,
                message: 'Not found'
            });
        } else {
            res.render('exps/view.pug', {
                id: req.params.exp,
                data: result
            });
        }
    }).catch(function(err) {
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
