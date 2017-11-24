'use strict';

// Dummy version of storage. Used only in Unit test.
function checkID(id) {
    if (Number.isNaN(id)) {
        return Promise.reject(id + " is NaN");
    } else if (id >=0 && id < this.entries.length) {
        return Promise.resolve(id);
    } else {
        return Promise.reject(id + " is not in [0, " + this.entries.length + ")");
    }
}


class PromiseOrientedStorage {
    constructor(kind) {
        this.kind = kind;
        this.entries = [];
    }

    runQuery(query) {
        // TODO implement this
        /* 
        let start = 0;
        if (query.startToken != '') {
            start = parseInt(query.startToken, 10)
        }
        let mark = {};
        return new Promise(function(resolve, reject) {
            for (int i = 0; i < start + query.limit; i++) {
                for (int j = 0; j < 

        const q = ds.createQuery([this.kind])
            .limit(query.limit)
            .order(query.order.key, query.order.options)
            .start(query.startToken);

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
        */
    }

    create(entry) {
        entry.id = this.entries.length;
        this.entries.push(JSON.stringify(entry));
        return Promise.resolve(entry);
    }

    createMultiple(entries) {
        return Promise.all(entries.map(this.create));
    }

    read(id) {
        return checkID(id).then((id) => {
            return JSON.parse(this.entries[id]);
        });
    }

    readMultiple(ids) {
        return Promise.all(ids.map(this.read));
    }

    update(entry) {
        return checkID(entry.id).then((id) => {
            this.entries[id] = JSON.stringify(entry);
        });
    }

    updateMultiple(entries) {
        return Promise.all(entries.map(this.update));
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
