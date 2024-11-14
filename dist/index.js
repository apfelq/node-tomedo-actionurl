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
const reCallerId = /[+0-9]{4,}/;
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
for (let device of settings.devices) {
    if (device.requestUri.substring(0, 1) !== '/')
        device.requestUri = `/${device.requestUri}`;
    app.get(device.requestUri, async (req, res, next) => {
        if (settings.debug)
            console.log(`${(new Date()).toISOString()} debug: incoming request ${req.originalUrl} from ${req.ip}`);
        const request = req.originalUrl.slice(0, device.requestUri.length);
        const query = req.query;
        if (device.requestUri === request) {
            for (let account of device.accounts) {
                try {
                    if (device.pbxType === 'auerswald')
                        await processAuerswald(account, request, query);
                    if (device.pbxType === 'snom')
                        await processSnom(account, request, query);
                    if (device.pbxType === 'yealink')
                        await processYealink(account, request, query);
                }
                catch (e) {
                    if (settings.debug)
                        console.log(`${(new Date()).toISOString()} debug: ${e.message}`);
                }
            }
        }
        res.sendStatus(200);
    });
}
app.listen(settings.port);
console.log(`app: listening for incoming requests (port ${settings.port})`);
async function processAuerswald(account, request, query) {
    let requests = [];
    for (let client of account.tomedoClients) {
        const url = `http://${client.ip}:${client.port}/${query.event}/${query.number}`;
        if (settings.debug)
            console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`);
        requests.push(got(url));
    }
    return Promise.all(requests);
}
async function processSnom(account, request, query) {
    let requests = [];
    for (let client of account.tomedoClients) {
        const url = `http://${client.ip}:${client.port}/${query.event}/${query.remote}`;
        if (settings.debug)
            console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`);
        if (account.sipUsername === query.active_user)
            requests.push(got(url));
    }
    return Promise.all(requests);
}
async function processYealink(account, request, query) {
    let requests = [];
    for (let client of account.tomedoClients) {
        if (query.callerID.toLowerCase() === 'anonymous') {
            if (settings.debug)
                console.log(`${(new Date()).toISOString()} debug: caller is anonymous`);
            continue;
        }
        if (account.sipUsername === query.active_user) {
            const url = `http://${client.ip}:${client.port}/${query.event}/${query.callerID}`;
            if (settings.debug)
                console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`);
            requests.push(got(url));
        }
        else {
            if (settings.debug)
                console.log(`${(new Date()).toISOString()} debug: mismatch in sipusername ${account.sipUsername} vs ${query.active_user}`);
        }
    }
    return Promise.all(requests);
}
