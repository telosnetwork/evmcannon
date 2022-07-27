import eosjs from "eosjs";
import {JsSignatureProvider} from "./node_modules/eosjs/dist/eosjs-jssig.js";
import fetch from "node-fetch";
import util from "util";
import ethers from "ethers";
import { BigNumber} from "@ethersproject/bignumber";
import {TelosEvmApi} from "@telosnetwork/telosevm-js";
import ethUtil from "ethereumjs-util";
import ethTrx from "@ethereumjs/tx";
import EthJSCommon from "@ethereumjs/common";

const Common = EthJSCommon.default;
const Transaction = ethTrx.Transaction;

import fs from "fs";

 // node only; not needed in browsers
import readline from "readline";

const Api = eosjs.Api;
const JsonRpc = eosjs.JsonRpc;
let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);

const chainId = config.EVM_CHAIN_ID;
const chainConfig = Common.forCustomChain('mainnet', { chainId }, 'istanbul')

const actionsPerTrx = config.EVM_BATCH_SIZE;
//const nodeUrl = 'https://testnet.telos.net';
const nodeUrl = config.ENDPOINT;



const telosApi = new TelosEvmApi({
    // Ensure the API has console printing enabled
    endpoint: nodeUrl,

    // Must match the chain ID the contract is compiled with (1 by default)
    chainId,

    ethPrivateKeys: [
    ],

    telosContract: 'eosio.evm',
    fetch,
    telosPrivateKeys: [
        config.PRIV_KEY_TO_SIGN_TX
    ],
});

const signatureProvider = new JsSignatureProvider([config.PRIV_KEY_TO_SIGN_TX]);
const rpc = new JsonRpc(nodeUrl, { fetch });

const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new util.TextDecoder(),
    textEncoder: new util.TextEncoder()
});


(async () => {
    const gasPrice = '0x' + await telosApi.telos.getGasPrice()
    const trxPromises = [];
    for (const key of config.EVM_SENDER_PKS) {
        const privateKeyBuffer = Buffer.from(key.startsWith('0x') ? key.substring(2) : key, 'hex')
        const ethAddress = "0x" + ethUtil.privateToAddress(privateKeyBuffer).toString('hex')
        const batchSize = config.EVM_BATCH_SIZE;

        const amountToSendEther = ethers.utils.formatEther(BigNumber.from(gasPrice).mul(21000).add(1).mul(batchSize).add(100));

        // add 1 for good measure ;)
        const amountToSend = (parseFloat(amountToSendEther, 10) + 1).toFixed(4)

        try {
            await sendAction({
                account: 'eosio.evm',
                name: "openwallet",
                authorization: [
                    {
                        actor: config.TRANSFER_FROM,
                        permission: "active"
                    }
                ],
                data: {
                    account: config.TRANSFER_FROM,
                    address: ethAddress.substring(2)
                }
            })
        } catch (e) {
            console.log("Address exists");
        } finally {
            await sendAction({
                account: 'eosio.token',
                name: "transfer",
                authorization: [
                    {
                        actor: config.TRANSFER_FROM,
                        permission: "active"
                    }
                ],
                data: {
                    from: config.TRANSFER_FROM,
                    to: 'eosio.evm',
                    quantity: `${amountToSend} TLOS`,
                    memo: `${ethAddress}`
                }
            })
        }
        trxPromises.push(getBatchTrx(ethAddress, privateKeyBuffer, gasPrice, batchSize));
    }
    const blastTransactions = await Promise.all(trxPromises);
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});

    rl.question(    '💣 🚀 🔫 Fire zee cannon?\n' +
                           '💣 🚀 🔫 Type y and press enter when ready: ', async ans => {
        if (ans == 'y') {
            console.log('Bombs away!!!!!')
            const blastResult = await api.rpc.push_transactions(blastTransactions);
            console.log('Results:');
            blastResult.forEach(trx => console.log(trx.transaction_id))
        } else {
            console.log('Cannon disarmed, ya chicken!');
        }
        rl.close();
    });
})()


async function sendAction(action) {
    const result = await api.transact(
        { actions: [action] },
        {
            blocksBehind: 3, expireSeconds: 60 * 55
    });
}

async function getBatchTrx(ethAddress, privateKeyBuffer, gasPrice, count) {
    let actions = []

    let nonce = await telosApi.telos.getNonce(ethAddress)
    for (let i = 0; i < count; i++)
        actions.push({
            account: 'eosio.evm',
            name: "raw",
            authorization: [
                {
                    actor: config.TRANSFER_FROM,
                    permission: "active"
                }
            ],
            data: {
                ram_payer: 'eosio.evm',
                tx: await makeTrx(privateKeyBuffer, nonce++, gasPrice, 21000, 1, ethAddress, ''),
                estimate_gas: false,
                sender: ethAddress.substring(2)
            }
        })
    return await makeBatchTrx(actions)
}

async function makeBatchTrx(actions) {
    console.log(`Batching ${actions.length} actions`)
    const expireDate = new Date(Date.now() + (55 * 60 * 1000));
    const result = await api.transact(
        { actions: actions },
        {
            broadcast: false, expireSeconds: 60 * 55, useLastIrreversible: true
        });
    return result;
}

async function makeTrx(privateKeyBuffer, nonce, gasPrice, gasLimit, value, to, data) {
    const txData = {
        nonce,
        gasPrice,
        gasLimit,
        value,
        to,
        data
    }

    let tx = new Transaction(txData, { "common": chainConfig })
    return tx.sign(privateKeyBuffer).serialize().toString('hex')
}
