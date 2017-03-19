'use strict';

const path = require(`path`);

module.exports = {
    test: `public-goods`,
    cwd: path.resolve(path.join(__dirname, `../`)),
    cmd: `node`,
    args: [`app.js`],
    port: 8082,
    msg: `Public Goods`
};
