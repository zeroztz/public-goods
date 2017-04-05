'use strict';

const config = require(`./config`);
const utils = require(`nodejs-repo-tools`);
const should = require(`should`);
const api = require(`../api`);

describe(`/exps`, () => {
    before(() => {
        return process.env.should.have
            .property('DATASTORE_EMULATOR_HOST')
            .which.startWith('localhost:');
    });

    let expId;
    let partIds;

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
                    part.should.is.a.Number();
                    return part;
                });
            });
        });
    });


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
                    response.text.includes(`Redirecting to /exps/`).should.be.true();
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
                    response.text.includes(expected).should.be.true();
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
