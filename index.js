#!/usr/bin/node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');
const CKAN = require('ckan');
const request = require('request');
const csv2geojson = require('csv2geojson');

mkdirp.sync('cache');

var activeRequestsComplete = 0;
var activeRequestsTotal = 0;

glob('sources/**/*.json', {}, function (err, sources) {
    sources.forEach(function (file) {
        console.log(file);

        var dir = path.join('cache', path.dirname(file).replace(/^sources\//, ''));
        mkdirp.sync(dir);

        var source = JSON.parse(fs.readFileSync(file));
        processSource(source, dir);
    });
});

function processSource(source, dir) {
    switch (source.type) {
        case 'ckan':
            processCKANSource(source, dir);
            break;
        default:
            console.error('Unknown source type: ' + source.type);
    }
}

function processCKANSource(source, dir) {
    if (!source.base_url) {
        console.error('CKAN source needs a base_url.');
    }
    var client = new CKAN.Client(source.base_url);
    Object.keys(source.datasets).map( dataset => {
        console.log('   ' + dataset);
        client.action('package_show', { id: dataset }, function (err, result) {
            if (err) {
                console.error(`Error in package_show for "${source.base_url}" in dataset "${dataset}"`);
            } else {
                if (result && result.result && result.result.resources.length) {
                    var resource = result.result.resources.find((i) => {
                        return i && (i.id == source.datasets[dataset].resource);
                        console.log(i.id, source.datasets[dataset].resource);
                    });
                    if (!resource) {
                        console.error(`Resource not found for "${source.base_url}" in dataset "${dataset}"`);
                    } else {
                        activeRequestsTotal++;
                        printActiveRequests();
                        var outputPath = path.format({
                            dir: dir,
                            name: dataset,
                            ext: path.extname(resource.url)
                        });
                        var stream = request(resource.url).pipe(fs.createWriteStream(outputPath));
                        stream.on('finish', () => {
                            activeRequestsComplete++;
                            printActiveRequests();
                            toOSM(outputPath);
                        });
                    }
                }
            }
        });
    });
}

function printActiveRequests() {
    process.stdout.write(`${activeRequestsComplete}/${activeRequestsTotal}\r`);
}

function toOSM(filePath, transform) {
    fs.readFile(filePath, 'utf8', (err, csv) => {
        csv2geojson.csv2geojson(csv, (err, geojson) => {
            var geojsonPath = path.format({
                dir: path.dirname(filePath),
                name: path.basename(filePath, path.extname(filePath)),
                ext: '.geojson'
            });
            fs.writeFile(geojsonPath, JSON.stringify(geojson), (err) => {
            });
        });
    });
}
