'use strict';

const config = require(`./config`);
const utils = require(`nodejs-repo-tools`);
const should = require(`should`);

describe(`/exps`, () => {
    before(() => {
        return process.env.should.have
            .property('DATASTORE_EMULATOR_HOST')
            .which.startWith('localhost:');
    });

    let id;

    before((done) => {
        utils.getRequest(config)
            .post(`/exps/create`)
            .send(`passcode=pg`)
            .expect(302)
            .expect((response) => {
                const location = response.headers.location;
                const idPart = location.replace(`/exps/`, ``);
                id = parseInt(idPart, 10);
                response.text.includes(`Redirecting to /exps/`).should.be.true();
            })
            .end(done);
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


        // Emulator does not support this case.
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

    describe(`/:exp`, () => {
        it(`should show corresponding exp.`, (done) => {
            const expected = `Experiment ${id}`;
            utils.getRequest(config)
                .get(`/exps/${id}`)
                .expect(200)
                .expect((response) => {
                    response.text.includes(expected).should.be.true();
                })
                .end(done);
        });
    });
});
