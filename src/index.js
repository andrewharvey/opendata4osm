#!/usr/bin/node

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');
const CKAN = require('ckan');
const request = require('request');
const csv2geojson = require('csv2geojson');
const ogr2ogr = require('ogr2ogr');
const geojsontoosm = require('geojsontoosm');

const conform = require('./conform');

const env = {
    'cache_dir': 'cache',
    'osm_dir': 'osm'
};

mkdirp.sync(env.cache_dir);
mkdirp.sync(env.osm_dir);

var activeRequestsComplete = 0;
var activeRequestsTotal = 0;

if (process.argv.length > 2) {
    // if any sources are specified on the command line only process those sources
    for (var i = 2; i < process.argv.length; i++) {
        var file = process.argv[i];
        console.log(`Processing source ${file}`);

        var dir = path.dirname(file).replace(/^sources\//, '');
        mkdirp.sync(dir);

        var source = JSON.parse(fs.readFileSync(file));
        processSource(source, dir);
    }
} else {
    // otherwise process all sources
    glob('sources/**/*.json', {}, function (err, sources) {
        sources.forEach(function (file) {
            console.log(file);

            var dir = path.dirname(file).replace(/^sources\//, '');
            mkdirp.sync(dir);

            var source = JSON.parse(fs.readFileSync(file));
            processSource(source, dir);
        });
    });
}

function processSource(source, dir) {
    switch (source.type) {
        case 'ckan':
            console.log('   source is CKAN');
            processCKANSource(source, dir);
            break;
        case 'arcgis-opendata':
            console.log('   source is ArcGIS Open Data Portal');
            processArcGISOpenDataSource(source, dir);
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
                            dir: path.join(env.cache_dir, dir),
                            name: dataset,
                            ext: path.extname(resource.url)
                        });

                        if (fs.existsSync(outputPath)) {
                            console.log(`    ${dataset} already exists, skipping download`);

                            toGeoJSON(outputPath, source.datasets[dataset].tags, (path, geojson, transform) => {
                                toOSM(path, geojson, transform);
                            });
                        } else {
                            var stream = request(resource.url).pipe(fs.createWriteStream(outputPath));
                            stream.on('finish', () => {
                                activeRequestsComplete++;
                                printActiveRequests();
                                toGeoJSON(outputPath, source.datasets[dataset].tags, (path, geojson, transform) => {
                                    toOSM(path, geojson, transform);
                                });
                            });
                        }
                    }
                }
            }
        });
    });
}

function processArcGISOpenDataSource(source, dir) {
    // http://actmapi-actgov.opendata.arcgis.com/datasets/ed8065e191e642e4bc3e08917aa0b7e3_2.geojson
    if (!source.base_url) {
        console.error('ArcGIS Open Data source needs a base_url.');
    }
    Object.keys(source.datasets).map( dataset => {
        console.log('   ' + dataset);
        var cachePath = path.format({
            dir: path.join(env.cache_dir, dir),
            name: dataset,
            ext: '.geojson'
        });
        if (fs.existsSync(cachePath)) {
            console.log(`    ${dataset} already exists, skipping download`);

            conformAndSave(cachePath, source, dir, dataset);
        } else {
            var stream = request(source.base_url + '/datasets/' + source.datasets[dataset].resource + '.geojson').pipe(fs.createWriteStream(cachePath));
            stream.on('finish', () => {
                activeRequestsComplete++;
                printActiveRequests();
                conformAndSave(cachePath, source, dir, dataset);

            });
        }
    });
}

function conformAndSave(cachePath, source, dir, dataset) {
    const geojson = JSON.parse(fs.readFileSync(cachePath, { encoding: 'utf8' }));

    mkdirp.sync(path.join(env.osm_dir, dir));
    var outputPath = path.format({
        dir: path.join(env.osm_dir, dir),
        name: dataset,
        ext: '.geojson'
    });
    fs.writeFileSync(outputPath, JSON.stringify(conform(source.datasets[dataset].tags || {}, geojson), null, 2));
}

function printActiveRequests() {
    process.stdout.write(`${activeRequestsComplete}/${activeRequestsTotal}\r`);
}

function toGeoJSON(filePath, transform, callback) {
    var ext = path.extname(filePath);
    var geojsonPath = path.format({
        dir: path.dirname(filePath),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.geojson'
    });
    console.log(`Converting ${filePath} to GeoJSON`);
    switch (ext) {
        case '.csv':
            fs.readFile(filePath, 'utf8', (err, csv) => {
                csv2geojson.csv2geojson(csv, (err, geojson) => {
                    fs.writeFile(geojsonPath, JSON.stringify(geojson), (err) => {
                        callback(geojsonPath, geojson, transform);
                    });
                });
            });
            break;
        case '.geojson':
            callback(filePath, null, transform);
            break;
        case '.zip':
            var geojson = ogr2ogr(filePath)
                .format('GeoJSON')
                .skipfailures()
                .stream();
            geojson.pipe(fs.createWriteStream(geojsonPath))
                .on('finish', () => {
                    callback(geojsonPath, null, transform);
                });
            break;
        default:
            console.log(`Unknown extension ${ext} at ${filePath}`);
            break;
    }
}

function toOSM(geojsonPath, geojson, transform) {
    console.log(`Converting ${geojsonPath} to OSM XML`);
    var osmPath = path.format({
        dir: path.dirname(geojsonPath),
        name: path.basename(geojsonPath, path.extname(geojsonPath)),
        ext: '.osm'
    });

    if (!geojson) {
        fs.readFile(geojsonPath, 'utf8', (err, data) => {
            if (err) throw err;

            geojson = JSON.parse(data);
            geojsonToOSM(osmPath, conform(transform, geojson));
        });
    } else {
        geojsonToOSM(osmPath, conform(transform, geojson));
    }
}

function geojsonToOSM(path, geojson) {
    var osm = geojsontoosm(geojson);
    fs.writeFile(path, osm, (err) => {
        if (err) throw err;
    });
}
