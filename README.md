# timemint-allocator

This script can be used for allocation of Timemints.

## Parameters required :
 1. tokenAddress - The address of the token contract.
 2. fromaddress - The address of the account used to deploy DAY token contract.
 3. tokenDecimal - The decimal units of the token. eg 18
 4. inputChrono - The file path of the sheet with addresses and their timemints. It also has amount of DAY tokens to be allocated and ethers contributed. Data is broken down into sheets so that node is not bombarded with too many transactions at once as they all are executed asynchronously. 
 5. timeOut - Time in seconds to wait for a transaction to confirm before marking it failed.
 6. blockAwaitBeforeConfirmation - Number of blocks that should mine after a transaction is consider confirmed, or in amother language to consider a transaction successfull.
  


# How to execute it?

## Step 1: 
Start parity while unlocking the "fromAccount". This is to ensure that every transaction can be executed without manually entering the password. To start the parity with unlocked sender account Use this command in your terminal:

 <code>parity --force-ui --unlock <account number> --password <path to password file> </code>


## Step 2: 
cd (go to) to the project directory from the terminal.

## Step 3: 
Run "npm install" (this will install all the relevant node packages from package.json)

## Step 4: 
Configure the config.json file with relevant parameters. Basic parameters are set, only modify them if necessary.

## Step 5: 
Use the chrono_main.xlsx file to provide data to the script.
Make sure not to change the sequence or content of it's headings. Fill the data accordingly.


## Step 6: 
Execute the allocateTimemint file.

There are two ways to do it. Either first run "npm link" in the terminal. It will create a symlink, then you can just use

<code>allocateTimemint</code> command to start the script. Or run <code>node allocateTimemint.js</code>

To confirm allocation use <code>node confirmAllocation.js</code> after all timemints in sheet are allocated.