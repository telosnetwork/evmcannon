import fs from 'fs';

const blockStr = fs.readFileSync('./block.json')
const blockObj = JSON.parse(blockStr)

let count = 0;
let cpuUsage = 0;
for (let t of blockObj.transactions) {
  const len = t.trx.transaction.actions.length;
  console.log(`${len} transactions took ${t.cpu_usage_us}us`)
  count += len
  cpuUsage += t.cpu_usage_us
}
console.log(`Found: ${count} actions that took ${cpuUsage}us`)
