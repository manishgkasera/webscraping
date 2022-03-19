const dotenv = require('dotenv')
dotenv.config()
const {arrayToMap, log} = require("../util");
const {HEADERS, dataCurrencyToNumber, numberToA1Index, getSheetsService} = require("./sheet_util");

let firstDataRowIndex = 3; // added spark lines awesomeness in second row, so data starts from 3rd now
let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
let spreadSheetInfo;
let sheetsService = getSheetsService();

async function getSpreadSheetInfo() {
    let res = await sheetsService.spreadsheets.get({spreadsheetId: spreadsheetId});
    return res.data;
}

async function readRange(sheetInfo, range) {
    let response = await sheetsService.spreadsheets.values.get({spreadsheetId: spreadsheetId, range: `${sheetInfo.title}!${range}`});
    return response.data.values;
}

async function getHeadersFromSheet(sheetInfo, length) {
    return await readRange(sheetInfo, 'A1:A' + length);
}

async function updateRow(sheetInfo, index, data) {
    return await sheetsService.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetInfo.title}!A${index}:${numberToA1Index(data.length)}${index}`,
        valueInputOption: "USER_ENTERED",
        resource: {values: [data]}
    })
}

async function insertRow(sheetInfo, index, data, pk) {
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
            },{
                createDeveloperMetadata : {
                    developerMetadata: {
                        location: {
                            dimensionRange: {
                                sheetId: sheetInfo.sheetId,
                                startIndex: index - 1,
                                endIndex: index,
                                dimension: "ROWS"
                            }
                        },
                        metadataKey: 'pk',
                        metadataValue: pk,
                        visibility: "DOCUMENT"
                    },
                }
            }]
        }
    });

    if(data.length > 0) {
        await updateRow(sheetInfo, index, data);
    }
}

async function addHeaders(sheetInfo, headers) {
    let headersSheet = await getHeadersFromSheet(sheetInfo, headers.length);
    if(!headersSheet) {
        log("Sheets: Adding headers..")
        await insertRow(sheetInfo, 1, headers);
    }
}

async function searchForPrimaryKey(sheetInfo, pk) {
    return await sheetsService.spreadsheets.developerMetadata.search({
        spreadsheetId,
        requestBody: {
            dataFilters: [
                {
                    developerMetadataLookup: {
                        locationType: 'ROW',
                        metadataKey: 'pk',
                        metadataValue: pk
                    }
                }
            ]
        }
    });
}

async function addData(sheetInfo, data, pk) {
    let searchResult = await searchForPrimaryKey(sheetInfo, pk);
    if (searchResult.data.matchedDeveloperMetadata) {
        log("in update block...");
        await updateRow(sheetInfo, searchResult.data.matchedDeveloperMetadata[0].developerMetadata.location.dimensionRange.endIndex, data);
    } else {
        log("in insert block...")
        await insertRow(sheetInfo, firstDataRowIndex, data, pk);
    }
}

function prepareAggregateData(datetime, numbers) {
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

async function addToGoogleSheet(datetime, data) {
    spreadSheetInfo = await getSpreadSheetInfo();
    let aggregateSheetInfo = spreadSheetInfo.sheets[process.env.AGGREGATE_GOOGLE_SHEET_INDEX].properties;
    let headers = HEADERS;

    let orderedDataArray = prepareAggregateData(datetime, data.aggregateData);
    await addHeaders(aggregateSheetInfo, headers);
    await addData(aggregateSheetInfo, orderedDataArray, orderedDataArray[0]);

    //add granular mf data
    log("Updating mf data..");
    let mfSheetInfo = spreadSheetInfo.sheets[process.env.MF_GOOGLE_SHEET_INDEX].properties;

    let header = data.mfData.header;
    await header.shift();
    header.unshift("Date", "Folio", "Scheme Code / Name", "Unit Balance");
    header.pop(); // remove transact column
    await addHeaders(mfSheetInfo, data.mfData.header);

    for (const mfData of data.mfData.data) {
        let first = mfData.shift().split("\n"); //8552603\n123D / Kotak Emerging Equity Fund Dir-Gr\n\n[Unit Balance 71.786]
        let unitBalance = first[3].replace(/[^\d.-]/g,'');
        let fundName = first[1];
        let folio = first[0];
        mfData.unshift(datetime.toLocaleDateString('en-IN'), folio, fundName, unitBalance);
        mfData.pop(); // remove transact column

        let pk = mfData[0] + "-" + folio + "-" + fundName;
        log("Adding mf data for.. " + pk)
        await addData(mfSheetInfo, mfData, pk);
    }
    log("Done updating spreadsheet..");
}

module.exports = {
    addToGoogleSheet: addToGoogleSheet
}