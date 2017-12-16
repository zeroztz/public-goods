'use strict';

const utils = require(`./utils`);
const should = require(`should`);
const api = require(`../api`);

describe(`[kick] /parts/:part`, () => {
    let expId;
    let partIds;
    let firstPartId;
    let lastPartId;

    before(() => {
        return utils.createExp({
            numRounds: '4',
            kickEnabled: 'true',
        }).then((result) => {
            expId = result.expId;
            partIds = result.partIds;
            firstPartId = partIds[0];
            lastPartId = partIds[1];
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
        // TODO: add kick specific instruction.
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
                .expect(function(res){
                    res.text.should.not.match(/exclusion/);
                })
                .expect(/<form action="game" method="POST"/);
        });
        it(`should finish first round like normal mode.`, () => {
            return Promise.all(partIds.map((id) => {
                return api.submitContribution(id, '10').catch((err) => {
                    err.should.equal('not all finished');
                });
            }));
        });
        it(`POST /next-round should redirect to ./ and show exclusive vote`, (done) => {
            utils.getRequest()
                .post(`/parts/${firstPartId}/next-round`)
                .expect(302)
                .expect('Location', `/parts/${firstPartId}/`)
                .end((err) => {
                    if (err) throw err;
                    return utils.getRequest()
                        .get(`/parts/${firstPartId}`)
                        .expect(200)
                        .expect(/Who would you like to cast your “exclusion vote” for?/)
                        .expect(function(res){
                            res.text.should.not.match(/value="Participant #1"/);
                        })
                        .end(done)
                });
        });
        it(`POST /exclusion-vote should redirect to ./ and wait.`, (done) => {
            utils.getRequest()
                .post(`/parts/${firstPartId}/exclusion-vote`)
                .send('vote=None')
                .expect(302)
                .expect('Location', `/parts/${firstPartId}/`)
                .end((err) => {
                    if (err) throw err;
                    utils.getRequest()
                        .get(`/parts/${firstPartId}`)
                        .expect(200)
                        .expect(/Please wait for all paritipants to finish./)
                        .end(done)
                });
        });
        it(`POST /exclusion-vote should let others to finish vote`, () => {
            return Promise.all(partIds.map((id) => {
                if (id != firstPartId) {
                    return api.readyForNextRound(id).then((success) => {
                        success.should.be.true();
                        if (id != lastPartId)
                            return api.submitExclusionVote(id, 'None');
                    });
                }
            }));
        });
        it(`POST /exclusion-vote should show game play when last participant submitted`, (done) => {
            utils.getRequest()
                .post(`/parts/${lastPartId}/exclusion-vote`)
                .send('vote=None')
                .expect(302)
                .expect('Location', `/parts/${lastPartId}/`)
                .end((err) => {
                    if (err) throw err;
                    utils.getRequest()
                        .get(`/parts/${lastPartId}`)
                        .expect(200)
                        .expect(/How many of your .* points would you like to transfer to the group fund?/)
                        .end(done);
                });
        });
        it(`should be able to finish 2nd round without anyone exlucded`, (done) => {
            Promise.all(partIds.map((id) => {
                if (id != lastPartId) {
                    return api.submitContribution(id, '10').catch((err) => {
                        err.should.equal('not all finished');
                    });
                }
            })).then(() => {
                utils.getRequest()
                    .post(`/parts/${lastPartId}/game`)
                    .send('contribution=10')
                    .expect(302)
                    .expect('Location', `/parts/${lastPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest()
                            .get(`/parts/${lastPartId}`)
                            .expect(200)
                            .expect(/You end up with 40.00/)
                            .expect(/<form action="next-round" method="POST"/)
                            .end(done);
                    });
            });
        });
        it(`should be able to kick the last participant`, (done) => {
            Promise.all(partIds.map((id) => {
                return api.readyForNextRound(id).then((success) => {
                    success.should.be.true();
                });
            })).then(() => {
                return api.readPart(lastPartId).then((part) => {
                    return Promise.all(partIds.map((id) => {
                        if (id == firstPartId || id == lastPartId) {
                            return api.submitExclusionVote(id, 'None');
                        } else {
                            return api.submitExclusionVote(id, part.name);
                        }
                    }));
                });
            }).then(() => {
                utils.getRequest()
                    .get(`/parts/${lastPartId}`)
                    .expect(200)
                    .expect(/You received at least/)
                    .expect(/and will not play in this round/)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest()
                            .get(`/parts/${firstPartId}`)
                            .expect(200)
                            .expect(/Participant #2 received at least/)
                            .end(done);
                    });
            });
        });
        it(`should be able to finish 3rd round without the last participant`, (done) => {
            Promise.all(partIds.map((id) => {
                if (id != lastPartId) {
                    api.submitContribution(id, '10').catch((err) => {
                        err.should.equal('not all finished');
                    });
                }
            })).then(() => {
                utils.getRequest()
                    .post(`/parts/${lastPartId}/game`)
                    .expect(302)
                    .expect('Location', `/parts/${lastPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest()
                            .get(`/parts/${lastPartId}`)
                            .expect(200)
                            .expect(/Participant #1 10.00/)
                            .expect(/You end up with 40.00/)
                            .end(done);
                    });
            });;
        });
        it(`the last participant should not be able to vote exclusion of 4th round`, (done) => {
            Promise.all(partIds.map((id) => {
                return api.readyForNextRound(id).then((success) => {
                    success.should.be.true();
                });
            })).then(() => {
                utils.getRequest()
                    .get(`/parts/${lastPartId}`)
                    .expect(200)
                    .expect(/Please wait for all paritipants to finish./)
                    .end(done);
            });
        });
        it(`the last participant should be able to join 4th round`, (done) => {
            Promise.all(partIds.map((id) => {
                if (id !=lastPartId) {
                    return api.submitExclusionVote(id, 'None');
                }
            })).then(() => {
                utils.getRequest()
                    .get(`/parts/${lastPartId}`)
                    .expect(200)
                    .expect(/How many of your .* points would you like to transfer to the group fund?/)
                    .expect(/<form action="game" method="POST"/)
                    .end(done);
            });
        });
    });
});

