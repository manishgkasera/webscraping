const dotenv = require('dotenv')
dotenv.config()
const { GoogleSpreadsheet } = require('google-spreadsheet');
const util = require("./util.js");
const log = util.log;
const arrayToJson = util.arrayToJson;

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
const HEADERS = ['Date', 'Total Cost Value', 'Total Market Value', 'Appreciation', 'Wtd. Avg Age days', 'Wtd.Avg Annualized return*'];

async function addToGoogleSheet(datetime, numbers){

    let data = arrayToJson(numbers);
    data[HEADERS[0]] = datetime.toLocaleDateString();

    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY,
    });

    await doc.loadInfo(); // loads document properties and worksheets
    const sheet = doc.sheetsByIndex[2];
    log("Google Sheet Title: ", sheet.title);
    log("Google Sheet Rows: ", sheet.rowCount);

    if(sheet.rowCount == 1) { // assuming new sheet is created
        log("Adding headers")
        await sheet.setHeaderRow(HEADERS)
        log("Adding data to first row")
        await sheet.addRow(data);
    } else {
        let row = (await sheet.getRows({offset: sheet.rowCount - 2, limit: 1}))[0];
        if(row.Date == data.Date){
            log("Found existing row: ", row, " Updating it")
            for(let i=1; i< HEADERS.length; i++)
                row[HEADERS[i]] = data[HEADERS[i]]
            log("Row after update: ", row)
            await row.save();
        } else {
            log("Adding new row..")
            await sheet.addRow(data);
        }
    }
}

module.exports = {
    addToGoogleSheet: addToGoogleSheet
}