import {isMainThread, parentPort, Worker, workerData} from "node:worker_threads";
import eosjs from "eosjs";
import {JsSignatureProvider} from "./node_modules/eosjs/dist/eosjs-jssig.js";
import fetch from "node-fetch";
import fs from "fs";
import util from "util";

//const Api = eosjs.Api;
const JsonRpc = eosjs.JsonRpc;
let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);

const endpoints = config.ENDPOINTS;
let nodeUrl = config.ENDPOINT;

if (endpoints && endpoints.length) {
    nodeUrl = endpoints[(workerData.workerId - 1) % endpoints.length]
}


//const signatureProvider = new JsSignatureProvider([config.PRIV_KEY_TO_SIGN_TX]);
const rpc = new JsonRpc(nodeUrl, {fetch});

/*
const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new util.TextDecoder(),
    textEncoder: new util.TextEncoder()
});
 */

const blastResult = await rpc.push_transactions(workerData.transactions);
console.log(`Worker #${workerData.workerId}`);
blastResult.forEach(trx => console.log(trx.transaction_id))
blastResult.forEach(trx => {
    if (trx.transaction_id === '0000000000000000000000000000000000000000000000000000000000000000')
        console.log(trx.processed.error)
})