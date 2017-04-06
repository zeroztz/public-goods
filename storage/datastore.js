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

    getKey(id) {
        return ds.key([this.kind, parseInt(id, 10)]);
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

                // TODO hasMore is incorrect;
                resolve(entities, hasMore);
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

    read(id) {
        const key = this.getKey(id);
        return new Promise(function(resolve, reject) {
            ds.get(key, (err, entity) => {
                if (err)
                    reject(err);
                else if (entity) {
                    resolve(entity.data);
                } else
                    reject({
                        code: 404,
                        message: 'Not found'
                    });
            });
        });
    }

    readMultiple(ids) {
        const keys = ids.map((id) => this.getKey(id));
        return new Promise(function(resolve, reject) {
            ds.get(keys, (err, entities) => {
                if (err)
                    reject(err);
                else
                    resolve(entities.map((entity) => {
                        return {
                            id: entity.key.id,
                            data: entity.data
                        }
                    }));
            });
        });
    }

    update(id, data) {
        var entity = {
            key: this.getKey(id),
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

    updateMultiple(entries) {
        var entities = entries.map((entry) => {
            return {
                key: this.getKey(entry.id),
                method: 'update',
                data: entry.data
            }
        });
        return new Promise(function(resolve, reject) {
            ds.update(
                entities,
                (err) => {
                    if (err) reject(err);
                    else resolve();
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
