import fs from 'fs';

import {APIClient} from "@greymass/eosio";

const nodeosEndpoint = 'https://testnet.telos.net'

const antelopeCore = new APIClient({"url": nodeosEndpoint, fetch});

const blockObj = await antelopeCore.v1.chain.get_block(parseInt(process.argv[2], 10))

let count = 0;
let cpuUsage = 0;
for (let t of blockObj.transactions) {
  const len = t.trx.transaction.actions.length;
  console.log(`${len} transactions took ${t.cpu_usage_us}us`)
  count += len
  cpuUsage += parseInt(t.cpu_usage_us, 10)
}
console.log(`Found: ${count} actions that took ${cpuUsage}us`)
