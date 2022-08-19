// @ts-nocheck
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import '@nomiclabs/hardhat-truffle5';

require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");

import "@typechain/hardhat";
import { task, subtask } from "hardhat/config";
import "./tasks";

import { HardhatUserConfig } from "hardhat/src/types/config";
import { HardhatUserConfig as WithEtherscanConfig } from "hardhat/config";
import { buildHardhatNetworkAccounts, getPKs } from "./utils/configInit";
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names")
import { ethers } from "ethers";

const ether = n => `${n}${'0'.repeat(18)}`;

type DeploymentConfig = HardhatUserConfig & WithEtherscanConfig;

const accounts = getPKs();
const hardhatNetworkAccounts = buildHardhatNetworkAccounts(accounts);


task('test', async (_, hre, runSuper) => {
  hre.accounts = await hre.web3.eth.getAccounts();
  const testFiles = _.testFiles.length ? _.testFiles : ['./test/index.js'];
  await runSuper({ testFiles });
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS)
  .setAction(async (_, __, runSuper) => {
    const paths = await runSuper();

    const filteredPaths = paths.filter(p => {

      const whitelistedPaths = [
        // 'BIFI/interfaces',
        'BIFI/interfaces/plunder',
        'BIFI/interfaces/common',
        'BIFI/strategies/Aurora',
        'BIFI/vaults',
        'BIFI/infra/PlunderTreasury'
      ]

      for (const whitelistedPath of whitelistedPaths) {
        if (p.includes(whitelistedPath)) {
          return true
        }
      }

      return false
    })

    return filteredPaths
  });

const config: DeploymentConfig = {
  defaultNetwork: "hardhat",
  // zksync specific
  zksolc: {
    version: "1.1.0",
    compilerSource: "docker",
    settings: {
      optimizer: {
        enabled: true,
      },
      experimental: {
        dockerImage: "matterlabs/zksolc",
      },
    },
  },
  zkSyncDeploy: {
    zkSyncNetwork: "https://zksync2-testnet.zksync.dev",
    ethNetwork: "goerli", // Can also be the RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
  },

  networks: {
    hardhat: {
      // accounts visible to hardhat network used by `hardhat node --fork` (yarn net <chainName>)
      // accounts: hardhatNetworkAccounts,
      accounts: {
        count: 100,
        accountsBalance: ether(1000000000),
      },

      // To compile with zksolc, this must be the default network.
      zksync: false,
    },
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed2.defibit.io/",
      chainId: 56,
      accounts,
    },
    heco: {
      url: process.env.HECO_RPC || "https://http-mainnet-node.huobichain.com",
      chainId: 128,
      accounts,
    },
    avax: {
      url: process.env.AVAX_RPC || "https://rpc.ankr.com/avalanche",
      chainId: 43114,
      accounts,
    },
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com/",
      chainId: 137,
      accounts,
    },
    fantom: {
      url: process.env.FANTOM_RPC || "https://rpc.ftm.tools",
      chainId: 250,
      accounts,
    },
    one: {
      url: process.env.ONE_RPC || "https://api.s0.t.hmny.io/",
      chainId: 1666600000,
      accounts,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts,
    },
    moonriver: {
      url: process.env.MOONRIVER_RPC || "https://rpc.moonriver.moonbeam.network",
      chainId: 1285,
      accounts,
    },
    celo: {
      url: process.env.CELO_RPC || "https://forno.celo.org",
      chainId: 42220,
      accounts,
    },
    cronos: {
      // url: "https://evm-cronos.crypto.org",
      url: process.env.CRONOS_RPC || "https://rpc.vvs.finance/",
      chainId: 25,
      accounts,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 300000,
      accounts: "remote",
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts,
    },
    kovan: {
      url: "https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 42,
      accounts,
    },
    aurora: {
      url: process.env.AURORA_RPC || "https://mainnet.aurora.dev/Fon6fPMs5rCdJc4mxX4kiSK1vsKdzc3D8k6UF8aruek",
      chainId: 1313161554,
      accounts,
    },
    neondev: {
      url: process.env.AURORA_RPC || "https://proxy.devnet.neonlabs.org/solana",
      chainId: 245022926,
      accounts,
    },
    fuse: {
      url: process.env.FUSE_RPC || "https://rpc.fuse.io",
      chainId: 122,
      accounts,
    },
    metis: {
      url: process.env.METIS_RPC || "https://andromeda.metis.io/?owner=1088",
      chainId: 1088,
      accounts,
    },
    moonbeam: {
      url: process.env.MOONBEAM_RPC || "https://rpc.api.moonbeam.network",
      chainId: 1284,
      accounts,
    },
    sys: {
      url: process.env.SYS_RPC || "https://rpc.syscoin.org/",
      chainId: 57,
      accounts,
    },
    emerald: {
      url: process.env.EMERALD_RPC || "https://emerald.oasis.dev",
      chainId: 42262,
      accounts,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.API_KEY,
  },
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
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.2",
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
      {
        version: "0.5.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts/BIFI",
  },
};

if (process.env.TEST_ENV_FORK) {
  console.log({
    TEST_ENV_FORK: process.env.TEST_ENV_FORK,
  })
  config.networks.hardhat.forking = { url: process.env.TEST_ENV_FORK };
}

export default config;
