const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES, impersonateAccount, getDeployAddressAfter } = require('./../../test/fork/common')

const IUniswapV2Router02 = artifacts.require('contracts/BIFI/interfaces/common/IUniswapRouterETH.sol:IUniswapRouterETH')
const PlunderVault = artifacts.require('PlunderVaultV6')
const PlunderFinanceTreasury = artifacts.require('PlunderTreasury')
const IUniV2Pair = artifacts.require('contracts/BIFI/interfaces/common/IUniswapV2Pair.sol:IUniswapV2Pair')
const StrategyTriMiniChefLP = artifacts.require('StrategyTriMiniChefLP')
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20')
const { ADDRESSES } = require('../../test/fork/common')


const config = {
  want: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  mooName: "Moo Worker B",
  mooSymbol: "mooWorkerB",
  delay: 86400,
};


async function deployTreasury (owner) {

  console.log(`Deploying treasury..`);

  const treasury = await PlunderFinanceTreasury.new({ from: owner })

  console.log({
    treasury: treasury.address
  })
}

async function deployTrisolarisLPStrategy(lpTokenAddress) {

  const uniswapV2Router02 = await IUniswapV2Router02.at(ADDRESSES.TRISOLARIS.ROUTER02)

  const wethAddress = await uniswapV2Router02.WETH()


  const lpToken = await IUniV2Pair.at(lpTokenAddress)

  const token0 = await lpToken.token0()
  const token1 = await lpToken.token1()
  console.log({
    wethAddress,
    token0
  })


  const futureStrategyAddress = await getDeployAddressAfter(1)
  const vault = await PlunderVault.new(
    futureStrategyAddress,
    'Plunder Vault: Trisolaris LP BASTION-WNEAR',
    'PV-TRI-LP-TRI-USDT',
    APPROVAL_DELAY, {
      from: owner
    }
  );

  const feeRemitters = [treasury.address, strategist1]
  const strategists = [strategist1]
  const want = lpToken.address

  const masterChef = ADDRESSES.TRISOLARIS.MASTER_CHEF
  const dexTokenAddress = ADDRESSES.TRISOLARIS.TRI
  const baseLayerToken = wethAddress

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

  const strategy = await StrategyTriMiniChefLP.new(
    want,
    poolId++,
    masterChef,
    vault.address,
    uniswapV2Router02.address,
    keeper1,
    strategist1,
    feeRecipient,
    [dexTokenAddress, ADDRESSES.WNEAR, ADDRESSES.WETH], // _outputToNativeRoute
    [dexTokenAddress, ADDRESSES.USDT], //_outputToLp0Route
    [dexTokenAddress] // _outputToLp1Route
  )
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

  await deployTreasury(accounts[0])

  await deployTrisolarisLPStrategy(ADDRESSES.TRISOLARIS.LP_TOKEN_TRI_USDT)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
