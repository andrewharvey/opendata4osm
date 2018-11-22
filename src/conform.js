const featureEach = require('@turf/meta').featureEach;
const featureCollection = require('@turf/helpers').featureCollection;

module.exports = function (transform, geojson) {
    const features = geojson.features.map((feature) => {
        feature.properties = conform(transform, feature.properties);
        return feature;
    });
    return featureCollection(features);
}

function conform(t, p) {
    var tags = {};
    Object.keys(t).map((key) => {
        if (typeof t[key] === 'string') {
            // constant value
            tags[key] = t[key];
        } else if (typeof t[key] === 'object') {
            var o = t[key];
            if ('attribute' in o) {
                tags[key] = p[o.attribute]
            }
        } else {
            console.error('Unknown value type');
        }
    });
    return tags;
}
