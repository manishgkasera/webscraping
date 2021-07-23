
export function log(...message) {
    console.log(new Date(), " => ", ...message)
}