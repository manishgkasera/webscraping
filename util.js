
function log(...message) {
    console.log(new Date(), " => ", ...message)
}

function arrayToJson(array) {
    let json = {};
    let val;
    for(let i=0; i < array.length; i++){
        if(i%2 == 0)
            val = array[i]
        else
            json[array[i]] = val
    }
    return json;
}

module.exports = {
    log: log,
    arrayToJson: arrayToJson
}