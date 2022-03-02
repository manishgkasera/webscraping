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

    // return puppeteer.launch({args: args, slowMo: slowMo, headless: false , devtools: true, defaultViewport: null});
    return puppeteer.launch({args: args, slowMo: slowMo});
}

async function getCamsData(retryCount, page) {
    // return  [
    //     '₹12,83,808.88',
    //     'Total Cost Value',
    //     '₹17,29,473.61',
    //     'Total Market Value',
    //     '₹6,54,664.73',
    //     'Appreciation',
    //     '667',
    //     'Wtd. Avg Age days',
    //     '9.65%',
    //     'Wtd.Avg Annualized return*'
    // ];

    let camsData = null;
    if(retryCount >= 5) {
        log(`retried ${retryCount} times stopping now..`)
        return;
    }

    await page.goto('https://mycams.camsonline.com', {
        waitUntil: "networkidle2"
    });
    await page.$eval("#UserId", (el, username) => {el.value =  username}, process.env.USERNAME)
    await page.click("#btnNxt a").then(async function (){
        log("inside first btn click");
        await page.$eval("#PassWord", (el, pwd) => {el.value = pwd}, process.env.PASSWORD);
        log("pwd done");
        const checkbox = await page.$("input#chkagree");
        await checkbox.evaluate(c => c.click());
        log("agree done")
        await (await page.$("#btnDIv")).evaluate(b => b.click());
        log("btn done")
        await page.waitForNavigation();

        // if the session was already active
        const sessionErrorH3 = await page.$("div[ng-model='divsession'] h3");
        const active = sessionErrorH3 && await sessionErrorH3.evaluate(h3 => h3.innerHTML.includes("previous user Id session is still activ"));
        if(active){
            log("session active logging out..")
            await (await page.$('a#lnkLogOut')).evaluate(logout => logout.click());
            return getCamsData(retryCount+1, page)
        }

        await (await page.$("#Question_0")).evaluate((b, answer) => {b.value = answer}, process.env.SECRETANSWER);
        await (await page.$("div[ng-click='btnTwoQues();']")).evaluate(b => b.click());
        log("final login click done");
        await page.waitForNavigation({waitUntil: "networkidle0"})
        await page.waitForSelector('#MutualFundDetails .row.mr-30')
        camsData = await (await page.$('#MutualFundDetails .row.mr-30')).evaluate(div => div.innerText.split("\n"));

        // logout
        await (await page.$("a[ng-click='LogOutSession()']")).evaluate(b => b.click());
        log("logged out and done..")
    });
    if(!camsData){
        log("camsData is null..");
        await takeScreenShot(page, "mycams-error-camsdata-null");
    }

    return camsData;
}

function appendToFile(datetime, numbers) {
    let numbersString = numbers.join(", ") + "\n";
    fs.appendFileSync(os.homedir() + '/camsdata.txt',  datetime/1000 + ", " + numbersString);
}

(async function doStuff() {
    let browser = await getBrowser();
    let page = await browser.newPage();
    try {
        const numbers = await getCamsData(1, page);
        let datetime = Date.now();
        log("Numbers: ", numbers);
        appendToFile(datetime, numbers)
        await sendToTelegram(datetime, numbers)
        await addToGoogleSheet(new Date(datetime), numbers)
    } catch (e) {
        log(e);
        await takeScreenShot(page, `mycams-error-${e.message}`);
    } finally {
        await browser.close();
    }

})();