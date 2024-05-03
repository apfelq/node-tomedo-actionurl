import Ajv from 'ajv'
import express from 'express'
import fs from 'graceful-fs'
import got from 'got'
import path from 'path'
import process from 'process'
import { promisify } from 'util'

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
interface setupInterface
{
    description?: string
    pbxType: string
    pbxRegex?: string
    requestUri: string
    sipAccount?: string
    tomedoClients: [{
        ip: string
        port: number
    }]
}

interface settingsInterface
{
    logDir?: string
    port: number
    setup: setupInterface[]
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

// define apis
for (let setup of settings.setup)
{

    if (setup.requestUri.substring(0, 1) !== '/') setup.requestUri = `/${setup.requestUri}`

    app.get(setup.requestUri, async (req, res, next) => {

        try
        {
            // process received http request
            const request = req.originalUrl.slice(0, setup.requestUri.length)
            const query = req.query
            
            // only do something if request matches requestUri
            if (setup.requestUri === request)
            {
                // Auerswald
                await processAuerswald(setup, request, query)

                // Yealink
                await processYealink(setup, request, query)
            }

            // close connection
            res.sendStatus(200)
        }
        catch (e)
        {
            console.log(e.message)
            return next(e)
        }
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
async function processAuerswald (setup: setupInterface, request: string, query: auerswaldQueryInterface): Promise<any>
{
    let requests = []

    for (let client of setup.tomedoClients)
    {
        if (setup.requestUri === request && setup.pbxType === 'auerswald')
        {
            requests.push(got(`http://${client.ip}:${client.port}/${query.event}/${query.number}`))
        }
    }

    return Promise.all(requests)
}

// process Yealink request
interface yealinkQueryInterface
{
    call_id: string
    event: string
}
async function processYealink (setup: setupInterface, request: string, query: yealinkQueryInterface): Promise<any>
{
    let requests = []

    for (let client of setup.tomedoClients)
    {
        if (setup.requestUri === request && setup.pbxType === 'yealink')
        {
            requests.push(got(`http://${client.ip}:${client.port}/${query.event}/${query.call_id}`))
        }
    }

    return Promise.all(requests)
}