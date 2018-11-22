export default function (map, value) {
    if (value in map) {
        return map[value];
    }
}
