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



// StrategyTriMiniChefDualLP
async function deployTrisolarisMiniChefDualLPStrategy
  ({ lpTokenAddress, owner, treasury, feeRecipient, keeper1, strategist1, baseProtocolName,
     baseProtocolSymbol, router02Address, secondaryNativeTokenAddress, wrappedBaseLayerTokenAddress }) {

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

  const masterChef = ADDRESSES.TRISOLARIS.MASTER_CHEF
  const dexTokenAddress = ADDRESSES.TRISOLARIS.TRI

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
    secondaryNativeTokenAddress: ADDRESSES.WNEAR
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
