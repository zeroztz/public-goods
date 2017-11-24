'use strict';

// Dummy version of storage. Used only in Unit test.
function checkID(id, length) {
    if (Number.isNaN(id)) {
        return Promise.reject({
            code: 400,
            message: "id is NaN"
        });
    } else if (id >= 0 && id < length) {
        return Promise.resolve(id);
    } else {
        return Promise.reject({
            code: 404,
            message: id + " is not in [0, " + length + ")"
        });
    }
}


class PromiseOrientedStorage {
    constructor() {
        this.entries = [];
        this.queries = [];
    }

    runQuery(query) {
        return new Promise((resolve, reject) => {
            if (query.order === undefined) {
                return reject("no order specified in query");
            } else if (query.order.key === undefined) {
                return reject("no key specified in query.order");
            }
            if (query.startToken === undefined || query.startToken == '') {
                query.mark = Array(this.entries.length).fill(false);
                query.id = this.queries.length;
                query.count = 0;
                this.queries.push(JSON.stringify(query));
                resolve(query.id);
            } else {
                resolve(parseInt(query.startToken, 10));
            }
        }).then((id) => {
            return checkID(id, this.queries.length).then((id) => {
                return JSON.parse(this.queries[id]);
            });
        }).then((query) => {
            for (; query.mark.length < this.entries.length;) {
                query.mark.push(false);
            }
            var preferrable = (a, b) => {
                if (query.order.options === undefined ||
                    !query.order.options.descending) {
                    return a[query.order.key] < b[query.order.key];
                } else {
                    return a[query.order.key] > b[query.order.key];
                }
            };
            var entries = [];
            for (var i = 0; i < query.limit; i++) if (query.count < this.entries.length) {
                var index;
                var thisRound;
                for (var j = 0; j < this.entries.length; j++) if (!query.mark[j]) {
                    var current = JSON.parse(this.entries[j]);
                    if (thisRound === undefined ||
                        preferrable(current, thisRound)) {
                        index = j;
                        thisRound = current;
                    }
                }
                query.mark[j] = true;
                entries.push(thisRound);
            }
            this.queries[query.id] = JSON.stringify(this.query);
            return {
                entries,
                nextPageToken: query.count < this.entries.length ?
                    query.id.toString() : false
            }
        });
    }

    create(entry) {
        entry.id = this.entries.length;
        this.entries.push(JSON.stringify(entry));
        return Promise.resolve(entry);
    }

    createMultiple(entries) {
        return Promise.all(entries.map(this.create, this));
    }

    read(id) {
        return checkID(id, this.entries.length).then((id) => {
            return JSON.parse(this.entries[id]);
        });
    }

    readMultiple(ids) {
        return Promise.all(ids.map(this.read, this));
    }

    update(entry) {
        return checkID(entry.id, this.entries.length).then((id) => {
            this.entries[id] = JSON.stringify(entry);
        });
    }

    updateMultiple(entries) {
        return Promise.all(entries.map(this.update, this));
    }
}

const exp = new PromiseOrientedStorage();

const part = new PromiseOrientedStorage();

// [START exports]
module.exports = {
    exp,
    part
};
// [END exports]
