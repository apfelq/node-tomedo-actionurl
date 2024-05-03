import Ajv from 'ajv';
import express from 'express';
import fs from 'graceful-fs';
import got from 'got';
import process from 'process';
import { promisify } from 'util';
const __dirname = process.cwd();
const fsAccess = promisify(fs.access);
const fsAppendFile = promisify(fs.appendFile);
const fsMkdir = promisify(fs.mkdir);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);
let settingsSchema;
try {
    settingsSchema = JSON.parse(await fsReadFile(__dirname + '/settings.schema', { encoding: 'utf8' }));
    console.log(`settings schema: loaded`);
}
catch (e) {
    console.log(`settings schema: failed (${e.message})`);
    throw e;
}
let settings;
try {
    settings = JSON.parse(await fsReadFile(__dirname + '/settings.json', { encoding: 'utf8' }));
    console.log(`settings: loaded`);
}
catch (e) {
    console.log(`settings: failed (${e.message})`);
    process.exit(1);
}
const validate = new Ajv.default({ allowUnionTypes: false }).compile(settingsSchema);
if (!validate(settings)) {
    console.log(`settings schema: invalid (${JSON.stringify(validate.errors)})`);
    process.exit(1);
}
console.log(`settings: valid`);
const app = express();
for (let setup of settings.setup) {
    if (setup.requestUri.substring(0, 1) !== '/')
        setup.requestUri = `/${setup.requestUri}`;
    app.get(setup.requestUri, async (req, res, next) => {
        try {
            const request = req.originalUrl.slice(0, setup.requestUri.length);
            const query = req.query;
            if (setup.requestUri === request) {
                await processAuerswald(setup, request, query);
                await processYealink(setup, request, query);
            }
            res.sendStatus(200);
        }
        catch (e) {
            console.log(e.message);
            return next(e);
        }
    });
}
app.listen(settings.port);
console.log(`app: listening for incoming requests (port ${settings.port})`);
async function processAuerswald(setup, request, query) {
    let requests = [];
    for (let client of setup.tomedoClients) {
        if (setup.requestUri === request && setup.pbxType === 'auerswald') {
            requests.push(got(`http://${client.ip}:${client.port}/${query.event}/${query.number}`));
        }
    }
    return Promise.all(requests);
}
async function processYealink(setup, request, query) {
    let requests = [];
    for (let client of setup.tomedoClients) {
        if (setup.requestUri === request && setup.pbxType === 'yealink') {
            requests.push(got(`http://${client.ip}:${client.port}/${query.event}/${query.call_id}`));
        }
    }
    return Promise.all(requests);
}
