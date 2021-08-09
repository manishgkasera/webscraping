const dotenv = require('dotenv')
dotenv.config()
const {arrayToMap, log} = require("../util");
const {HEADERS, dataCurrencyToNumber, numberToA1Index, getSheetsService} = require("./sheet_util");

let firstDataRowIndex = 3; // added spark lines awesomeness in second row, so data starts from 3rd now
let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
let spreadSheetInfo;
let sheetInfo;
let sheetsService = getSheetsService();

async function getSpreadSheetInfo() {
    let res = await sheetsService.spreadsheets.get({spreadsheetId: spreadsheetId});
    return res.data;
}

async function readRange(range) {
    let response = await sheetsService.spreadsheets.values.get({spreadsheetId: spreadsheetId, range: `${sheetInfo.title}!${range}`});
    return response.data.values;
}

async function getLastUpdatedDate(firstDataRowIndex) {
    let rangeValues = await readRange(`A${firstDataRowIndex}:A${firstDataRowIndex}`);
    let lastUpdatedDate = rangeValues && rangeValues[0][0];
    log("Sheets: last updated on => ", lastUpdatedDate)
    return lastUpdatedDate;
}

async function getHeadersFromSheet() {
    return await readRange('A1:A' + HEADERS.length);
}

async function updateRow(index, data) {
    return await sheetsService.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetInfo.title}!A${index}:${numberToA1Index(data.length)}${index}`,
        valueInputOption: "USER_ENTERED",
        resource: {values: [data]}
    })
}

async function insertRow(index, data) {
    let inheritFromBefore = index !== 0;
    // insert empty row at given index
    await sheetsService.spreadsheets.batchUpdate({spreadsheetId: spreadsheetId, resource: {
            requests: [{
                insertDimension: {
                    range: {
                        sheetId: sheetInfo.sheetId,
                        dimension: "ROWS",
                        startIndex: index - 1, //internal index starts with zero
                        endIndex: index
                    },
                    inheritFromBefore: inheritFromBefore
                }
            }]
        }
    });
    if(data.length > 0) {
        await updateRow(index, data);
    }
}

async function addHeaders() {
    let headers = await getHeadersFromSheet();
    if(!headers) {
        log("Sheets: Adding headers..")
        await insertRow(1, HEADERS);
    }
}

async function addData(data) {
    let lastUpdatedDate = await getLastUpdatedDate(firstDataRowIndex);
    if(lastUpdatedDate && lastUpdatedDate === data[0]) {
        log("in update block...");
        await updateRow(firstDataRowIndex, data);
    } else {
        log("in insert block...")
        await insertRow(firstDataRowIndex, data);
    }
}

function prepareData(datetime, numbers) {
    let data = arrayToMap(numbers);
    data = dataCurrencyToNumber(data);
    // TODO: take en-IN from a env variable
    data.set(HEADERS[0], datetime.toLocaleDateString('en-IN'));
    data.set(HEADERS[6], `=MINUS(B${firstDataRowIndex},B${firstDataRowIndex+1})`); // add Investment formulae, B should be cost value column
    data.set(HEADERS[7], `=MINUS(D${firstDataRowIndex},D${firstDataRowIndex+1})`); // add Day change formulae, D should be appreciation column
    let orderedDataArray = []
    for(let header of HEADERS) {
        orderedDataArray.push(data.get(header))
    }
    return orderedDataArray;
}

async function addToGoogleSheet(datetime, numbers) {
    spreadSheetInfo = await getSpreadSheetInfo();
    sheetInfo = spreadSheetInfo.sheets[process.env.GOOGLE_SHEET_INDEX].properties;

    let orderedDataArray = prepareData(datetime, numbers);
    await addHeaders();
    await addData(orderedDataArray);
}

module.exports = {
    addToGoogleSheet: addToGoogleSheet
}