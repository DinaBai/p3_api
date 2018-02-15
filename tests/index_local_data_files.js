#!/usr/bin/env node
/**
 *
 * Example Usage:
 * ./index_local_data_files.js
 *      --endpoint http://localhost:8983/some/solr/instance     (optional)
 *      --owner user@patricbrc.org                              (optional; change owner of all records)
 *
 * TODO:
 *      - Could use set operations to change owner instead
 */

const fs = require("fs")
const opts = require('commander')
const rp = require('request-promise')
const Promise = require("bluebird");
const DISTRIBUTE_URL = 'http://localhost:8983/solr'
const BASE_DATA_DIR = './data-files'

const readFile = Promise.promisify(fs.readFile);
const readDir = Promise.promisify(fs.readdir);

// for progress
let totalCount
let remainingCount


if (require.main === module){
    opts.option('-t, --token [value]', 'Token for private genome access')
        .option('-e, --endpoint [value]', 'Endpoint to grab data from ' +
            '(i.e., http://localhost:8983/solr)')
        .option('-i, --input [value]', 'Directory to index into Solr')
        .option('-o, --owner [value]', 'Set new owner for data being indexed.')
        .parse(process.argv)

    loadData()
}


async function loadData() {
    const baseDir = opts.input || BASE_DATA_DIR

    const genomes = await readDir(baseDir)

    totalCount = genomes.length;
    remainingCount = genomes.length;

    for (let i = 0; i < genomes.length; i++){
        let genome = genomes[i];

        console.log(`Indexing genome ${genome}`)
        var files = await readDir(`${baseDir}/${genome}`)

        for (let i = 0; i < files.length; i++)  {
            let file = files[i]
            let core = file.split('.')[0]
            let f = `${baseDir}/${genome}/${file}`;

            let body = await submit(core, f);
        }
        remainingCount = remainingCount - 1
        console.log(`Progress: ${((1 - remainingCount / totalCount) * 100).toFixed(2)}%`)
        console.log()
    }
}


function submit(core, filePath){
    const query = 'update?versions=true&commit=true'
    const url = `${opts.endpoint || DISTRIBUTE_URL}/${core}/${query}`

    if (opts.owner) {
        console.log(`Loading core ${core} (Changed owner to: ${opts.owner})`)
        return readFile(filePath, "utf8").then(function(data) {

            // set owner in every object
            let objs = JSON.parse(data)
            objs.forEach(o => {
                if (!('owner' in o)){
                    console.error("Error: no existing owner field found in object: ${filePath}")
                    return;
                }
                o.owner = opts.owner
            })

            return rp.post({
                url: url,
                json: objs
            }).then(body => {
                return body
            }).catch(e => {
                console.error(e)
            })
        }).catch(e => console.error(e))
    }

    // Todo: test
    return fs.createReadStream(filePath).pipe(
        rp.post({
            url: url,
            Authorization: opts.token || ''
        }).then(body => {
            console.log(body, body)
        }).catch(e => console.error(e))
    )
}

