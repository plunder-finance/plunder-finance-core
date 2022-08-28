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
const Multicall = artifacts.require('Multicall')


const ADDRESSES = ALL_ADDRESSES.DOGE

async function main() {

  console.log(`Starting deployment on ${network.name}`)

  const accounts = await web3.eth.getAccounts();
  console.log({
    accounts
  })

  console.log('Deploying Multicall..')
  const multicall = await Multicall.new()
  console.log({
    multicall: multicall.address
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
