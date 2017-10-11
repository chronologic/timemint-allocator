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
getAccountBalance() - fetches the balances of the mentioned accounts from the network.
these balances are compared to check wether or not the transaction happened.
Balance in the fromAccount will be reduced after each transaction, and the
balance of toAccount will increase.
*/
function getAccountBalance(tokenInstance, accountAddress) {
    return new Promise(function(resolve, reject) {
        tokenInstance.balanceOf(accountAddress, function(error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    })
}

/*
 Read data from the given workbook
 convert it into json
 result[] will store the transaction status, use this to write the final output
 */
var workbook = XLSX.readFile(inputFilePath);
var sheet_name_list = workbook.SheetNames;
const dJ = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
var result = [];


async.forEachOf(dJ, function(result, i, callback) {
    transact(result, i);
    callback();
}, function(err, reslt) {});



function transact(dataJSON, i) {


    var accountTo = dataJSON.account;
    var amountToTransfer = dataJSON.dayTokens;
    var timeMintId = dataJSON.timeMintId;
    var etherContribution = dataJSON.etherContribution;
    var customerId = 0;
    var txHash, currentToBalance, currentFromBalance, updatedToBalance, updatedFromBalance;

    return Promise.all([
        // getAccountBalance(tokenInstance, fromAddress),
        getAccountBalance(tokenInstance, accountTo)

    ]).then(function(balances) {

        // currentFromBalance = balances[0];
        currentToBalance = balances;

        if(timeMintId >= 1 && timeMintId <= 3227) {
            // allocate pre-ico/ico timemints
            txHash = tokenInstance.allocateNormalTimeMints(accountTo, customerId,timeMintId,tokenInSmallestUnit(amountToTransfer, config.tokenDecimal),tokenInSmallestUnit(etherContribution, config.tokenDecimal), {
                from: fromAddress,
                gas: 1000000,
                value: 0
            });
        }
        else if(timeMintId >= 3228 && timeMintId <= 3242) {
            // allocate team timemints
            txHash = tokenInstance.addTeamTimeMints(accountTo, timeMintId, tokenInSmallestUnit(amountToTransfer, config.tokenDecimal), false, {
                from: fromAddress,
                gas: 1000000,
                value: 0
            });
        
        }
        else if(timeMintId >= 3243 && timeMintId <= 3245) {
            // allocate test timemints
            txHash = tokenInstance.addTeamTimeMints(accountTo, timeMintId, tokenInSmallestUnit(amountToTransfer, config.tokenDecimal), true, {
                from: fromAddress,
                gas: 1000000,
                value: 0
            });
        }


        return awaitBlockConsensus(web3, txHash, config.blockAwaitBeforeConfirmation, config.timeOut);

    }, function(error) {

        console.log('Could not fetch current balances', error);
        return Promise.reject(error);

    }).then(function(result) {

        console.log("Transferring " + amountToTransfer + " to " + accountTo + " TxHash is " + txHash);
        return Promise.all([
            // getAccountBalance(tokenInstance, fromAddress),
            getAccountBalance(tokenInstance, accountTo)
        ]);

    }, function(error) {

        console.log('Could not fetch new balances', error);
        return Promise.reject(error);

    }).then(function(balances) {

        // updatedFromBalance = balances[0];
        updatedToBalance = balances;

        result.push({
            txhash: txHash,
            status: "Confirmed",
            link: "https://ropsten.etherscan.io/tx/" + txHash
        });

        if (i == dJ.length - 1) {
            setTimeout(function() {
                console.log("==================Final data logging into file=================");
                console.log(result);
                console.log("===============================================================");
                exportOutput(result);
            }, 2000);
        }

    }, function(error) {
        //mark the failed status in the records
        result.push({
            txhash: "Not Valid",
            status: "Failed",
            link: "NA"
        });
        console.log("Transaction failed for " + accountTo);

        if (i == dJ.length - 1) {
            setTimeout(function() {
                console.log("==================Final data logging into file=================");
                console.log(result);
                console.log("===============================================================");
                exportOutput(result);
            }, 2000);

        }
    });
}


//
// @method awaitBlockConsensus
// @param web3s is the node you submitted the transaction to,  the other web3s
//    are for cross verification, because you shouldn't trust one node.
// @param txhash is the transaction hash from when you submitted the transaction
// @param blockCount is the number of blocks to wait for.
// @param timout in seconds 
// @param callback - callback(error, transaction_receipt) 
//

function awaitBlockConsensus(web3s, txhash, blockCount, timeout) {
    var txWeb3 = web3s;
    var startBlock = Number.MAX_SAFE_INTEGER;
    var interval;
    var stateEnum = { start: 1, mined: 2, awaited: 3, confirmed: 4, unconfirmed: 5 };
    var savedTxInfo;
    var attempts = 0;

    var pollState = stateEnum.start;

    var resolver, rejecter;
    var promise = new Promise(function(resolve, reject) {
        resolver = resolve;
        rejecter = reject;
    });
    var poll = function() {
        if (pollState === stateEnum.start) {
            txWeb3.eth.getTransaction(txhash, function(e, txInfo) {
                if (e || txInfo == null) {
                    console.log("Returning at", pollState);
                    return; // silently drop errors
                }
                if (txInfo.blockHash != null) {
                    startBlock = txInfo.blockNumber;
                    savedTxInfo = txInfo;
                    console.log("pollState: mined");
                    pollState = stateEnum.mined;
                }
            });
        } else if (pollState == stateEnum.mined) {
            txWeb3.eth.getBlockNumber(function(e, blockNum) {
                if (e) {
                    console.log("Returning at", pollState);
                    return; // silently drop errors
                }
                console.log("blockNum: ", blockNum);
                if (blockNum >= (blockCount + startBlock)) {
                    console.log("pollState: awaited");
                    pollState = stateEnum.awaited;
                }
            });
        } else if (pollState == stateEnum.awaited) {
            txWeb3.eth.getTransactionReceipt(txhash, function(e, receipt) {
                if (e || receipt == null) {
                    console.log("Returning at", pollState);
                    return; // silently drop errors.  TBD callback error?
                }
                // confirm we didn't run out of gas
                // this is where we should be checking a plurality of nodes.  TBD
                clearInterval(interval);
                if (receipt.gasUsed >= savedTxInfo.gas) {
                    pollState = stateEnum.unconfirmed;
                    rejecter(new Error("we ran out of gas, not confirmed!"));
                } else {
                    pollState = stateEnum.confirmed;
                    resolver(receipt);
                }
            });
        } else {
            rejecter(new Error("We should never get here, illegal state: " + pollState));
        }

        // note assuming poll interval is 1 second
        attempts++;
        if (attempts > timeout) {
            clearInterval(interval);
            pollState = stateEnum.unconfirmed;
            rejecter(new Error("Timed out, not confirmed"));
        }
    };

    interval = setInterval(poll, 1000);
    poll();
    return promise;
};

function exportOutput(result) {

    //Create a worksheet with the result
    const ws = XLSX.utils.json_to_sheet(result);
    //Create it's workbook
    const wb = { SheetNames: ['Export'], Sheets: {}, Props: {} };
    wb.Sheets['Export'] = ws;
    // Export the workbook data in file.
    var d1 = new Date();
    XLSX.writeFile(wb, 'transaction-status-report-' + d1.toString('yyyy-MM-dd-HH-m-s') + '.xlsx');
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


exports.awaitBlockConsensus = awaitBlockConsensus;