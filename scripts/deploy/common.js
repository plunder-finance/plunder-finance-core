// StrategyTriMiniChefDualLP
const { getDeployAddressAfter } = require("../../test/fork/common");
const { artifacts } = require("hardhat");


const IUniswapV2Router02 = artifacts.require('contracts/BIFI/interfaces/common/IUniswapRouterETH.sol:IUniswapRouterETH')
const PlunderVault = artifacts.require('PlunderVaultV6')
const PlunderFinanceTreasury = artifacts.require('PlunderTreasury')
const IUniV2Pair = artifacts.require('contracts/BIFI/interfaces/common/IUniswapV2Pair.sol:IUniswapV2Pair')
// const StrategyTriMiniChefLP = artifacts.require('StrategyTriMiniChefLP')
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20')
const StrategyTriMiniChefDualLP = artifacts.require('StrategyTriMiniChefDualLP')
const StrategyYodeChefLP = artifacts.require('StrategyYodeChefLP')
const IERC20Extended = artifacts.require('IERC20Extended')


const APPROVAL_DELAY = 60 // seconds

let poolId = 0



const poolSample =   {
  id: 'yode-usdc-wwdoge',
  name: 'USDC-WWDOGE LP',
  token: 'USDC-WWDOGE LP',
  tokenDescription: 'YodeSwap',
  tokenAddress: '0x8DCeBE9f071562D52b5ABB17235f3bCA768C1e44',
  tokenDecimals: 18,
  tokenDescriptionUrl: '#',
  earnedToken: 'PV-YODE-LP-USDC-WWDOGE',
  earnedTokenAddress: '0x9Ed787cB8141FD90F1a1e65D1d47b8BAB30061ED',
  earnContractAddress: '0x9Ed787cB8141FD90F1a1e65D1d47b8BAB30061ED',
  pricePerFullShare: 1,
  tvl: 0,
  oracle: 'lps',
  oracleId: 'pv-usdc-wdoge',
  oraclePrice: 0,
  depositsPaused: false,
  status: 'active',
  platform: 'YodeSwap',
  assets: ['USDC', 'WWDOGE'],
  risks: [
    'COMPLEXITY_LOW',
    'BATTLE_TESTED',
    'IL_LOW',
    'MCAP_LARGE',
    'AUDIT',
    'CONTRACTS_VERIFIED',
    'OVER_COLLAT_ALGO_STABLECOIN',
  ],
  stratType: 'StratLP',
  addLiquidityUrl: 'https://app.yodeswap.dog/exchange/add/0x765277EebeCA2e31912C9946eAe1021199B39C61/0xB7ddC6414bf4F5515b52D8BdD69973Ae205ff101',
  buyTokenUrl:
    '',
  createdAt: 1622123567,
};


async function deployUniV2ChefV1Strategy({
   lpTokenAddress, owner, treasury, feeRecipient, keeper1, strategist1, baseProtocolName, masterChef, dexTokenAddress,
    baseProtocolSymbol, router02Address, wrappedBaseLayerTokenAddress }) {
  const uniswapV2Router02 = await IUniswapV2Router02.at(router02Address)

  const wethAddress = await uniswapV2Router02.WETH()


  const lpToken = await IUniV2Pair.at(lpTokenAddress)

  const token0Address = await lpToken.token0()
  const token1Address = await lpToken.token1()
  console.log({
    dexTokenAddress,
    wethAddress,
    token0: token0Address,
    token1: token1Address
  })

  const token0 = await IERC20Extended.at(token0Address)
  const token1 = await IERC20Extended.at(token1Address)

  // const token0Name = await token0.name()
  // const token1Name = await token1.name()

  const token0Symbol = await token0.symbol()
  const token1Symbol = await token1.symbol()


  const plunderVaultName = `Plunder Vault: ${baseProtocolName} LP ${token0Symbol}-${token1Symbol}`
  const plunderVaultSymbol = `PV-${baseProtocolSymbol}-LP-${token0Symbol}-${token1Symbol}`

  console.log(`Deploying Vault`)
  console.log({
    plunderVaultName,
    plunderVaultSymbol
  })


  const futureStrategyAddress = await getDeployAddressAfter(1)

  console.log({
    futureStrategyAddress,
    plunderVaultName,
    plunderVaultSymbol,
    APPROVAL_DELAY
  })
  const vault = await PlunderVault.new(
    futureStrategyAddress,
    plunderVaultName,
    plunderVaultSymbol,
    APPROVAL_DELAY, {
      from: owner
    }
  );

  const feeRemitters = [treasury.address, strategist1]
  const strategists = [strategist1]
  const want = lpToken.address

  const dexToken = await IERC20.at(dexTokenAddress)


  /*
    constructor(
        address _want,
        uint256 _poolId,
        address _chef,
        address _vault,
        address _unirouter,
        address _keeper,
        address _strategist,
        address _plunderFeeRecipient,
        address[] memory _outputToNativeRoute,
        address[] memory _outputToLp0Route,
        address[] memory _outputToLp1Route
   */

  const strategy = await StrategyYodeChefLP.new(
    want,
    poolId++,
    masterChef,
    vault.address,
    uniswapV2Router02.address,
    keeper1,
    strategist1,
    feeRecipient,
    [dexTokenAddress, wrappedBaseLayerTokenAddress], // _outputToNativeRoute
    [dexTokenAddress, token0Address], //_outputToLp0Route
    [dexTokenAddress, token1Address] // _outputToLp1Route
  )

  console.log('Done.')

  console.log({
    strategy: strategy.address,
    vault: vault.address
  })
}

async function deployTrisolarisMiniChefDualLPStrategy
({ lpTokenAddress, owner, treasury, feeRecipient, keeper1, strategist1, baseProtocolName,
   baseProtocolSymbol, router02Address, secondaryNativeTokenAddress, wrappedBaseLayerTokenAddress, ADDRESSES }) {

  const uniswapV2Router02 = await IUniswapV2Router02.at(router02Address)

  const wethAddress = await uniswapV2Router02.WETH()


  const lpToken = await IUniV2Pair.at(lpTokenAddress)

  const token0Address = await lpToken.token0()
  const token1Address = await lpToken.token1()
  console.log({
    wethAddress,
    token0: token0Address,
    token1: token1Address
  })

  const token0 = await IERC20Extended.at(token0Address)
  const token1 = await IERC20Extended.at(token1Address)

  // const token0Name = await token0.name()
  // const token1Name = await token1.name()

  const token0Symbol = await token0.symbol()
  const token1Symbol = await token1.symbol()


  const plunderVaultName = `Plunder Vault: ${baseProtocolName} LP ${token0Symbol}-${token1Symbol}`
  const plunderVaultSymbol = `PV-${baseProtocolSymbol}-LP-${token0Symbol}-${token1Symbol}`

  console.log(`Deploying Vault`)
  console.log({
    plunderVaultName,
    plunderVaultSymbol
  })


  const futureStrategyAddress = await getDeployAddressAfter(1)

  console.log({
    futureStrategyAddress,
    plunderVaultName,
    plunderVaultSymbol,
    APPROVAL_DELAY
  })
  const vault = await PlunderVault.new(
    futureStrategyAddress,
    plunderVaultName,
    plunderVaultSymbol,
    APPROVAL_DELAY, {
      from: owner
    }
  );

  const feeRemitters = [treasury.address, strategist1]
  const strategists = [strategist1]
  const want = lpToken.address

  const masterChef = ADDRESSES.MASTER_CHEF
  const dexTokenAddress = ADDRESSES.DEX_TOKEN

  const dexToken = await IERC20.at(dexTokenAddress)
  /*
       address _want,
      uint256 _poolId,
      address _chef,
      address _vault,
      address _unirouter,
      address _keeper,
      address _strategist,
      address _plunderFeeRecipient,
      address[] memory _outputToNativeRoute,
      address[] memory _outputToLp0Route,
      address[] memory _outputToLp1Route
   */

  /*
          address _want,
        uint256 _poolId,
        address _chef,
        address _vault,
        address _unirouter,
        address _keeper,
        address _strategist,
        address _plunderFeeRecipient,
        address[] memory _outputToNativeRoute,
        address[] memory _rewardToOutputRoute,
        address[] memory _outputToLp0Route,
        address[] memory _outputToLp1Route
   */

  // https://aurorascan.dev/address/0x3caE5c23bfcA0A1e2834FA6fFd2C55a32c11DdC9#code base example

  const strategy = await StrategyTriMiniChefDualLP.new(
    want,
    poolId++,
    masterChef,
    vault.address,
    uniswapV2Router02.address,
    keeper1,
    strategist1,
    feeRecipient,
    [dexTokenAddress, secondaryNativeTokenAddress, wrappedBaseLayerTokenAddress], // _outputToNativeRoute
    [secondaryNativeTokenAddress, wrappedBaseLayerTokenAddress], // address[] memory _rewardToOutputRoute,
    [dexTokenAddress, secondaryNativeTokenAddress, token1Address, token0Address], //_outputToLp0Route
    [dexTokenAddress, secondaryNativeTokenAddress, token1Address] // _outputToLp1Route
  )

  console.log({
    strategy: strategy.address,
    vault: vault.address
  })
}


module.exports = {
  deployTrisolarisMiniChefDualLPStrategy,
  deployUniV2ChefV1Strategy
}
