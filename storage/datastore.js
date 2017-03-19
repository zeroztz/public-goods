'use strict';

const Datastore = require('@google-cloud/datastore');

// [START config]
const ds = Datastore({
    projectId: 'public-goods'
});
const kindExperiment = 'experiment';
const kindParticipant = 'participant';
// [END config]

class PromiseOrientedStorage {
    constructor(kind) {
        this.kind = kind;
    }

    runQuery(query) {
        const q = ds.createQuery([this.kind])
            .limit(query.limit)
            .order(query.order.key, query.order.options)
            .start(query.startToken);

        return new Promise(function(resolve, reject) {
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

    read(id) {
        const key = ds.key([this.kind, parseInt(id, 10)]);
        return new Promise(function(resolve, reject) {
            ds.get(key, (err, entity) => {
                if (err)
                    reject(err);
                else if (entity) {
                    resolve(entity.data);
                } else
                    resolve(null);
            });
        });
    }

    create(data) {
        var entity = {
            key: ds.key(this.kind),
            data: data
        };

        return new Promise(function(resolve, reject) {
            ds.insert(
                entity,
                (err) => {
                    if (err)
                        reject(err);
                    else {
                        resolve(entity.key.id);
                    }
                }
            );
        });
    }

    createMultiple(dataList) {
        const kind = this.kind;
        var entities = dataList.map(function(data) {
            return {
                key: ds.key(kind),
                data: data
            };
        });
        return new Promise(function(resolve, reject) {
            ds.insert(
                entities,
                (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve(entities.map((entity) =>
                            entity.key.id
                        ));
                }
            );
        });
    }

    update(id, data) {
        var entity = {
            key: ds.key([this.kind, parseInt(id, 10)]),
            data: data
        }

        return new Promise(function(resolve, reject) {
            ds.update(
                entity,
                (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                }
            );
        });
    }
}

const exp = new PromiseOrientedStorage(kindExperiment);
const part = new PromiseOrientedStorage(kindParticipant);

// [START exports]
module.exports = {
    exp,
    part
};
// [END exports]
