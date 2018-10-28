const gulp = require('gulp');
const spawn = require('child_process').spawn;
const fs = require('fs');
const path = require('path');
const runSequence = require('run-sequence');
const Web3 = require('web3');
const web3Utils = require('web3-utils');
const watch = require('gulp-watch');

const HOMEBRIDGE_CONTRACT_NAME = 'HomeBridge';
const EXCHANGE_CONTRACT_NAME = 'Exchange';
const DEXCHAIN_CONTRACT_NAME = 'DEXChain';
const DATASTORE_CONTRACT_NAME = 'DataStore';
const ORDERBOOK_CONTRACT_NAME = 'Orderbook';
const FEE_CONTRACT_NAME = 'FeeContract';

const GENERATED_CONFIG_FILE_NAME = 'contracts.g';
const NETWORKS_CONFIG_FILE_NAME = 'network';
const TOKENS_CONFIG_FILE_NAME = 'tokens';

const MAINNET_NETWORK_ID = 1;
const SIDECHAIN_NETWORK_ID = 6454;
const DEVELOPMENT_NETWORK_ID = 5777;

function runCommand (command, args, opts, done) {
    const cmd = spawn(command, args, opts);
    cmd.stderr.pipe(process.stderr);
    cmd.stdout.pipe(process.stdout);
    cmd.on('close', (code, signal) => {
        done(code);
    });
}

function writeJSONFile (outFile, data) {
    fs.writeFileSync(outFile, JSON.stringify(data), (err) => {
        if (err) {
            throw err;
        }
    });
}

function getABIPath (contractName) {
    return path.resolve(__dirname, `_tmp/${contractName}.json`);
}

function getConfigFilePath (configFileName) {
    return path.resolve(__dirname, `configs/${configFileName}.json`);
}

function generateABIWithJSON (abi, pkg, out) {
    return new Promise((resolve, reject) => {
        runCommand('abigen', [
            `--abi=${abi}`,
            `--pkg=${pkg}`,
            `--out=${out}`
        ], {}, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(error);
            }
        })
    });
}

function getAllTopicsFromABI(abi) {
    return abi
    .filter(i => i.type == 'event')
    .map((event) => {
        return {
            [event.name]: web3Utils.keccak256(`${event.name}(${event.inputs.map(p => p.type).join(',')})`)
        }
    })
    .reduce((e1, e2) => Object.assign(e1, e2), {});
}

gulp.task('clean-generated-abi', (done) => {
    runCommand('rm', ['-rf', '_abi'], {}, (status) => {
        if (status != 0) {
            done(status);
        }
        runCommand('mkdir', [
            '-p', 
            `_abi/${HOMEBRIDGE_CONTRACT_NAME}`, 
            `_abi/${DEXCHAIN_CONTRACT_NAME}`,
            `_abi/${ORDERBOOK_CONTRACT_NAME}`
        ], {}, done);
    });
});

gulp.task('clean-tmp-files', (done) => {
    runCommand('rm', ['-rf', '_tmp'], {}, (status) => {
        if (status != 0) {
            done(status);
        }
        runCommand('mkdir', ['-p', '_tmp'], {}, done);
    });
});

gulp.task('clean-config-files', (done) => {
    runCommand('rm', ['-f', getConfigFilePath(GENERATED_CONFIG_FILE_NAME)], {}, done);
});

gulp.task('clean-contracts', (done) => {
    fs.writeFileSync(getConfigFilePath(GENERATED_CONFIG_FILE_NAME), '{}');
    done();
})

gulp.task('clean', (done) => {
    runSequence(['clean-generated-abi', 'clean-tmp-files', 'clean-config-files', 'clean-contracts'], done);
});

gulp.task('generate-abi', async (done) => {
    const HomeBridgeABI = getABIPath(HOMEBRIDGE_CONTRACT_NAME);
    const DEXChainABI = getABIPath(DEXCHAIN_CONTRACT_NAME);
    const OrderbookABI = getABIPath(ORDERBOOK_CONTRACT_NAME);
    const DataStoreABI = getABIPath(DATASTORE_CONTRACT_NAME);
    const FeeContractABI = getABIPath(FEE_CONTRACT_NAME);

    // Generate .go files
    await generateABIWithJSON(HomeBridgeABI, HOMEBRIDGE_CONTRACT_NAME, `_abi/${HOMEBRIDGE_CONTRACT_NAME}/${HOMEBRIDGE_CONTRACT_NAME}.go`);
    await generateABIWithJSON(DEXChainABI, DEXCHAIN_CONTRACT_NAME, `_abi/${DEXCHAIN_CONTRACT_NAME}/${DEXCHAIN_CONTRACT_NAME}.go`);
    await generateABIWithJSON(OrderbookABI, ORDERBOOK_CONTRACT_NAME, `_abi/${ORDERBOOK_CONTRACT_NAME}/${ORDERBOOK_CONTRACT_NAME}.go`);

    // Copy abi json to public directory
    return gulp.src([HomeBridgeABI, DEXChainABI, OrderbookABI, DataStoreABI, FeeContractABI])
        .pipe(gulp.dest(`web/public/abi`));
});

gulp.task('copy-config', (done) => {
    const configFile = getConfigFilePath(GENERATED_CONFIG_FILE_NAME);
    const networksFile = getConfigFilePath(NETWORKS_CONFIG_FILE_NAME);
    const tokensFile = getConfigFilePath(TOKENS_CONFIG_FILE_NAME);

    // copy to public directory
    return gulp.src([configFile, networksFile, tokensFile])
        .pipe(gulp.dest(`web/public`));
});

gulp.task('deploy-contracts', (done) => {
    runSequence('clean-contracts', 'compile-contracts', 'deploy-bridge-contracts', 'deploy-exchange-contracts', done);
});

gulp.task('compile-contracts', (done) => {
    let env = Object.create(process.env);
    env.DEX_DAPP_BUILD_DIR = path.resolve(process.cwd(), 'dapp/build');
    env.DEX_DAPP_SRC_DIR = path.resolve(process.cwd(), 'dapp/contracts');
    env.DEX_DAPP_LIB_DIR = path.resolve(process.cwd(), 'node_modules/openzeppelin-solidity');   
    return runCommand('sh', [
        'scripts/build-contracts.sh'
    ], {
        env
    }, done);
});

gulp.task('deploy-bridge-contracts', async (done) => {
    let networksConfig = JSON.parse(fs.readFileSync('configs/network.json'));

    let web3 = new Web3();
    web3.setProvider(new web3.providers.HttpProvider(networksConfig.bridge.provider));
    let networkID = await web3.eth.net.getId()
    
    let source = fs.readFileSync('dapp/build/HomeBridge.json');
    let contracts = JSON.parse(source)['contracts'];

    let accounts = await getWeb3Accounts(web3);

    let from = accounts[0];
    let txOpts = { from };

    let HomeBridgeJSON = contracts['HomeBridge.sol:HomeBridge']; 
    let HomeBridgeABI = JSON.parse(HomeBridgeJSON.abi);

    try {
        let HomeBridge = await deployContract({
            web3,
            contractJSON: HomeBridgeJSON,
            args: [
                networksConfig.bridge.requiredSignatures,
                networksConfig.authorities
            ],
            txOpts
        });
        writeJSONFile(getABIPath(HOMEBRIDGE_CONTRACT_NAME), HomeBridgeABI);
        appendToConfigFile({
            bridge: {
                network: networkID,
                address: HomeBridge.options.address,
                topics: getAllTopicsFromABI(HomeBridgeABI)
            }
        })
        console.log(`HomeBridge deployed at ${HomeBridge.options.address}\n\n`);
    } catch (e) {
        console.error(e);
    }
});

gulp.task('deploy-exchange-contracts', async (done) => {
    let networksConfig = JSON.parse(fs.readFileSync('configs/network.json'));

    let web3 = new Web3();
    web3.setProvider(new web3.providers.HttpProvider(networksConfig.exchange.provider));
    let networkID = await web3.eth.net.getId()

    let accounts = await getWeb3Accounts(web3);

    let from = accounts[0];
    let txOpts = { 
        from,
        gas: '3000000',
        gasPrice: 0
    };

    console.log(`\n\nDeploying DataStore...`)
    let DataStoreContractSource = JSON.parse(fs.readFileSync('dapp/build/DataStore.json'));
    let DataStoreJSON = DataStoreContractSource.contracts['DataStore.sol:DataStore']; 
    let DataStoreABI = JSON.parse(DataStoreJSON.abi);
    writeJSONFile(getABIPath(DATASTORE_CONTRACT_NAME), DataStoreABI);
    let DataStore = await deployContract({ web3, contractJSON: DataStoreJSON, txOpts});
    appendToConfigFile({
        datastore: {
            network: networkID,
            address: DataStore.options.address,
            topics: getAllTopicsFromABI(DataStoreABI)
        }
    })
    console.log(`DataStore deployed at ${DataStore.options.address}`);

    console.log(`\n\nDeploying DEXChain...`)
    let DEXChainContractSource = JSON.parse(fs.readFileSync('dapp/build/DEXChain.json'));
    let DEXChainJSON = DEXChainContractSource.contracts['DEXChain.sol:DEXChain']; 
    let DEXChainABI = JSON.parse(DEXChainJSON.abi);
    writeJSONFile(getABIPath(DEXCHAIN_CONTRACT_NAME), DEXChainABI);
    let DEXChain = await deployContract({
        web3, 
        contractJSON: DEXChainJSON, 
        args: [DataStore.options.address], 
        txOpts
    });
    appendToConfigFile({
        exchange: {
            network: networkID,
            address: DEXChain.options.address,
            topics: getAllTopicsFromABI(DEXChainABI)
        }
    })
    console.log(`DEXChain deployed at ${DEXChain.options.address}`);

    let FeeContractContractSource = JSON.parse(fs.readFileSync('dapp/build/FeeContract.json'));
    console.log(`\n\nDeploying FeeHelpers...`)
    let FeeHelpersJSON = FeeContractContractSource.contracts['lib/FeeHelpers.sol:FeeHelpers']; 
    // let FeeHelpersABI = JSON.parse(FeeHelpersJSON.abi);
    let FeeHelpers = await deployContract({ web3, contractJSON: FeeHelpersJSON, txOpts });
    console.log(`FeeHelpers deployed at ${FeeHelpers.options.address}`);

    console.log(`\n\nDeploying FeeContract...`)
    let FeeContractJSON = FeeContractContractSource.contracts['FeeContract.sol:FeeContract']; 
    let FeeContractABI = JSON.parse(FeeContractJSON.abi);
    writeJSONFile(getABIPath(FEE_CONTRACT_NAME), FeeContractABI);
    let FeeContract = await deployContract({
        web3, 
        contractJSON: FeeContractJSON, 
        args: [DataStore.options.address], 
        txOpts,
        libraries: {
            'lib/FeeHelpers.sol': FeeHelpers.options.address,
        }
    });
    appendToConfigFile({
        feecontract: {
            network: networkID,
            address: FeeContract.options.address,
            topics: getAllTopicsFromABI(FeeContractABI)
        }
    })
    console.log(`FeeContract deployed at ${FeeContract.options.address}`);

    let OrderbookContractSource = JSON.parse(fs.readFileSync('dapp/build/Orderbook.json'));
    // console.log(`\n\nDeploying OrderHelpers...`)
    // let OrderHelpersJSON = OrderbookContractSource.contracts['lib/OrderHelpers.sol:OrderHelpers']; 
    // // let OrderHelpersABI = JSON.parse(OrderHelpersJSON.abi);
    // let OrderHelpers = await deployContract({ web3, contractJSON: OrderHelpersJSON, txOpts });
    // console.log(`OrderHelpers deployed at ${OrderHelpers.options.address}`);

    // console.log(`\n\nDeploying OrderbookHelpers...`)
    // let OrderbookHelpersJSON = OrderbookContractSource.contracts['lib/OrderbookHelpers.sol:OrderbookHelpers']; 
    // // let OrderbookHelpersABI = JSON.parse(OrderbookHelpersJSON.abi);
    // let OrderbookHelpers = await deployContract({
    //     web3,
    //     contractJSON: OrderbookHelpersJSON,
    //     txOpts,
    //     libraries: {
    //         // 'lib/FeeHelpers.sol': FeeHelpers.options.address,
    //         'lib/OrderHelpers.sol': OrderHelpers.options.address,
    //     }
    // });
    // console.log(`OrderbookHelpers deployed at ${OrderbookHelpers.options.address}`);
    
    console.log(`\n\nDeploying Orderbook...`)
    let OrderbookJSON = OrderbookContractSource.contracts['Orderbook.sol:Orderbook']; 
    let OrderbookABI = JSON.parse(OrderbookJSON.abi);
    writeJSONFile(getABIPath(ORDERBOOK_CONTRACT_NAME), OrderbookABI);
    let Orderbook = await deployContract({
        web3, 
        contractJSON: OrderbookJSON, 
        args: [DataStore.options.address, DEXChain.options.address], 
        txOpts,
        libraries: {
            'lib/FeeHelpers.sol': FeeHelpers.options.address,
            // 'lib/OrderHelpers.sol': OrderHelpers.options.address,
            // 'lib/OrderbookHelpers.sol': OrderbookHelpers.options.address,
        }
    });
    appendToConfigFile({
        orderbook: {
            network: networkID,
            address: Orderbook.options.address,
            topics: getAllTopicsFromABI(OrderbookABI)
        }
    })
    console.log(`Orderbook deployed at ${Orderbook.options.address}`);

    console.log("Whitelisting DEXChain contract for DataStore...")
    await DataStore.methods.whitelistContract(DEXChain.options.address).send(txOpts)
    .then(function () {
        console.log("Feeding Authorities to DEXChain...");
        return DEXChain.methods.setAuthorities(networksConfig.exchange.requiredSignatures, networksConfig.authorities).send(txOpts)
    })
    .then(function () {
        console.log("Whitelisting Orderbook contract for DataStore...")
        return DataStore.methods.whitelistContract(Orderbook.options.address).send(txOpts)
    })
    .then(function () {
        console.log("Whitelisting Orderbook contract for DEXChain...")
        return DEXChain.methods.whitelistContract(Orderbook.options.address).send(txOpts)
    })
    .then(function () {
        console.log("Whitelisting FeeContract contract for DataStore...")
        return DataStore.methods.whitelistContract(FeeContract.options.address).send(txOpts)
    })
    .then(function () {
        console.log("Feeding fee details to FeeContract...")
        return FeeContract.methods.updateFees(
            accounts[0],
            networksConfig.exchange.makeFee, 
            networksConfig.exchange.takeFee,
            networksConfig.exchange.cancelFee
        ).send(txOpts)
    })
    .catch(function (err) {
        console.error(err);
    })
});

gulp.task('build-go', (done) => {
    done();
});

gulp.task('default', (done) => {
    runSequence('clean', 'deploy-contracts', 'copy-config', 'generate-abi', 'build-go', done);
});

function getWeb3Accounts(web3) {
    return new Promise(function (resolve, reject) {
        web3.eth.getAccounts(function (err, accounts) {
            if (err) {
                reject(accounts);
                return;
            }

            resolve(accounts);
        });
    });
}

function deployContract({ web3, contractJSON, args, txOpts, libraries }) {
    // ABI description as JSON structure
    let abi = JSON.parse(contractJSON.abi);

    // Smart contract EVM bytecode as hex
    let code = '0x' + contractJSON.bin;

    if (libraries) {
        for (let libName in libraries) {
            console.log(libName, libraries[libName])
            code = code.replace(new RegExp("_*" + libName + ".*_*", "g"), libraries[libName].slice(2));
        }
    }

    // Create Contract proxy class
    let MyContract = new web3.eth.Contract(abi);

    txOpts = Object.assign({}, {
        gas: '18446744073709551',
        // gas: '5000000000000000',
        gasPrice: 0
    }, txOpts)

    return new Promise(function (resolve, reject) {
        MyContract.deploy({
            data: code,
            arguments: args
        })
        .send(txOpts)
        .on('error', function (error) {
            reject(error);
        })
        .on('transactionHash', function (transactionHash) {
            console.log(`Got transaction hash: ${transactionHash}`);
        })
        .on('receipt', function (receipt) {
            console.log(`Deployed at ${receipt.contractAddress}. Waiting for confirmation...`);
        })
        // .on('confirmation', function(confirmationNumber, receipt){
        //     console.log(`Contract creation confirmed...`);
        // })
        .then(function (newContractInstance) {
            resolve(newContractInstance);
        })
        .catch(function (err) {
            reject(err);
        });
    });
    
}

function appendToConfigFile(data) {
    let config = JSON.parse(fs.readFileSync(getConfigFilePath(GENERATED_CONFIG_FILE_NAME), 'utf8'));
    config = Object.assign({}, config, data);
    writeJSONFile(getConfigFilePath(GENERATED_CONFIG_FILE_NAME), config);
}