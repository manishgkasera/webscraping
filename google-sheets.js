const dotenv = require('dotenv')
dotenv.config()
const { GoogleSpreadsheet } = require('google-spreadsheet');
const util = require("./util.js");
const log = util.log;
const currencyStringToNumber = util.currencyStringToNumber;
const arrayToMap = util.arrayToMap;

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
const HEADERS = ['Date', 'Total Cost Value', 'Total Market Value', 'Appreciation', 'Wtd. Avg Age days', 'Wtd.Avg Annualized return*'];

function isCurrencyHeader(header) {
    return ['Total Cost Value', 'Total Market Value', 'Appreciation'].includes(header)
}

function dataCurrencyToNumber(data){
    for(let [header, val] of data){
        if(isCurrencyHeader(header)){
            data.set(header, currencyStringToNumber(val))
        }
    }
    return data;
}
async function addToGoogleSheet(datetime, numbers){

    let data = arrayToMap(numbers);
    data = dataCurrencyToNumber(data);
    // TODO: take en-IN from a env variable
    data.set(HEADERS[0], datetime.toLocaleDateString('en-IN'));

    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY,
    });

    await doc.loadInfo(); // loads document properties and worksheets
    const sheet = doc.sheetsByIndex[process.env.GOOGLE_SHEET_INDEX];
    log("Google Sheet Title: ", sheet.title);
    log("Google Sheet Rows: ", sheet.rowCount);

    if(sheet.rowCount == 1) { // assuming new sheet is created
        log("Adding headers")
        await sheet.setHeaderRow(HEADERS)
        log("Adding data to first row")
        await sheet.addRow(Object.fromEntries(data));
    } else {
        let row = (await sheet.getRows({offset: sheet.rowCount - 2, limit: 1}))[0];
        if(row.Date == data.get('Date')){
            log("Found existing row: ", row, " Updating it")
            for(let i=1; i< HEADERS.length; i++){
                row[HEADERS[i]] = data.get(HEADERS[i])
            }
            log("Row after update: ", row)
            await row.save();
        } else {
            log("Adding new row..")
            await sheet.addRow(Object.fromEntries(data));
        }
    }
}

module.exports = {
    addToGoogleSheet: addToGoogleSheet
}