'use strict';

const Datastore = require('@google-cloud/datastore');

// [START config]
const ds = Datastore({
    projectId: 'public-goods'
});
const kindExperiment = 'experiment';
const kindParticipant = 'participant';
// [END config]

// Translates from Datastore's entity format to
// the format expected by the application.
//
// Datastore format:
//   {
//     key: [kind, id],
//     data: {
//       property: value
//     }
//   }
//
// Application format:
//   {
//     id: id,
//     property: value
//   }
function fromDatastore(obj) {
    obj.data.id = obj.key.id;
    return obj.data;
}

// Translates from the application's format to the datastore's
// entity format. Does not translate the key.
//
// Application format:
//   {
//     id: id,
//     property: value,
//     unindexedProperty: value
//   }
//
// Datastore extended format:
//   [
//     {
//       name: property,
//       value: value
//       excludeFromIndexes: false
//     }
//   ]
function toDatastore(obj) {
    let results = [];
    Object.keys(obj).forEach((k) => {
        if (k == 'id' || obj[k] === undefined) {
            return;
        }
        results.push({
            name: k,
            value: obj[k],
            excludeFromIndexes: false
        });
    });
    return results;
}

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

                var entries = entities.map(fromDatastore);

                resolve({
                    entries,
                    nextPageToken: hasMore
                });
            });
        });
    }

    create(data) {
        var entity = {
            key: ds.key(this.kind),
            data: toDatastore(data)
        };

        return new Promise(function(resolve, reject) {
            ds.insert(
                entity,
                (err) => {
                    if (err)
                        reject(err);
                    else {
                        resolve(fromDatastore(entity));
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
                data: toDatastore(data)
            };
        });
        return new Promise(function(resolve, reject) {
            ds.insert(
                entities,
                (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve(entities.map(fromDatastore));
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
                    resolve(fromDatastore(entity));
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
                    resolve(entities.map(fromDatastore));
            });
        });
    }

    update(entry) {
        var entity = {
            key: this.getKey(entry.id),
            data: toDatastore(entry)
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
                data: toDatastore(entry)
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
