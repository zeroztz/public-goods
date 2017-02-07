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
        key: ds.key([kindParticipant, parseInt(id, 10)]),
        data: part
    };
    ds.upsert(
        entity,
        (err) => {
            cb(err);
        }
    );
}

/*
 * Loads all participants in a experiment.
 */
function loadAllParticipants(id, cb) {
    const experimentKey = ds.key([kindExperiment, parseInt(id, 10)]);
    ds.get(experimentKey, (err, experimentEntity) => {
        if (err) {
            cb(err, null);
            return;
        }
        var participantKeys = experimentEntity.data.participants.map(
            function(id) {
                return ds.key([kindParticipant, parseInt(id, 10)]);
            });
        ds.get(participantKeys, (err, participantEntities) => {
            if (err) {
                cb(err, null);
                return;
            }
            cb(null,
                participantEntities.map(function(entity) {
                    return {
                        id: entity.key.id,
                        data: entity.data
                    };
                }));
        });
    });
}

/*
 * Updates all participants in a experiment.
 */
function updateAllParticipants(partcipants, cb) {
    var participantEntities =
        participants.map((participant) => {
            return {
                key: ds.key([kindExperiment, parseInt(pariticipant.id)]),
                method: 'update',
                data: participant.data
            }
        });
    ds.save(participantEntities, (err) => {
        cb(err);
    });
}

// [START exports]
module.exports = {
    loadParticipant,
    saveParticipant,
    loadAllParticipants,
    updateAllParticipants
};
// [END exports]
