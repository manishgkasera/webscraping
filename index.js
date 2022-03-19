const dotenv = require('dotenv')
const fs = require('fs')
const os = require('os')
const puppeteer = require('puppeteer')
const {addToGoogleSheet} = require("./google_sheet/google_sheets");
const UserAgent = require("user-agents");
const  sendToTelegram = require('./notification.js').sendToTelegram
const log = require('./util.js').log

dotenv.config()

function takeScreenShot(page, name) {
    return page.screenshot({path: `screenshot-${Date.now()}-${name}-${new Date()}.png`, fullPage: true})
}

function getBrowser() {
    let userAgent = new UserAgent({deviceCategory: 'desktop'}).toString();
    let slowMo = Math.floor(Math.random()*100) + 100;
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--user-agent="' + userAgent + '"'
    ];

    // return puppeteer.launch({args: args, slowMo: slowMo, headless: false, defaultViewport: null});
    return puppeteer.launch({args: args, slowMo: slowMo});
}

async function getCamsData(retryCount, page) {
    // return {
    //     aggregateData:["₹17,48,808.88","Total Cost Value","₹23,57,944.17","Total Market Value","₹6,09,135.29","Appreciation","707","Wtd. Avg Age days","16.80%","Wtd.Avg Annualized return*"],
    //     mfData:{
    //         data: [
    //             ["16955531\nD103G / SBI Blue Chip Fund Dir Plan-G\n\n[Unit Balance 6023.648]","248,487.73","388,493.37","140,005.64","1046","16.65%","      "],
    //             ["16955531\nD040A / SBI Magnum Gilt Fund Direct Growth (formerly SBI Magnum Gilt Fund - Long Term)\n\n[Unit Balance 4908.984]","231,253.65","266,701.17","35,447.52","743","7.67%","      "],
    //             ["16955531\nD038 / SBI Magnum Constant Maturity F D G (formerly SBI Magnum Gilt Fund - Short Term)\n\n[Unit Balance 2412.221]","115,710.22","126,029.62","10,319.40","668","5.00%","      "],
    //             ["1018880674\n292GZ / ABSL Focused Equity Fund - Growth-DIRECT\n\n[Unit Balance 4789.436]","326,696.89","468,141.51","141,444.62","902","16.13%","      "],
    //             ["11742512\nPREGT / HDFC Hybrid Equity Fund-Dir-Growth (formerly HDFC Premier Multi-Cap Fund, erstwhile HDFC Balanced Fund merged)\n\n[Unit Balance 3910.884]","216,570.94","326,801.29","110,230.35","983","16.17%","      "],
    //             ["5783619\n785 / N R N E Fund - Dir - G\n\n[Unit Balance 4623.118]","170,000.00","277,502.66","107,502.66","586","37.88%","      "],
    //             ["8549204\n124D / Kotak India EQ Contra Fund-Dir Plan-Gr\n\n[Unit Balance 1052.697]","95,000.00","96,529.16","1,529.16","69","8.87%","      "],
    //             ["8549204\n104D / Kotak Small Cap- Direct Plan-Gr\n\n[Unit Balance 338.035]","60,000.00","60,652.94","652.94","107","3.85%","      "],
    //             ["8549204\n123D / Kotak Emerging Equity Fund Dir-Gr\n\n[Unit Balance 575.621]","45,000.00","45,193.73","193.73","139","1.15%","      "],
    //             ["8552603\n123D / Kotak Emerging Equity Fund Dir-Gr\n\n[Unit Balance 71.786]","5,000.00","5,636.13","636.13","286","16.58%","      "],
    //             ["9527380\n8176 / Value Discovery Fund - DP Growth\n\n[Unit Balance 650.076]","120,089.45","176,723.16","56,633.71","751","21.09%","      "],
    //             ["1000291329\nMBYDG / Mahindra Manulife MultiCap BY Dir-G\n\n[Unit Balance 5383.107]","115,000.00","119,539.43","4,539.43","86","18.12%","      "]
    //         ],
    //         header:["Folio\nScheme Code / Name","Cost Value (₹)","Market Value (₹)","Appreciation (₹)","Wtd. Avg Age days","Annualised XIRR","Transact"]
    //     }
    // };

    let aggregateData = null;
    if(retryCount >= 5) {
        log(`retried ${retryCount} times stopping now..`)
        return;
    }

    await page.goto('https://mycams.camsonline.com', {
        waitUntil: "networkidle2"
    });
    await page.$eval("#UserId", (el, username) => {el.value =  username}, process.env.USERNAME)
    aggregateData = await page.click("#btnNxt a").then(async function (){
        log("inside first btn click");
        await page.$eval("#PassWord", (el, pwd) => {el.value = pwd}, process.env.PASSWORD);
        log("pwd done");
        const checkbox = await page.$("input#chkagree");
        await checkbox.evaluate(c => c.click());
        log("agree done")

        // attempting to input password second time
        // it was not getting populated oin dev dsk but was working fine on mac
        // I dont know why, need more investigation
        await page.$eval("#PassWord", (el, pwd) => {el.value = pwd}, process.env.PASSWORD);
        log("pwd 2 done")

        await (await page.$("#btnDIv")).evaluate(b => b.click());
        log("btn done")
        await page.waitForNavigation();

        await (await page.$("#Question_0")).evaluate((b, answer) => {b.value = answer}, process.env.SECRETANSWER);
        await (await page.$("div[ng-click='btnTwoQues();']")).evaluate(b => b.click());
        log("final login click done");
        await page.waitForNavigation({waitUntil: "networkidle0"})

        // if the session was already active
        const sessionErrorH3 = await page.$("div[ng-model='divsession'] h3");
        const active = sessionErrorH3 && await sessionErrorH3.evaluate(h3 => h3.innerHTML.includes("previous user Id session is still activ"));
        if(active){
            log("session active logging out..")
            await (await page.$('a#lnkLogOut')).evaluate(logout => logout.click());
            return getCamsData(retryCount+1, page)
        }

        let div = await page.waitForSelector('#MutualFundDetails .row.mr-30')
        aggregateData = await div.evaluate(div => div.innerText.split("\n"));
        return aggregateData;
    });
    if(!aggregateData){
        log("aggregateData is null..");
        await takeScreenShot(page, "mycams-error-aggregateData-null");
        return aggregateData;
    }

    async function getMFData(page) {
        let result = {data: []};
        let mfCompanies = await page.$$("table#tblAMCDetails > tbody > tr.active");
        log("mfCompanies : " + mfCompanies);
        for (let mfCompany of mfCompanies) {

            await mfCompany.click();
            try {
                await page.waitForSelector('#trSchemeDetails tr.active');
            } catch (e) {
                log("Error in getting mf data, trying one more time.. => " + JSON.stringify(e));
                await mfCompany.click();
                await mfCompany.click();
                await page.waitForSelector('#trSchemeDetails tr.active');
            }

            result.header = await page.$$eval('#trSchemeDetails tr.card2 th.hidden-sm-down', headers => headers.map(header => header.innerText));

            let rows = await page.$$eval('#trSchemeDetails tr.active', rows => {
                return rows.map(row => {
                    const columns = row.querySelectorAll('td');
                    return Array.from(columns, column => column.innerText);
                });
            });
            result.data = result.data.concat(rows);
            // log("rows : " + JSON.stringify(rows));
            // log("result : " + JSON.stringify(result));
        }
        return result;
    }

    let mfData = await getMFData(page);

    // logout
    try {
        await (await page.$("a[ng-click='LogOutSession()']")).evaluate(b => b.click());
        await (await page.$("#divLogout button.close")).evaluate(b => b.click());
        log("logged out and done..");
    } catch (e) {
        log("Continuing inspite of error logging out => ", e);
    }

    return {aggregateData : aggregateData, mfData: mfData};
}

function appendToFile(datetime, numbers) {
    let numbersString = numbers.aggregateData.join(", ") + "\n";
    // numbersString += JSON.stringify(numbers.mfData, null, 2) + "\n";
    fs.appendFileSync(os.homedir() + '/camsdata.txt',  datetime/1000 + ", " + numbersString);
}

(async function doStuff() {
    let browser = await getBrowser();
    let page = await browser.newPage();
    try {
        const camsData = await getCamsData(1, page);
        let datetime = Date.now();
        log("camsData: ", JSON.stringify(camsData));
        appendToFile(datetime, camsData)
        await sendToTelegram(datetime, camsData.aggregateData)
        let d = new Date(datetime)
        // d.setDate(d.getDate() + 24)
        await addToGoogleSheet(d, camsData)
    } catch (e) {
        log(e);
        await takeScreenShot(page, `mycams-error-${e.message}`);
    } finally {
        await browser.close();
    }

})();