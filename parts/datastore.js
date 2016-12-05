'use strict';

const Datastore = require('@google-cloud/datastore');

// [START config]
const ds = Datastore({
    projectId: 'public-goods'
});
const kindExperiment = 'experiment';
const kindParticipant = 'participant';
// [END config]

/*
 */

function loadParticipant(cb) {
    cb();
}

// [START exports]
module.exports = {
    loadParticipant
};
// [END exports]
