'use strict';

// unit tests that every pages render correctly.

const config = require(`./config`);
const utils = require(`nodejs-repo-tools`);
const should = require(`should`);
const api = require(`../api`);

describe(`[views]`, () => {
    before(() => {
        return process.env.should.have
            .property('DATASTORE_EMULATOR_HOST')
            .which.startWith('localhost:');
    });

    let expId;
    let partIds;
    let firstPartId;
    let lastPartId;

    before(() => {
        return api.createExp('pg').then((id) => {
            id.should.not.be.NaN();
            id.should.not.be.Infinity();
            expId = id;
            return api.readExp(expId).then((result) => {
                result.should.not.be.null();
                result.should.have.property('participants')
                    .which.is.a.Array().and.have.length(3);
                partIds = result.participants.map((part) => {
                    part.should.be.a.Number();
                    return part;
                });
                firstPartId = partIds[0];
                lastPartId = partIds[1];
            });
        });
    });

    describe(`/exps`, () => {
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


            // TODO: Emulator does not support this case.
            // TODO: should return badrequest
            it.skip(`should handle error`, () => {
                return utils.getRequest(config)
                    .get(`/exps`)
                    .query({
                        pageToken: `badrequest`
                    })
                    .expect(500);
            });
        });

        describe('/create', () => {
            it('should reject without passcode.', () => {
                return utils.getRequest(config)
                    .post('/exps/create')
                    .send('passcode=randomString')
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
                    .send(`passcode=pg`)
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

    describe(`/parts/:part`, () => {
        describe(`/instruction`, () => {
            it(`../ should redirect to /parts/:part/instruction`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/instruction`)
            });

            it(`should show instructions`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/instruction`)
                    .expect(200)
                    .expect(/<h3>Instructions<\/h3>/)
                    .expect(/multiplier/)
                    .expect(/.*<a href="comprehension">.*/)
            });
        });

        describe(`/comprehension`, () => {
            it(`GET ../game should not go to game directly`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/game`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}`)
            });

            it(`POST ../game should not submit contribution`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}`)
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
                    .send('q1=c')
                    .send('q2=c')
                    .expect(200)
                    .expect(/You seem to have missed at least one of the comprehension check questions./)
            });

            it(`POST should pass when answers are correct`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/comprehension`)
                    .send('q1=c')
                    .send('q2=b')
                    .expect(200)
                    .expect(/You got all the comprehension questions correct/)
            });

            it(`POST should not allow you submit it again once you passed`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/comprehension`)
                    .send('q1=c')
                    .send('q2=c')
                    .expect(403)
                    .expect('You have already finished comprehension test')
            });

            it(`GET ../game should wait for other participants`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/game`)
                    .expect(200)
                    .expect(/Please wait for all paritipants to finish comprehension test/)
            });

            it(`POST should let other particiants to finish comprehension test`, () => {
                return Promise.all(partIds.map((id) => {
                    if (id != firstPartId) {
                        return api.validateComprehensionTest(
                            id, {
                                q1: 'c',
                                q2: 'b'
                            }
                        ).then((result) => {
                            result.should.have.property('missCount').which.equal(0);
                        });
                    }
                }));
            });
        });

        describe(`/game`, () => {
            it(`GET should show game play`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/game`)
                    .expect(200)
                    .expect(/How many of your .* points would you like to transfer to the group fund?/)
            });
            it(`POST should submit contribution and wait others`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=10')
                    .expect(200)
                    .expect(/Please wait for all paritipants to finish this round./)
            });
            it(`POST should not allow submit contribution again`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=8')
                    .expect(403)
                    .expect(/You have already made contribution this round/);
            });
            it(`POST should let other participants to submit contribution`, () => {
                return Promise.all(partIds.map((id) => {
                    if (id != firstPartId && id != lastPartId) {
                        return api.submitContribution(id, 8).catch((err) => {
                            err.should.equal('not all finished');
                        });
                    }
                }));
            });
            it(`POST should show result when last participant submitted contribution`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${lastPartId}/game`)
                    .send('contribution=6')
                    .expect(200)
                    .expect(/Participant 20/)
                    .expect(/<form action="result" method="POST"/);
            });
            it(`GET should show result after all participants submitted contribution`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}/game`)
                    .expect(200)
                    .expect(/Participant 16/);
            });
            it(`POST /result should redirect to game and show next round`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game/result`)
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}/game`)
                    .then(() => {
                        return utils.getRequest(config)
                            .get(`/parts/${firstPartId}/game`)
                            .expect(200)
                            .expect(/How many of your .* points would you like to transfer to the group fund?/);
                    });
            });

            it(`should able to finishe 2nd round`, () => {
                return Promise.all(partIds.map((id) => {
                    if (id != firstPartId) {
                        return api.readyForNextRound(id);
                    }
                })).then(() => {
                    return Promise.all(partIds.map((id) => {
                        if (id != lastPartId) {
                            return api.submitContribution(id, 8).catch((err) => {
                                err.should.equal('not all finished');
                            });
                        }
                    }));
                }).then(() => {
                    return utils.getRequest(config)
                        .post(`/parts/${lastPartId}/game`)
                        .send('contribution=8')
                        .expect(200)
                        .expect(/Participant 38/)
                        .expect(/<form action="result" method="POST"/);
                });

            });
        });
    });
});
