'use strict';

const utils = require(`./utils`);
const should = require(`should`);
const api = require(`../api`);

describe(`[normal] /parts/:part`, () => {
    let expId;
    let partIds;
    let firstPartId;
    let lastPartId;

    before(() => {
        return api.createExp({
            passcode: 'pg',
            partSize: '4',
            numRounds: '2'
        }).then((id) => {
            id.should.not.be.NaN();
            id.should.not.be.Infinity();
            expId = id;
            return api.readExp(expId).then((result) => {
                result.should.not.be.null();
                result.should.have.property('participants')
                    .which.is.a.Array().and.have.length(4);
                partIds = result.participants.map((part) => {
                    part.should.be.a.Number();
                    return part;
                });
                firstPartId = partIds[0];
                lastPartId = partIds[1];
            });
        });
    });
    describe(`[instruction]`, () => {
        it(`should show instructions`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/<h3>Instructions<\/h3>/)
                .expect(/multiplier/)
                .expect(/.*<a href="comprehension">.*/)
        });
    });

    describe(`/comprehension`, () => {
        it(`POST ./game should not submit contribution`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .expect(403)
                .expect(/not in game stage/)
        });

        it(`GET should show comprehension test`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}/comprehension`)
                .expect(200)
                .expect(/<h3>Comprehension Test<\/h3>/)
                .expect(/method="POST"/)
        });

        it(`POST should not pass when there is any incorrect answer`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/comprehension`)
                .type('form')
                .send({
                    q1: 'c',
                    q2: 'c'
                })
                .expect(200)
                .expect(/You seem to have missed at least one of the comprehension check questions./)
                .expect(/Question 2/)
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

        it(`POST should not allow you submit it again once you passed`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/comprehension`)
                .type('form')
                .send({
                    q1: 'c',
                    q2: 'c'
                })
                .expect(403)
                .expect('You have already finished comprehension test')
        });

        it(`GET ./ should wait for other participants`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/Please wait for all paritipants to finish./)
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
                .expect(/<form action="game" method="POST"/);
        });
        it(`POST /game without contribution will go to error page and retry`, (done) => {
            utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .send('contribution=')
                .expect(200)
                .expect(/You did not select contribution./)
                .expect(/Click.*here.*to retry./)
                .end((err, res) => {
                    if (err) throw err;
                    utils.getRequest()
                        .get(`/parts/${firstPartId}`)
                        .expect(200)
                        .expect(/How many of your .* points would you like to transfer to the group fund?/)
                        .end(done)
                });
        });
        it(`POST /game should submit contribution and wait others`, (done) => {
            utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .send('contribution=10')
                .expect(302)
                .expect('Location', `/parts/${firstPartId}/`)
                .end((err, res) => {
                    if (err) throw err;
                    utils.getRequest()
                        .get(`/parts/${firstPartId}`)
                        .expect(200)
                        .expect(/Please wait for all paritipants to finish./)
                        .end(done)
                });
        });
        it(`POST /game should not allow submit contribution again`, () => {
            return utils.getRequest()
                .post(`/parts/${firstPartId}/game`)
                .send('contribution=8')
                .expect(403)
                .expect(/not in game stage/);
        });
        it(`POST /game should let other participants to submit contribution`, () => {
            return Promise.all(partIds.map((id) => {
                if (id != firstPartId && id != lastPartId) {
                    return api.submitContribution(id, '8').catch((err) => {
                        err.should.equal('not all finished');
                    });
                }
            }));
        });
        it(`POST /game should show result when last participant submitted contribution`, (done) => {
            utils.getRequest()
                .post(`/parts/${lastPartId}/game`)
                .send('contribution=6')
                .expect(302)
                .expect('Location', `/parts/${lastPartId}/`)
                .end((err, res) => {
                    if (err) throw err;
                    utils.getRequest()
                        .get(`/parts/${lastPartId}`)
                        .expect(200)
                        .expect(/Participant #2 20/)
                        .expect(/<form action="next-round" method="POST"/)
                        .end(done);
                });
        });
        it(`GET should show result after all participants submitted contribution`, () => {
            return utils.getRequest()
                .get(`/parts/${firstPartId}`)
                .expect(200)
                .expect(/Round 1/)
                .expect(/Participant #1 16/);
        });
        it(`POST /next-round should redirect to ./ and show next round`, (done) => {
            utils.getRequest()
                .post(`/parts/${firstPartId}/next-round`)
                .expect(302)
                .expect('Location', `/parts/${firstPartId}/`)
                .end((err) => {
                    if (err) throw err;
                    return utils.getRequest()
                        .get(`/parts/${firstPartId}`)
                        .expect(200)
                        .expect(/How many of your .* points would you like to transfer to the group fund?/)
                        .end(done)
                });
        });

        it(`should be able to finish 2nd round`, (done) => {
            Promise.all(partIds.map((id) => {
                if (id != firstPartId) {
                    return api.readyForNextRound(id).then((success) => {
                        success.should.be.true();
                    });
                }
            })).then(() => {
                return Promise.all(partIds.map((id) => {
                    if (id != lastPartId) {
                        return api.submitContribution(id, '8').catch((err) => {
                            err.should.equal('not all finished');
                        });
                    }
                }));
            }).then(() => {
                utils.getRequest()
                    .post(`/parts/${lastPartId}/game`)
                    .send('contribution=8')
                    .expect(302)
                    .expect('Location', `/parts/${lastPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest()
                            .get(`/parts/${lastPartId}`)
                            .expect(200)
                            .expect(/You end up with 38.00/)
                            .expect(/<form action="next-round" method="POST"/)
                            .end(done);
                    });
            });
        });
        it(`should finish and show final points`, (done) => {
            Promise.all(partIds.map((id) => {
                return api.readyForNextRound(id).then((success) => {
                    success.should.be.true();
                });
            })).then(() => {
                utils.getRequest()
                    .get(`/parts/${lastPartId}`)
                    .expect(200)
                    .expect(/Game over.*Your final points are 38.00/)
                    .end(done);
            });
        });
    });
});
