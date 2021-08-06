
function log(...message) {
    console.log(new Date(), " => ", ...message)
}

function currencyStringToNumber(string) {
    return string.replace(/[^\.\d]/g, '');
}

function arrayToMap(array) {
    let map = new Map();
    let val;
    for(let i=0; i < array.length; i++){
        if(i%2 == 0)
            val = array[i]
        else
            map.set(array[i], val)
    }
    return map;
}

module.exports = {
    log: log,
    arrayToMap: arrayToMap,
    currencyStringToNumber: currencyStringToNumber
}