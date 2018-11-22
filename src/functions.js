exports.bool = function (input) {
    if (typeof input === "string") {
        var lower = input.toLowerCase();
        switch (lower) {
            case 'yes':
            case '1':
            case 'true':
            case 't':
                return true;
            default:
                return false;
        }
    } else {
        return input ? true : false;
    }
}

exports.lookup = function (map, value) {
    if (value in map) {
        return map[value];
    }
}

exports.upper_case = function (input) {
    return input.toUpperCase();
}

exports.lower_case = function (input) {
    return input.toLowerCase();
}

exports.title_case = function (input) {
    return input.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
