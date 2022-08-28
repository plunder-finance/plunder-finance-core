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
const IUniswapV2Pair = artifacts.require('IUniswapV2Pair')

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

async function main() {

  console.log(`Token doge reads ${network.name}`)

  const YLP_WWDOGE_USDC = '0x8DCeBE9f071562D52b5ABB17235f3bCA768C1e44'
  const token = await IERC20Extended.at(YLP_WWDOGE_USDC)
  const name = await token.name()
  const symbol = await token.symbol()
  console.log({
    name,
    symbol,
  })


  const pair = await IUniswapV2Pair.at(YLP_WWDOGE_USDC);

  const token0Address = await pair.token0();
  const token1Address = await pair.token1();

  const token0 = await IERC20Extended.at(token0Address)
  const token1 = await IERC20Extended.at(token1Address)

  const token0Name = await token0.name()
  const token1Name = await token1.name()
  console.log({
    token0Name,
    token1Name,
  })

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
