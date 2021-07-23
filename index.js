require('dotenv').config();
const http = require('https');
const fs = require('fs');
const homedir = require('os').homedir();
const puppeteer = require('puppeteer');

function log(...message) {
    console.log(new Date(), " => ", ...message)
}

function getBrowser() {
    // return puppeteer.launch({ headless: false , devtools: true, slowMo: 100, defaultViewport: null});
    return puppeteer.launch();
}

async function getCamsData(retryCount, page) {
    // return  [
    //     '₹12,73,808.88',
    //     'Total Cost Value',
    //     '₹17,29,473.61',
    //     'Total Market Value',
    //     '₹4,55,664.73',
    //     'Appreciation',
    //     '667',
    //     'Wtd. Avg Age days',
    //     '19.65%',
    //     'Wtd.Avg Annualized return*'
    // ];

    let camsData = null;
    if(retryCount >= 5) {
        log("retried " + retryCount + "times stopping now..")
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
        camsData = await (await page.$('#MutualFundDetails .row.mr-30')).evaluate(div => div.innerText.split("\n"));

        // logout
        await (await page.$("a[ng-click='LogOutSession()']")).evaluate(b => b.click());
        log("logged out and done..")
    });
    if(!camsData){
        log("camsData is null..")
        await page.screenshot({path: "maycams_error.png"})
    }

    return camsData;
}

// https://xabaras.medium.com/sending-a-message-to-a-telegram-channel-the-easy-way-eb0a0b32968
function sendToTelegram(datetime, numbers) {
    let message = new Date(datetime).toLocaleString();
    // Numbers:  ₹12,73,808.88, Total Cost Value, ₹17,29,473.61, Total Market Value, ₹4,55,664.73, Appreciation, 666, Wtd. Avg Age days, 19.89%, Wtd.Avg Annualized return*

    for(let i=0; i<numbers.length; i+=2){
        message += "\n" + numbers[i+1] + " => <b>" + numbers[i] + "</b>"
    }

    let path = `/bot${process.env.TELEGRAM_BOT_API_KEY}/sendMessage`

    // path = encodeURI(path)
    let params = new URLSearchParams({
        chat_id: process.env.TELEGRAM_CHAT_ID,  //https://stackoverflow.com/questions/33858927/how-to-obtain-the-chat-id-of-a-private-telegram-channel
        parse_mode: "html",
        text: message
    })
    path = path + "?" + params.toString()
    log("TelegramPath: ", path)
    return http.request({host: 'api.telegram.org', path: path}, function (res){
        log('statusCode:', res.statusCode);
        log('headers:', res.headers);

        res.on('data', (d) => {
            process.stdout.write(d);
        });
    }).end();
}

function appendToFile(datetime, numbers) {
    let numbersString = numbers.join(", ") + "\n";
    fs.appendFileSync(homedir + '/camsdata.txt',  datetime/1000 + ", " + numbersString);
}

(async function doStuff() {
    let browser = await getBrowser();
    const numbers = await getCamsData(1, await browser.newPage());
    await browser.close();

    let datetime = Date.now();
    log("Numbers: ", numbers);
    appendToFile(datetime, numbers)
    await sendToTelegram(datetime, numbers)
})();