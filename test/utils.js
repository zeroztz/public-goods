'use strict';

const app = require(`../app`);
const api = require(`../api`);
const supertest = require(`supertest`);

module.exports = {
    createExp : function(config) {
        config = Object.assign({
            passcode: 'pg',
            partSize: '4',
            numRounds: '2',
            kickEnabled: 'false',
            fakeReputationEnabled: 'false'
        }, config);
        return api.createExp(config).then((id) => {
            id.should.not.be.NaN();
            id.should.not.be.Infinity();
            return api.readExp(id).then((result) => {
                result.should.not.be.null();
                result.should.have.property('participants')
                    .which.is.a.Array().and.have.length(4);
                var partIds = result.participants.map((part) => {
                    part.should.be.a.Number();
                    return part;
                });
                return {
                    expId: id,
                    partIds
                };
            });
        });
    },

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
