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
        return api.createExp({
            passcode: 'pg',
            partSize: '4'
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
                        partSize: '3'
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

    describe(`/parts/:part`, () => {
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

        describe(`[game]`, () => {
            it(`GET should show game play`, () => {
                return utils.getRequest(config)
                    .get(`/parts/${firstPartId}`)
                    .expect(200)
                    .expect(/How many of your .* points would you like to transfer to the group fund?/)
                    .expect(/<form action="game" method="POST"/);
            });
            it(`POST /game should submit contribution and wait others`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=10')
                    .expect(302)
                    .expect('Location', `/parts/${firstPartId}`)
                    .end(() => {
                        return utils.getRequest(config)
                            .get(`/parts/${firstPartId}`)
                            .expect(200)
                            .expect(/Please wait for all paritipants to finish this round./)
                            .expect(/<a href="."/)
                    });
            });
            it(`POST /game should not allow submit contribution again`, () => {
                return utils.getRequest(config)
                    .post(`/parts/${firstPartId}/game`)
                    .send('contribution=8')
                    .expect(403)
                    .expect(/You have already made contribution this round/);
            });
            it(`POST /game should let other participants to submit contribution`, () => {
                return Promise.all(partIds.map((id) => {
                    if (id != firstPartId && id != lastPartId) {
                        return api.submitContribution(id, 8).catch((err) => {
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
                    .expect('Location', `/parts/${lastPartId}`)
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
                    .expect('Location', `/parts/${firstPartId}`)
                    .end((err) => {
                        if (err) throw err;
                        return utils.getRequest(config)
                            .get(`/parts/${firstPartId}`)
                            .expect(200)
                            .expect(/How many of your .* points would you like to transfer to the group fund?/)
                            .end(done)
                    });
            });

            it(`should able to finish 2nd round`, (done) => {
                Promise.all(partIds.map((id) => {
                    if (id != firstPartId) {
                        return api.readyForNextRound(id).then((success) => {
                            success.should.be.true();
                        });
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
                    utils.getRequest(config)
                        .post(`/parts/${lastPartId}/game`)
                        .send('contribution=8')
                        .expect(302)
                        .expect('Location', `/parts/${lastPartId}`)
                        .end((err) => {
                            if (err) throw err;
                            utils.getRequest(config)
                                .get(`/parts/${lastPartId}`)
                                .expect(200)
                                .expect(/Participant #2 38/)
                                .expect(/<form action="next-round" method="POST"/)
                                .end(done);
                        });
                });

            });
        });
    });
});
