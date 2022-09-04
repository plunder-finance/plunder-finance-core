// @ts-nocheck
const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES, impersonateAccount, getDeployAddressAfter } = require('./../../test/fork/common')

const IUniswapV2Router02 = artifacts.require('contracts/BIFI/interfaces/common/IUniswapRouterETH.sol:IUniswapRouterETH')
const PlunderVault = artifacts.require('PlunderVaultV6')
const PlunderFinanceTreasury = artifacts.require('PlunderTreasury')
const IUniV2Pair = artifacts.require('contracts/BIFI/interfaces/common/IUniswapV2Pair.sol:IUniswapV2Pair')
// const StrategyTriMiniChefLP = artifacts.require('StrategyTriMiniChefLP')
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20')
const StrategyTriMiniChefDualLP = artifacts.require('StrategyTriMiniChefDualLP')
const IERC20Extended = artifacts.require('IERC20Extended')

const { deployTrisolarisMiniChefDualLPStrategy } = require('./common');


const ADDRESSES = ALL_ADDRESSES.AURORA

const config = {
  want: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  mooName: "Moo Worker B",
  mooSymbol: "mooWorkerB",
  delay: 86400,
};

const APPROVAL_DELAY = 60 // seconds

let poolId = 0


async function deployTreasury (owner) {

  console.log(`Deploying treasury..`);

  const treasury = await PlunderFinanceTreasury.new({ from: owner })

  console.log({
    treasury: treasury.address
  })

  return treasury
}


async function main() {

  console.log(`Starting deployment on ${network.name}`)

  const accounts = await web3.eth.getAccounts();
  console.log({
    accounts
  })

  // console.log({
  //   accounts
  // })
  // const [owner, ] = accounts

  const treasuryContract = await deployTreasury(accounts[0])

  const owner = accounts[0]
  const treasury = treasuryContract.address
  const feeRecipient = accounts[0]
  const keeper1 = accounts[0]
  const strategist1 = accounts[0]

  const POOLS = {
    lpTokenAddress: ADDRESSES.TRISOLARIS.LP_TOKEN_aUSDO_USDT,
    baseProtocolName: "TRISOLARIS",
    baseProtocolSymbol: "TRI",
    masterChef: ADDRESSES.TRISOLARIS.MASTER_CHEF,
    dexTokenAddress: ADDRESSES.TRISOLARIS.TRI,
    wrappedBaseLayerTokenAddress: ADDRESSES.WETH,
    router02Address: ADDRESSES.TRISOLARIS.ROUTER02,
    secondaryNativeTokenAddress: ADDRESSES.WNEAR,
    ADDRESSES: {
      MASTER_CHEF: ADDRESSES.TRISOLARIS.MASTER_CHEF,
      DEX_TOKEN: ADDRESSES.TRISOLARIS.TRI
    }
  }

  await deployTrisolarisMiniChefDualLPStrategy(
    {...POOLS,
      owner,
      treasury,
      feeRecipient,
      keeper1,
      strategist1
    }
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });