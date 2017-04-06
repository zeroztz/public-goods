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
    let samplePartId;

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
                samplePartId = partIds[0];
            });
        });
    });

    describe.skip('promise', () => {
        it('', (done) => {
            new Promise((resolve, reject) => {
                resolve(2);
            }).then(resolve => {
                return new Promise((resolve, reject) => {
                    reject(1);
                });
            }).catch((err) => {
                err.should.equal(1);
            }).then(() => {
                done();
            });
        });
    });

    describe(`/exps`, () => {
        describe(`/`, () => {
            it(`should show a list of exps`, (done) => {
                const expected = `<div class="media-body">`;
                utils.getRequest(config)
                    .get(`/exps`)
                    .expect(200)
                    .expect((response) => {
                        response.text.includes(expected).should.be.true();
                    })
                    .end(done);
            });


            // TODO: Emulator does not support this case.
            // TODO: should return badrequest
            it.skip(`should handle error`, (done) => {
                utils.getRequest(config)
                    .get(`/exps`)
                    .query({
                        pageToken: `badrequest`
                    })
                    .expect(500)
                    .end(done);
            });
        });

        describe('/create', () => {
            it('should reject without passcode.', (done) => {
                utils.getRequest(config)
                    .post('/exps/create')
                    .send('passcode=randomString')
                    .expect(401)
                    .end(done);
            });

            it('should reject with incorrect passcode.', (done) => {
                utils.getRequest(config)
                    .post('/exps/create')
                    .send('passcode=randomString')
                    .expect(401)
                    .end(done);
            });

            it('should create experiment with correct passcode.', (done) => {
                utils.getRequest(config)
                    .post(`/exps/create`)
                    .send(`passcode=pg`)
                    .expect(302)
                    .expect((response) => {
                        const location = response.headers.location;
                        const idPart = location.replace(`/exps/`, ``);
                        var id = parseInt(idPart, 10);
                        id.should.not.be.NaN();
                        id.should.not.be.Infinity();
                    })
                    .end(done);
            });
        });


        describe(`/:exp`, () => {
            it(`should show corresponding exp.`, (done) => {
                const expected = `Experiment ${expId}`;
                utils.getRequest(config)
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
                    })
                    .end(done);
            });
        });

        describe(`/:exp`, () => {
            it(`should show 404 with id -1.`, (done) => {
                utils.getRequest(config)
                    .get(`/exps/-1`)
                    .expect(404)
                    .end(done);
            });
        });
    });

    describe(`/parts/:part`, () => {
        describe(`/instruction`, () => {
            it(`../ should redirect to /parts/:part/instruction`, (done) => {
                utils.getRequest(config)
                    .get(`/parts/${samplePartId}`)
                    .expect(302)
                    .expect('Location', `/parts/${samplePartId}/instruction`)
                    .end(done);
            });

            it(`should show instructions`, (done) => {
                utils.getRequest(config)
                    .get(`/parts/${samplePartId}/instruction`)
                    .expect(200)
                    .expect(/<h3>Instructions<\/h3>/)
                    .expect(/multiplier/)
                    .expect(/.*<a href="comprehension">.*/)
                    .end(done);
            });
        });

        describe(`/comprehension`, () => {
            it(`../game should not able to go to game directly`, (done) => {
                utils.getRequest(config)
                    .get(`/parts/${samplePartId}/game`)
                    .expect(302)
                    .expect('Location', `/parts/${samplePartId}`)
                    .end(done);
            });

            it(`../game should not able to post contribution`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${samplePartId}/game`)
                    .expect(302)
                    .expect('Location', `/parts/${samplePartId}`)
                    .end(done);
            });

            it(`should show comprehension test`, (done) => {
                utils.getRequest(config)
                    .get(`/parts/${samplePartId}/comprehension`)
                    .expect(200)
                    .expect(/<h3>Comprehension Test<\/h3>/)
                    .expect(/method="POST"/)
                    .end(done);
            });

            it(`should not pass when there is any incorrect answer`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${samplePartId}/comprehension`)
                    .send('q1=c')
                    .send('q2=c')
                    .expect(200)
                    .expect(/You seem to have missed at least one of the comprehension check questions./)
                    .end(done);
            });

            it(`should pass when answers are correct`, (done) => {
                utils.getRequest(config)
                    .post(`/parts/${samplePartId}/comprehension`)
                    .send('q1=c')
                    .send('q2=b')
                    .expect(200)
                    .expect(/You got all the comprehension questions correct/)
                    .end(done);
            });

            it('should not allow you submit it again if you have already passed', (done) => {
                utils.getRequest(config)
                    .post(`/parts/${samplePartId}/comprehension`)
                    .send('q1=c')
                    .send('q2=c')
                    .expect(403)
                    .expect('You have already finished comprehension test')
                    .end(done);
            });

            it(`../game should wait for other participants`, (done) => {
                utils.getRequest(config)
                    .get(`/parts/${samplePartId}/game`)
                    .expect(200)
                    .expect(/Please wait for all paritipants to finish comprehension test/)
                    .end(done);
            });

            after((done) => {
                partIds.map((id) => {
                    if (id != samplePartId) {
                        api.validateComprehensionTest(
                            id, {
                                q1: 'c',
                                q2: 'b'
                            }
                        ).then((missCount) => {
                            missCount.should.be.zero();
                        });
                    }
                });
                done();
            });
        });

        describe(`/game`, () => {});
    });
});
