'use strict';

const path = require('path');

const express = require('express');
const app = express();

app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);

// Experiments
app.use('/exps', require('./exps/router'));

// Redirect root to /exps
app.get('/', (req, res) => {
    res.redirect('/exps');
});

// Basic 404 handler
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Basic error handler
app.use((err, req, res, next) => {
    /* jshint unused:false */
    console.error(err);
    // If our routes specified a specific response, then send that. Otherwise,
    // send a generic message so as not to leak anything.
    res.status(500).send(err.response || 'Something broke!');
});

if (module === require.main) {
    // Start the server
    const server = app.listen(8080, () => {
        const port = server.address().port;
        console.log(`App listening on port ${port}`);
    });
}

module.exports = app;
