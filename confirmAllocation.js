#! /usr/bin/env node

var Web3 = require('web3');
var Promise = require("bluebird");
const util = require('ethereumjs-util');
var config = require('./config.json');
var XLSX = require('xlsx');
var async = require('async');
var web3;

if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider(config.web3HTTPProvider));
}

if (web3.isConnected()) {
    console.log("Web3 connected");
} else {
    console.log("Web3 is not connected")
}

var tokenABI = require('./tokenABI');
var tokenAddress = config.tokenAddress;
var tokenInstance = web3.eth.contract(tokenABI).at(tokenAddress);
var fromAddress = config.fromAddress;
var inputFilePath = config.inputChrono;

/*
 Read data from the given workbook
 convert it into json
 result[] will store the transaction status, use this to write the final output
 */
var workbook = XLSX.readFile(inputFilePath);
var sheet_name_list = workbook.SheetNames;
const dJ = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[13]]);
var promise = null;


async.forEachOf(dJ, function(result, i, callback) {
    checkBalance(result, i);
    callback();
}, function(err, reslt) {});

function checkBalance(dataJSON, i) {
    
    var accountAddress = dataJSON.account;
    var balance = dataJSON.dayTokens;
    var timeMintId = dataJSON.timeMintId;


    return Promise.all([
        getAccountBalance(tokenInstance, accountAddress)
    ]).then(function(currentTokenBalance) {

        if(currentTokenBalance == tokenInSmallestUnit(balance,18)){
            console.log("Transaction at id "+timeMintId+" is OK");
        }
        else{
            console.log("Transaction at id "+timeMintId+" and address "+accountAddress+" is NOT OK");
        }

    }, function(error) {

        console.log("Transaction at id "+timeMintId+" and address "+accountAddress+" is NOT OK");
        return Promise.reject(error);

    });
}


/*
getAccountBalance() - fetches the balances of the mentioned accounts from the network.
these balances are compared to check wether or not the transaction happened.
Balance in the fromAccount will be reduced after each transaction, and the
balance of toAccount will increase.
*/
function getAccountBalance(tokenInstance, accountAddress) {
    return new Promise(function(resolve, reject) {
        tokenInstance.balanceOf(accountAddress, function(error, result) {
            if (error) {
            } else {
                resolve(result);
            }
        });
    })
}

function etherInWei(x) {
    return web3.toBigNumber(web3.toWei(x, 'ether')).toNumber();
}


function tokenPriceInWeiFromTokensPerEther(x) {
    if (x == 0) return 0;
    return Math.floor(web3.toWei(1, 'ether') / x);
}

function tokenInSmallestUnit(tokens, _tokenDecimals) {
    return Math.floor(tokens * Math.pow(10, _tokenDecimals));
}