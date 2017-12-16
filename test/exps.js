'use strict';

const utils = require(`./utils`);
const should = require(`should`);
const api = require(`../api`);

// unit tests that exps/ works correctly.
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
            const expected = `<div class="media-body">`; return utils.getRequest()
                .get(`/exps`)
                .expect(200)
                .expect((response) => {
                    response.text.includes(expected).should.be.true();
                });
        });


        it(`should handle error`, () => {
            return utils.getRequest()
                .get(`/exps`)
                .query({
                    pageToken: `badrequest`
                })
                .expect(400);
        });
    });

    describe('/create', () => {
        it('should reject without passcode.', () => {
            return utils.getRequest()
                .post('/exps/create')
                .expect(401);
        });

        it('should reject with incorrect passcode.', () => {
            return utils.getRequest()
                .post('/exps/create')
                .send('passcode=randomString')
                .expect(401);
        });

        it('should create experiment with correct passcode.', () => {
            return utils.getRequest()
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
            return utils.getRequest()
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
            return utils.getRequest()
                .get(`/exps/-1`)
                .expect(404)
        });
    });
});

