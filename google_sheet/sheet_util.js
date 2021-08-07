const Util = require("../util.js");
const {google} = require("googleapis");

const HEADERS = ['Date', 'Total Cost Value', 'Total Market Value', 'Appreciation', 'Wtd. Avg Age days', 'Wtd.Avg Annualized return*', 'Investment', 'Day +/-', 'Week +/-', 'Month +/-'];

function getSheetsService() {
    let jwtClient = new google.auth.JWT(
        process.env.GOOGLE_SHEET_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_SHEET_PRIVATE_KEY,
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    jwtClient.authorize(function (err, tokens) {
        if (err) {
            console.log(err);
            return;
        } else {
            console.log("Successfully connected!");
        }
    });

    return google.sheets({"version": 'v4', "auth": jwtClient});
}

function isCurrencyHeader(header) {
    return ['Total Cost Value', 'Total Market Value', 'Appreciation'].includes(header)
}

// 1 => A, 3 => C and so on
function numberToA1Index(number) {
    return String.fromCharCode(64 + number);
}

function dataCurrencyToNumber(data){
    for(let [header, val] of data){
        if(isCurrencyHeader(header)){
            data.set(header, Util.currencyStringToNumber(val))
        }
    }
    return data;
}

module.exports = {
    getSheetsService: getSheetsService,
    dataCurrencyToNumber: dataCurrencyToNumber,
    numberToA1Index: numberToA1Index,
    HEADERS: HEADERS
}
