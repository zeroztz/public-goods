'use strict';

// unit tests that every pages render correctly.

const config = require(`./config`);
const utils = require(`nodejs-repo-tools`);
const should = require(`should`);
const api = require(`../api`);

var apiTest = {
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
}

describe(`[views]`, () => {
    describe(`/exps`, () => {
        let expId;
        let partIds;
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
                });
            });
        });

        describe(`/`, () => {
            it(`should show a list of exps`, () => {
                const expected = `<div class="media-body">`;
                return utils.getRequest(config)
                    .get(`/exps`)
                    .expect(200)
                    .expect((response) => {
                        response.text.includes(expected).should.be.true();
                    });
            });


            it(`should handle error`, () => {
                return utils.getRequest(config)
                    .get(`/exps`)
                    .query({
                        pageToken: `badrequest`
                    })
                    .expect(400);
            });
        });

        describe('/create', () => {
            it('should reject without passcode.', () => {
                return utils.getRequest(config)
                    .post('/exps/create')
                    .expect(401);
            });

            it('should reject with incorrect passcode.', () => {
                return utils.getRequest(config)
                    .post('/exps/create')
                    .send('passcode=randomString')
                    .expect(401);
            });

            it('should create experiment with correct passcode.', () => {
                return utils.getRequest(config)
                    .post(`/exps/create`)
                    .type('form')
                    .send({
                        passcode: 'pg',
                        partSize: '3',
                        numRounds: '8'
                    })
                    .expect(302)
                    .expect((response) => {
                        const location = response.headers.location;
                        const idPart = location.replace(`/exps/`, ``);
                        var id = parseInt(idPart, 10);
                        id.should.not.be.NaN();
                        id.should.not.be.Infinity();
                    });
            });
        });


        describe(`/:exp`, () => {
            it(`should show corresponding exp.`, () => {
                const expected = `Experiment ${expId}`;
                return utils.getRequest(config)
                    .get(`/exps/${expId}`)
                    .expect(200)
                    .expect((response) => {
                        // TODO(ztz): use should for includes
                        response.text.includes(expected).should.be.true();
                        partIds.map((id) => {
                            response.text.includes(
                                `Participant&nbsp;<small>${id}</small>`
                            ).should.be.true();
                        });
                    });
            });
        });

        describe(`/:exp`, () => {
            it(`should show 404 with id -1.`, () => {
                return utils.getRequest(config)
                    .get(`/exps/-1`)
                    .expect(404)
            });
        });
    });

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
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/<h3>Instructions<\/h3>/)
                    .expect(/multiplier/)
                    .expect(/.*<a href="comprehension">.*/)
            });
        });

        describe(`/comprehension`, () => {
            it(`POST ./game should not submit contribution`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .expect(403)
                    .expect(/not in game stage/)
            });

            it(`GET should show comprehension test`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/comprehension`)
                    .expect(200)
                    .expect(/<h3>Comprehension Test<\/h3>/)
                    .expect(/method="POST"/)
            });

            it(`POST should not pass when there is any incorrect answer`, () => {
                return utils.getRequest(config)
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
                return utils.getRequest(config)
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
                return utils.getRequest(config)
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
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/Please wait for all paritipants to finish./)
            });

            it(`POST should let other particiants to finish comprehension test`, () => {
                return Promise.all(partIds.map((id) => {
                    if (id != firstPartId) {
                        return apiTest.bypassComprehensionTest(id);
                    }
                }));
            });
        });

        describe(`[game]`, () => {
            it(`GET should show game play`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/How many of your .* points would you like to transfer to the group fund?/)
                    .expect(/<form action="game" method="POST"/);
            });
            it(`POST /game without contribution will go to error page and retry`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=')
                    .expect(200)
                    .expect(/You didn't select contribution./)
                    .expect(/Click.*here.*to retry./)
                    .end((err, res) => {
                        if (err) throw err;
                        utils.getRequest(config)
                            .get(`/parts/${firstPartId}`)
                            .expect(200)
                            .expect(/How many of your .* points would you like to transfer to the group fund?/)
                            .end(done)
                    });
            });
            it(`POST /game should submit contribution and wait others`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=10')
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/`)
                    .end((err, res) => {
                        if (err) throw err;
                        utils.getRequest(config)
                            .get(`/parts/${firstPartId}`)
                            .expect(200)
                            .expect(/Please wait for all paritipants to finish./)
                            .end(done)
                    });
            });
            it(`POST /game should not allow submit contribution again`, () => {
                return utils.getRequest(config)
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
                utils.getRequest(config)
                    .post(`/parts/${lastPartId}/game`)
                    .send('contribution=6')
                    .expect(302)
                    .expect('Location', `/parts/${lastPartId}/`)
                    .end((err, res) => {
                        if (err) throw err;
                        utils.getRequest(config)
                            .get(`/parts/${lastPartId}`)
                            .expect(200)
                            .expect(/Participant #2 20/)
                            .expect(/<form action="next-round" method="POST"/)
                            .end(done);
                    });
            });
            it(`GET should show result after all participants submitted contribution`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/Participant #1 16/);
            });
            it(`POST /next-round should redirect to ./ and show next round`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${firstPartId}/next-round`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        return utils.getRequest(config)
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
                    utils.getRequest(config)
                        .post(`/parts/${lastPartId}/game`)
                        .send('contribution=8')
                        .expect(302)
                        .expect('Location', `/parts/${lastPartId}/`)
                        .end((err) => {
                            if (err) throw err;
                            utils.getRequest(config)
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
                    utils.getRequest(config)
                        .get(`/parts/${lastPartId}`)
                        .expect(200)
                        .expect(/Game over.*Your final points are 38.00/)
                        .end(done);
                });
            });
        });
    });

    describe(`[kick] /parts/:part`, () => {
        let expId;
        let partIds;
        let firstPartId;
        let lastPartId;

        before(() => {
            return api.createExp({
                passcode: 'pg',
                partSize: '4',
                numRounds: '8',
                kickEnabled: 'true',
                fakeReputationEnabled: 'false'
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
                return utils.getRequest(config)
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
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/comprehension`)
                    .expect(200)
                    .expect(/<h3>Comprehension Test<\/h3>/)
                    .expect(/method="POST"/)
            });

            it(`POST should pass when answers are correct`, () => {
                return utils.getRequest(config)
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
                        return apiTest.bypassComprehensionTest(id);
                    }
                }));
            });
        });

        describe(`[game]`, () => {
            it(`GET should show game play`, () => {
                return utils.getRequest(config)
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
                utils.getRequest(config)
                    .post(`/parts/${firstPartId}/next-round`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        return utils.getRequest(config)
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
                utils.getRequest(config)
                    .post(`/parts/${firstPartId}/exclusion-vote`)
                    .send('vote=None')
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest(config)
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
                utils.getRequest(config)
                    .post(`/parts/${lastPartId}/exclusion-vote`)
                    .send('vote=None')
                    .expect(302)
                    .expect('Location', `/parts/${lastPartId}/`)
                    .end((err) => {
                        if (err) throw err;
                        utils.getRequest(config)
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
                    utils.getRequest(config)
                        .post(`/parts/${lastPartId}/game`)
                        .send('contribution=10')
                        .expect(302)
                        .expect('Location', `/parts/${lastPartId}/`)
                        .end((err) => {
                            if (err) throw err;
                            utils.getRequest(config)
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
                    utils.getRequest(config)
                        .get(`/parts/${lastPartId}`)
                        .expect(200)
                        .expect(/You received at least/)
                        .expect(/and will not play in this round/)
                        .end((err) => {
                            if (err) throw err;
                            utils.getRequest(config)
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
                    utils.getRequest(config)
                        .post(`/parts/${lastPartId}/game`)
                        .expect(302)
                        .expect('Location', `/parts/${lastPartId}/`)
                        .end((err) => {
                            if (err) throw err;
                            utils.getRequest(config)
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
                    utils.getRequest(config)
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
                    utils.getRequest(config)
                        .get(`/parts/${lastPartId}`)
                        .expect(200)
                        .expect(/How many of your .* points would you like to transfer to the group fund?/)
                        .expect(/<form action="game" method="POST"/)
                        .end(done);
                });
            });
        });
    });
    describe(`[fake reputation] /parts/:part`, () => {
        let expId;
        let partIds;
        let firstPartId;
        let lastPartId;

        before(() => {
            return api.createExp({
                passcode: 'pg',
                partSize: '4',
                numRounds: '8',
                kickEnabled: 'false',
                fakeReputationEnabled: 'true'
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
            // TODO: add fake reputaion specific instruction.
            it(`should show instructions`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/.*<a href="comprehension">.*/)
            });
        });

        describe(`/comprehension`, () => {
            // TODO: add fake reputaion specific test.
            it(`GET should show comprehension test`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/comprehension`)
                    .expect(200)
                    .expect(/<h3>Comprehension Test<\/h3>/)
                    .expect(/method="POST"/)
            });

            it(`POST should pass when answers are correct`, () => {
                return utils.getRequest(config)
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
                        return apiTest.bypassComprehensionTest(id);
                    }
                }));
            });
        });

        describe(`[game]`, () => {
            it(`GET should show game play`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/How many of your .* points would you like to transfer to the group fund?/)
                    .expect(/You can claim to contribute more than you really do/)
                    .expect(/<form action="game" method="POST"/);
            });
            it(`the first participant should be able to fake reputation`, () => {
                return utils.getRequest(config)
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
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/Claimed contribution.*Participant #1 10.*actually contribute 0/)
                    .expect(/Claimed group funds = 40/)
                    .expect(/Actual group funds = 30/)
                    .expect(/Group earnings = 60/)
                    .expect(/claimed to earn.*Participant #1 15.*actually earn 23/);
            });
            it(`the last paricipant should not see the actuall result of the first participant`, () => {
                return utils.getRequest(config)
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
});
