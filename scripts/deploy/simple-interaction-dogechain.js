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

const StrategyYodeV2LP = artifacts.require('StrategyYodeV2LP')

const { deployTrisolarisMiniChefDualLPStrategy, deployUniV2ChefV1Strategy } = require('./common');

const ADDRESSES = ALL_ADDRESSES.DOGE

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

async function triggerHarvest() {

  console.log(`Starting deployment on ${network.name}`)

  const accounts = await web3.eth.getAccounts();
  console.log({
    accounts
  })

  const vaultAddress = '0x1275cCE3b55E2E6A977bCbBeBc21aF70c8351a1E'

  const vault = await PlunderVault.at(vaultAddress)

  console.log('Harvesting..')

  const strategyAddr = await vault.strategy()
  console.log({
    strategyAddr
  })

  const strategy = await StrategyYodeV2LP.at(strategyAddr)

  await strategy.harvest()

  console.log('Done harvesting. Try again')

  await strategy.harvest()

  console.log('Done again.')
}

async function depositAction() {

  console.log(`Starting deployment on ${network.name}`)

  const accounts = await web3.eth.getAccounts();
  console.log({
    accounts
  })

  const vaultAddress = '0x9Ed787cB8141FD90F1a1e65D1d47b8BAB30061ED'
  const vault = await PlunderVault.at(vaultAddress)

  const lpTokenAddress = await vault.want()
  const lpToken = await IUniV2Pair.at(lpTokenAddress)

  const lpTokenERC20 = await IERC20Extended.at(lpTokenAddress)

  const token0Address = await lpToken.token0()
  const token1Address = await lpToken.token1()

  console.log({
    lpTokenAddress,
    token0Address,
    token1Address
  })

  const tokenName = await lpTokenERC20.name()

  console.log({
    tokenName
  })

  const balance = await lpTokenERC20.balanceOf(accounts[0])
  const balanceDiv = balance.divn(100)


  const token0 = await IERC20Extended.at(token0Address)
  const token1 = await IERC20Extended.at(token1Address)

  const name0 = await token0.name()
  const name1 = await token1.name()

  console.log({
    name0,
    name1
  })

  console.log({
    balance: balance.toString(),
    balanceDiv: balanceDiv.toString()
  })

  await lpTokenERC20.approve(vault.address, ether('10000000000000'))

  console.log('Deposit.')
  await vault.deposit(balanceDiv)
  console.log('Deposit done.')
}

async function deployAndDeposit() {

  console.log(`Starting deployment on ${network.name}`)

  const accounts = await web3.eth.getAccounts();
  console.log({
    accounts
  })

  const owner = accounts[0]
  const treasury = owner // for testing purposes
  const feeRecipient = accounts[0]
  const keeper1 = accounts[0]
  const strategist1 = accounts[0]

  const POOLS = [
    {
      lpTokenAddress: ADDRESSES.YODESWAP.LP_TOKEN_WDOGE_USDC,
      baseProtocolName: "YODESWAP",
      baseProtocolSymbol: "YODE",
      masterChef: ADDRESSES.YODESWAP.MASTER_CHEF,
      dexTokenAddress: ADDRESSES.YODESWAP.DEX_TOKEN,
      wrappedBaseLayerTokenAddress: ADDRESSES.WWDOGE,
      router02Address: ADDRESSES.YODESWAP.ROUTER02,
      poolId: 11
    }
  ]

  let deployment

  for (const pool of POOLS) {
    deployment = await deployUniV2ChefV1Strategy(
      {...pool,
        owner,
        treasury,
        feeRecipient,
        keeper1,
        strategist1
      }
    )
  }

  const { vault: vaultAddress, strategy: strategyAddress } = deployment


  const vault = await PlunderVault.at(vaultAddress)

  const lpTokenAddress = await vault.want()

  const lpTokenERC20 = await IERC20Extended.at(lpTokenAddress)
  const balance = await lpTokenERC20.balanceOf(accounts[0])
  const balanceDiv = balance.divn(100)


  console.log({
    balance: balance.toString(),
    balanceDiv: balanceDiv.toString()
  })

  console.log('Approve.')
  await lpTokenERC20.approve(vault.address, ether('10000000000000'))

  const allowance = await lpTokenERC20.allowance(accounts[0], vault.address)

  console.log({
    allowance: allowance.toString()
  })

  console.log('Deposit.')
  await vault.deposit('10000')
  console.log('Done')
}

async function main() {
  await triggerHarvest()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
