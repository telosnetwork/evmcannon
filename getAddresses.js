const fs = require('fs');

let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);

const { ethers } = require("ethers");

config.EVM_SENDER_PKS.forEach(key => {
    let wallet = new ethers.Wallet(key);
    console.log(wallet.address);
})
