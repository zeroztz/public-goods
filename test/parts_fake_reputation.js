'use strict';

const utils = require(`./utils`);
const should = require(`should`);
const api = require(`../api`);

describe(`[fake reputation] /parts/:part`, () => {
    let expId;
    let partIds;
    let firstPartId;
    let lastPartId;

    before(() => {
        return utils.createExp({
            fakeReputationEnabled: 'true'
        }).then((result) => {
            expId = result.expId;
            partIds = result.partIds;
            firstPartId = partIds[0];
            lastPartId = partIds[1];
        });
    });
    describe(`[instruction]`, () => {
        // TODO: add fake reputaion specific instruction.
        it(`should show instructions`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/.*<a href="comprehension">.*/)
        });
    });

    describe(`/comprehension`, () => {
        // TODO: add fake reputaion specific test.
        it(`GET should show comprehension test`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}/comprehension`)
                .expect(200)
                .expect(/<h3>Comprehension Test<\/h3>/)
                .expect(/method="POST"/)
        });

        it(`POST should pass when answers are correct`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/comprehension`)
                .type('form')
                .send({
                    q1: 'c',
                    q2: 'b'
                })
                .expect(200)
                .expect(/You got all the comprehension questions correct/)
                .expect(/<a href=".\//)
        });


        it(`POST should let other particiants to finish comprehension test`, () => {
            return Promise.all(partIds.map((id) => {
                if (id != firstPartId) {
                    return utils.bypassComprehensionTest(id);
                }
            }));
        });
    });

    describe(`[game]`, () => {
        it(`GET should show game play`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/How many of your .* points would you like to transfer to the group fund?/)
                .expect(/You can claim to contribute more than you really do/)
                .expect(/<form action="game" method="POST"/);
        });
        it(`fake contribution should not be lower than actual contribution`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .type('form')
                .send({
                    contribution: '10',
                    claimedContribution: '0'
                })
                .expect(200)
                .expect(/Your claimed contribution can not be lower than your actual contribution. Please select again./)
                .expect(/Click.*here.*to retry./)
        });
        it(`the first participant should be able to fake reputation`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .type('form')
                .send({
                    contribution: '0',
                    claimedContribution: '10'
                })
                .expect(302)
                .expect('Location', `/parts/${firstPartId}/`);
        });
        it(`the other participants should be able to play as normal`, () => {
            return Promise.all(partIds.map((id) => {
                if (id != firstPartId) {
                    return api.submitContribution(id, '10', '10').catch((err) => {
                        err.should.equal('not all finished');
                    });
                }
            }));
        });
        it(`the first participant should see claimed result and actual result of theirselves`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/Claimed contribution.*Participant #1 10.*actually contribute 0/)
                .expect(/Claimed group funds = 40/)
                .expect(/Actual group funds = 30/)
                .expect(/Group earnings = 60/)
                .expect(/claimed to earn.*Participant #1 15.*actually earn 23/);
        });
        it(`the last paricipant should not see the actuall result of the first participant`, () => {
            return utils.getRequest()
                .get(`/parts/${lastPartId}`)
                .expect(200)
                .expect(/Claimed contribution.*Participant #1 10.*actually contribute 10/)
                .expect(/Claimed group funds = 40/)
                .expect(/Actual group funds = 30/)
                .expect(/Group earnings = 60/)
                .expect(/claimed to earn.*Participant #1 15.*actually earn 15/);
        });
    });
});
