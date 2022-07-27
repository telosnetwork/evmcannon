import {ethers} from "ethers";

let count = parseInt(process.argv[2], 10);

let keys = [];
for (let i = 0; i < count; i++) {
    let wallet = ethers.Wallet.createRandom();
    keys.push(wallet.privateKey);
}

console.log(JSON.stringify(keys));