import eosjs from "eosjs";
import {isMainThread, parentPort, Worker, workerData} from "node:worker_threads";
import {JsSignatureProvider} from "./node_modules/eosjs/dist/eosjs-jssig.js";
import fetch from "node-fetch";
import util from "util";
import ethers from "ethers";
import { BigNumber} from "@ethersproject/bignumber";
import {TelosEvmApi} from "@telosnetwork/telosevm-js";
import ethUtil from "ethereumjs-util";
import ethTrx from "@ethereumjs/tx";
import EthJSCommon from "@ethereumjs/common";
import {
    APIClient,
    FetchProvider,
} from '@greymass/eosio';

const apiClient = new APIClient({provider: new FetchProvider(config.ENDPOINT)})

const pancakeSwapRouterAddress = '0x67a5d237530c9e09a7b3fdf52071179f4621bb3d';
const benchAddress = '0xAFe48Cba47D3ffB3e988b7F329388495Cf2Fbcc8';
const WTLOSAddress = '0x5bf0E1Fa3B7988660E8d22860743BB289196f0ac';
const pairAddress = '0xfB7b8DC300661dD6b787cde08AF9CF4b1Db825B7';

const Common = EthJSCommon.default;
const Transaction = ethTrx.Transaction;

import fs from "fs";

let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

 // node only; not needed in browsers
import readline from "readline";

const router = new ethers.Contract(
    pancakeSwapRouterAddress,
    [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function WETH() external pure returns (address)'
    ],
    new ethers.providers.JsonRpcProvider(`${config.ENDPOINT}/evm`)
);

const wTlos = new ethers.Contract(
    WTLOSAddress,
    [
        'function approve(address guy, uint256 amount) public returns (bool)',
        'function deposit() public payable',
    ],
    new ethers.providers.JsonRpcProvider(`${config.ENDPOINT}/evm`)
);


const Api = eosjs.Api;
const JsonRpc = eosjs.JsonRpc;

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
    console.log("Getting gas price...");
    const gasPrice = '0x' + await telosApi.telos.getGasPrice()
    console.log("Got gas price");
    const trxPromises = [];
    let addressCount = 0;
    let addressTotal = config.EVM_SENDER_PKS.length;
    const batchSize = config.EVM_BATCH_SIZE;
    const chunkSize = config.EVM_PUSH_TRX_SIZE;
    const swapSize = config.SWAP_SIZE;
    let totalTrx = addressTotal * batchSize;
    let gasLimit = 31000;

    for (const key of config.EVM_SENDER_PKS) {
        const privateKeyBuffer = Buffer.from(key.startsWith('0x') ? key.substring(2) : key, 'hex')
        const ethAddress = "0x" + ethUtil.privateToAddress(privateKeyBuffer).toString('hex')
        const amountToSendEther = ethers.utils.formatEther(
            BigNumber.from(gasPrice).mul(21000)
                .add(1).mul(batchSize)
                .add(BigNumber.from(swapSize).mul(batchSize))
                .add(BigNumber.from(gasPrice).mul(100000))
        );

        const wTlosApprovalData = wTlos.interface.encodeFunctionData('approve', [
            pancakeSwapRouterAddress, ethers.constants.MaxUint256
        ]);


        // add 1 for good measure ;)
        const amountToSend = (parseFloat(amountToSendEther, 10) + 1).toFixed(4)
        const amountToWrap = BigNumber.from(swapSize).mul(batchSize).toHexString()

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
            await sleep(1000);
        } catch (e) {
            if (!e.message.includes("this address already exists"))
                console.log(`Error calling openwallet: ${e.message}`)
        } finally {
            let nonce = await telosApi.telos.getNonce(ethAddress)
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
            },{
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
                    tx: makeTrx(privateKeyBuffer, nonce++, gasPrice, gasLimit, amountToWrap, WTLOSAddress, ''),
                    estimate_gas: false,
                    sender: ethAddress.substring(2)
                }
            },{
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
                    tx: makeTrx(privateKeyBuffer, nonce++, gasPrice, gasLimit, 0, WTLOSAddress, wTlosApprovalData),
                    estimate_gas: false,
                    sender: ethAddress.substring(2)
                }
            })
        }
        process.stdout.write(`Loaded ${++addressCount * batchSize}/${totalTrx} transactions.  This is ${batchSize} EVM transactions for each of the ${addressTotal} addresses.\r`);
        trxPromises.push(getBatchTrx(ethAddress, privateKeyBuffer, gasPrice, batchSize));
    }
    console.log(`\nWaiting for all transactions to be generated...`);
    const blastTransactions = await Promise.all(trxPromises);
    console.log(`All transactions generated!!!`)
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});

    rl.question(    `💣 🚀 🔫 There will be ${Math.ceil(addressTotal / chunkSize)} workers launched\n` +
                           `💣 🚀 🔫 There are ${addressTotal} eosio transactions (with ${batchSize} EVM transactions in each)\n` +
                           `💣 🚀 🔫 Each worker will send a chunk of ${chunkSize} eosio transactions\n` +
                           '💣 🚀 🔫 Fire zee cannon?\n' +
                           '💣 🚀 🔫 Type y and press enter when ready: ', async ans => {
        if (ans == 'y') {
            console.log('Bombs away!!!!!')

            let batches = [];
            for (let i = 0; i < blastTransactions.length; i += chunkSize) {
                batches.push(blastTransactions.slice(i, i + chunkSize));
            }

            batches.forEach((currentBatch, idx) => {
                let workerId = idx + 1;
                console.log(`Launching push_transactions worker #${workerId}`);
                const worker = new Worker('./cannonWorker.js', {
                    workerData: {transactions: currentBatch, workerId}
                });
            });

            //blastResult.forEach(trx => console.log(trx.transaction_id))
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

    let gasLimit = 21000;
    let functionData = '';
    let to = ethAddress;
    let value = 1;
    if (config.SWAP) {
        value = 100000;
        value = 100000;
        to = pancakeSwapRouterAddress;
        //functionData = router.interface.encodeFunctionData('swapExactETHForTokens', [
        functionData = router.interface.encodeFunctionData('swapExactTokensForTokens', [
            config.SWAP_SIZE,
            0,
            [WTLOSAddress,benchAddress],
            ethAddress,
            Date.now() + 1000 * 60 * 10
        ])
        gasLimit = 700000;
    }

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
                tx: makeTrx(privateKeyBuffer, nonce++, gasPrice, gasLimit, value, to, functionData),
                estimate_gas: false,
                sender: ethAddress.substring(2)
            }
        })
    return await makeBatchTrx(actions)
}

async function makeBatchTrx(actions) {
    const expireDate = new Date(Date.now() + (55 * 60 * 1000));
    const result = await api.transact(
        { actions: actions },
        {
            broadcast: false, expireSeconds: 60 * 55, useLastIrreversible: true
        });
    return result;
}

function makeTrx(privateKeyBuffer, nonce, gasPrice, gasLimit, value, to, data) {
    const txData = {
        nonce,
        gasPrice,
        gasLimit,
        value,
        to,
        data
    }

    let tx = new Transaction(txData, { "common": chainConfig })
    return tx.sign(privateKeyBuffer).serialize().toString('hex');
}
