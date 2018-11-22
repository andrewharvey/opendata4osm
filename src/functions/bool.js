export default function (input) {
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
