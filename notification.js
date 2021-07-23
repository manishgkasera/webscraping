// const http = require('https');
import * as https from "https";
import {log} from './util.js'

// https://xabaras.medium.com/sending-a-message-to-a-telegram-channel-the-easy-way-eb0a0b32968
export function sendToTelegram(datetime, numbers) {
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
    return https.request({host: 'api.telegram.org', path: path}, function (res){
        log('statusCode:', res.statusCode);
        log('headers:', res.headers);

        res.on('data', (d) => {
            process.stdout.write(d);
        });
    }).end();
}