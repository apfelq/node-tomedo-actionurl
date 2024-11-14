import Ajv from 'ajv'
import express from 'express'
import fs from 'graceful-fs'
import got from 'got'
import path from 'path'
import process from 'process'
import qs from 'qs'
import { promisify } from 'util'
import { findNumbers } from 'awesome-phonenumber'

const __dirname = process.cwd()
const fsAccess = promisify(fs.access)
const fsAppendFile = promisify(fs.appendFile)
const fsMkdir = promisify(fs.mkdir)
const fsReadFile = promisify(fs.readFile)
const fsWriteFile = promisify(fs.writeFile)

// load settings schema
let settingsSchema
try
{
    settingsSchema = JSON.parse(await fsReadFile(__dirname + '/settings.schema', {encoding: 'utf8'}))
    console.log(`settings schema: loaded`)
}
catch (e)
{
    console.log(`settings schema: failed (${e.message})`)
    throw e
}

// load settings
interface accountInterface
{
    description?: string
    sipUsername?: string
    tomedoClients: [{
        ip: string
        port: number
    }]
}

interface deviceInterface
{
    description?: string
    pbxType: string
    requestUri: string
    accounts: accountInterface[]
}

interface settingsInterface
{
    debug?: boolean
    logDir?: string
    port: number
    regionCode: string
    devices: deviceInterface[]
}
let settings: settingsInterface

try
{
    settings = JSON.parse(await fsReadFile(__dirname + '/settings.json', {encoding: 'utf8'}))
    console.log(`settings: loaded`)
}
catch (e)
{
    console.log(`settings: failed (${e.message})`)
    process.exit(1)
}
// validate json settings
const validate = new Ajv.default({allowUnionTypes: false}).compile(settingsSchema)
if (!validate(settings))
{
    console.log(`settings schema: invalid (${JSON.stringify(validate.errors)})`)
    process.exit(1)
}
console.log(`settings: valid`)

/*
/ setup app
*/
const app = express()

// normally query parser strips '+' from query https://github.com/ljharb/qs/blob/037f3686e8f8eee456cf958c39ffd8a967d4ead5/lib/utils.js#L112
// found here https://github.com/expressjs/express/issues/3453
app.set('query parser', function (str) {
    return qs.parse(str, { decoder: function (s) { return decodeURIComponent(s) } });
});

// define apis
for (let device of settings.devices)
{

    if (device.requestUri.substring(0, 1) !== '/') device.requestUri = `/${device.requestUri}`

    app.get(device.requestUri, async (req, res, next) => {

        // debugging
        if (settings.debug) console.log(`${(new Date()).toISOString()} debug: incoming request ${req.originalUrl} from ${req.ip}`)
        if (settings.debug) console.log(`${(new Date()).toISOString()} debug: incoming query ${JSON.stringify(req.query)}`)

        // process received http request
        const request = req.originalUrl.slice(0, device.requestUri.length)
        const query = req.query
            
        // only do something if request matches requestUri
        if (device.requestUri === request)
        {
            for (let account of device.accounts)
            {
                try
                {
                    // Auerswald
                    if (device.pbxType === 'auerswald') await processAuerswald(account, request, query)

                    // snom
                    if (device.pbxType === 'snom') await processSnom(account, request, query)

                    // Yealink
                    if (device.pbxType === 'yealink') await processYealink(account, request, query)
                }
                catch (e)
                {
                    if (settings.debug) console.log(`${(new Date()).toISOString()} debug: ${e.message}`)
                }

            }
        }

        // close connection
        res.sendStatus(200)

    })

}

app.listen(settings.port)
console.log(`app: listening for incoming requests (port ${settings.port})`)

// process Auerswald request
interface auerswaldQueryInterface
{
    number: string
    event: string
}
async function processAuerswald (account: accountInterface, request: string, query: auerswaldQueryInterface): Promise<any>
{
    let requests = []

    for (let client of account.tomedoClients)
    {
        const url = `http://${client.ip}:${client.port}/${query.event}/${query.number}`

        // debugging
        if (settings.debug) console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`)

        requests.push(got(url))
    }

    return Promise.all(requests)
}

// process snom request
interface snomQueryInterface
{
    active_user: string
    remote: string
    event: string
}
async function processSnom (account: accountInterface, request: string, query: snomQueryInterface): Promise<any>
{
    let requests = []

    for (let client of account.tomedoClients)
    {
        const url = `http://${client.ip}:${client.port}/${query.event}/${query.remote}`

        // debugging
        if (settings.debug) console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`)

        if (account.sipUsername === query.active_user) requests.push(got(url))
    }

    return Promise.all(requests)
}

// process Yealink request
interface yealinkQueryInterface
{
    active_user: string
    callerID: string
    event: string
}
async function processYealink (account: accountInterface, request: string, query: yealinkQueryInterface): Promise<any>
{
    let requests = []

    const callerID = findNumbers(query.callerID, {defaultRegionCode: settings.regionCode})

    if (settings.debug) console.log(`${(new Date()).toISOString()} debug: matched callerID ${JSON.stringify(callerID[0]) || 'none'}`)

    if (callerID.length === 0)
    {
        // debugging
        if (settings.debug) console.log(`${(new Date()).toISOString()} debug: caller is anonymous or unknown`)
        return Promise.resolve()
    }

    for (let client of account.tomedoClients)
    {
        if (account.sipUsername === query.active_user) 
        {
            const url = `http://${client.ip}:${client.port}/${query.event}/${callerID[0].phoneNumber.number.e164}`
            // debugging
            if (settings.debug) console.log(`${(new Date()).toISOString()} debug: outgoing request ${url}`)
            requests.push(got(url))
        }
        else
        {
            // debugging
            if (settings.debug) console.log(`${(new Date()).toISOString()} debug: mismatch in sipusername ${account.sipUsername} vs ${query.active_user}`)
        }
    }

    return Promise.all(requests)
}