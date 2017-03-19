'use strict';

const Datastore = require('@google-cloud/datastore');

// [START config]
const ds = Datastore({
    projectId: 'public-goods'
});
const kindExperiment = 'experiment';
const kindParticipant = 'participant';
// [END config]

// Lists all experiments in the Datastore sorted desending by creation time.
// The ``limit`` argument determines the maximum amount of results to
// return per page. The ``token`` argument allows requesting additional
// pages. The callback is invoked with ``(err, exps, nextPageToken)``.
// [START listExpByCreationTime]
function listExpByCreationTime(limit, token) {
    return new Promise(function(resolve, reject) {
        const q = ds.createQuery([kindExperiment])
            .limit(limit)
            .order('creationDate', {
                descending: true
            })
            .start(token);

        ds.runQuery(q, (err, entities, nextQuery) => {
            if (err) {
                reject(err);
                return;
            }
            const hasMore =
                nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ?
                nextQuery.endCursor : false;

            resolve(entities, hasMore);
        });
    });
}
// [END listExpByCreationTime]

// Creates a new experiment and corresponding participants with given Date. 
// Return new experiment id if no error occurs.
// [START createNewExperiment]
function createNewExperiment(date) {
    return new Promise(function(resolve, reject) {
        var experimentEntity = {
            key: ds.key(kindExperiment),
            data: {
                creationDate: date
            }
        };

        ds.upsert(
            experimentEntity,
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                var participantEntities = [1, 2, 3].map(function(id) {
                    return {
                        key: ds.key(kindParticipant),
                        data: {
                            experimentId: experimentEntity.key.id,
                            stage: 'instruction'
                        }
                    };
                });

                ds.upsert(
                    participantEntities,
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        experimentEntity.data.participants =
                            participantEntities.map(
                                (entity) => {
                                    return entity.key.id;
                                });

                        ds.update(
                            experimentEntity,
                            (err) => {
                                if (err)
                                    reject(err);
                                else
                                    resolve(experimentEntity.key.id);
                            }
                        );
                    }
                );
            }
        );
    });
}
// [END update]

function readExperiment(id, cb) {
    const key = ds.key([kindExperiment, parseInt(id, 10)]);
    return new Promise(function(resolve, reject) {
        ds.get(key, (err, entity) => {
            if (err)
                reject(err);
            else
                resolve(entity);
        });
    });
}

// [START exports]
module.exports = {
    listExpByCreationTime,
    createNewExperiment,
    readExperiment
};
// [END exports]
