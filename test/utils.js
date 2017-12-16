'use strict';

const app = require(`../app`);
const api = require(`../api`);
const supertest = require(`supertest`);

module.exports = {
    getRequest : function() {
        return supertest(app);
    },

    // Calls api.validateComprehensionTest and expects no missed questions.
    bypassComprehensionTest : function(id) {
        return api.validateComprehensionTest(
            id, {
                q1: 'c',
                q2: 'b'
            }
        ).then((result) => {
            return result.should.have.property('missedQuestions')
                .which.have.property('length')
                .which.equal(0);
        });
    }
};
