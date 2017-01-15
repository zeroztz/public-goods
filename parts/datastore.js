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
 * Loads participant's data.
 */
function loadParticipant(id, cb) {
    const key = ds.key([kindParticipant, parseInt(id, 10)]);
    ds.get(key, (err, entity) => {
        if (err) {
            cb(err);
            return;
        }
        if (!entity) {
            cb({
                code: 404,
                message: 'Not found'
            });
            return;
        }
        var participant = entity.data;
        if (participant.stage === undefined) {
            participant.stage = 'instruction'
        }
        cb(null, participant);
    });
}

/*
 * Saves participant's data.
 */
function saveParticipant(id, part, cb) {
    var entity = {
        key: ds.key([kindParticipant, parseInt(id, 10)])
    };
    entity.data = part;
    ds.upsert(
        entity,
        (err) => {
            if (err) {
                cb(err, null);
                return;
            }
        }
    );
}

// [START exports]
module.exports = {
    loadParticipant,
    saveParticipant
};
// [END exports]
