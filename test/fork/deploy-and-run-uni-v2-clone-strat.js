const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES, impersonateAccount, getDeployAddressAfter } = require('./common')

const IUniswapV2Router02 = artifacts.require('contracts/BIFI/interfaces/common/IUniswapRouterETH.sol:IUniswapRouterETH')
const PlunderVault = artifacts.require('PlunderVaultV6')
const PlunderFinanceTreasury = artifacts.require('PlunderTreasury')
const IUniV2Pair = artifacts.require('contracts/BIFI/interfaces/common/IUniswapV2Pair.sol:IUniswapV2Pair')
const StrategyTriMiniChefLP = artifacts.require('StrategyTriMiniChefLP')
const IERC20 = artifacts.require('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20')

const [owner, strategist1, keeper1, feeRecipient ] = accounts;

// Aurora
const ADDRESSES = ALL_ADDRESSES.AURORA

const APPROVAL_DELAY = 60 // seconds

let poolId = 0;

const lpHolder = '0xc8b9a58aadaacc392858ac8c0b8ffe0df4967c84'

describe('deploy and interact with Uni V2 clone Vaults', async function () {

  it('initializes contracts', async function () {

    const uniswapV2Router02 = await IUniswapV2Router02.at(ADDRESSES.TRISOLARIS.ROUTER02)

    const wethAddress = await uniswapV2Router02.WETH()


    const lpToken = await IUniV2Pair.at(ADDRESSES.TRISOLARIS.LP_TOKEN_TRI_USDT)

    const token0 = await lpToken.token0()
    const token1 = await lpToken.token1()
    console.log({
      wethAddress,
      token0
    })

    const treasury = await PlunderFinanceTreasury.new({ from: owner })

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

    console.log('Impersonate and approve')

    await web3.eth.sendTransaction({
      to: lpHolder,
      from: owner,
      value: ether('500')
    })

    await impersonateAccount(lpHolder)


    const lpTokenERC20 = await IERC20.at(lpToken.address);

    await lpTokenERC20.approve(vault.address, ether('100000000'), {
      from: lpHolder
    })

    const balance = await lpTokenERC20.balanceOf(lpHolder)

    console.log({
      balance: balance.toString()
    })

    await vault.deposit(balance, {
      from: lpHolder
    })

    console.log('Done deposit.')


    let harvested, feesCharged, swapped;

    async function harvestAndPrint() {
      harvested = await strategy.harvested()
      feesCharged = await strategy.feesCharged()
      swapped = await strategy.swapped()

      console.log({
        harvested,
        feesCharged,
        swapped
      })

      const tx = await strategy.harvest()
      // console.log({
      //   logs: tx.receipt.rawLogs
      // })

    }


    await time.increase(60 * 60 * 24)


    await harvestAndPrint()

    await harvestAndPrint()

    await harvestAndPrint()


    harvested = await strategy.harvested()
    feesCharged = await strategy.feesCharged()
    swapped = await strategy.swapped()

    console.log({
      harvested,
      feesCharged,
      swapped
    })

  })
})
