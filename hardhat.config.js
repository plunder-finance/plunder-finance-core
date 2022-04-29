require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("hardhat-interface-generator");
require("hardhat-contract-sizer");
require("solidity-coverage");
require('@openzeppelin/hardhat-upgrades');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const FTMSCAN_KEY = process.env.FTMSCAN_API_KEY;

const ether = n => `${n}${'0'.repeat(18)}`;

task('test', async (_, hre, runSuper) => {
  hre.accounts = await hre.web3.eth.getAccounts();
  const testFiles = _.testFiles.length ? _.testFiles : ['./test/index.js'];
  await runSuper({ testFiles });
});

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    mainnet: {
      url: `https://rpc.ftm.tools`,
      chainId: 250,
//      accounts: [`0x${PRIVATE_KEY}`],
    },
    testnet: {
      url: `https://rpcapi-tracing.testnet.fantom.network`,
      chainId: 4002,
//      accounts: [`0x${PRIVATE_KEY}`],
    },
    hardhat: {
      accounts: {
        count: 100,
        accountsBalance: ether(1000000000),
      },
      hardfork: 'berlin',
      allowUnlimitedContractSize: true,
      blockGasLimit: 12e6,
      gas: 12e6,
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 1200000,
  },
}

if (process.env.TEST_ENV_FORK) {
  console.log({
    TEST_ENV_FORK: process.env.TEST_ENV_FORK,
  })
  config.networks.hardhat.forking = { url: process.env.TEST_ENV_FORK };
}

module.exports = config