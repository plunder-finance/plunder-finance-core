const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES } = require('./common')

const IUniswapV2Router02 = artifacts.require('contracts/BIFI/interfaces/common/IUniswapRouterETH.sol:IUniswapRouterETH')
const PlunderVault = artifacts.require('PlunderVaultV6')
const PlunderFinanceTreasury = artifacts.require('PlunderTreasury')
const IUniV2Pair = artifacts.require('contracts/BIFI/interfaces/common/IUniswapV2Pair.sol:IUniswapV2Pair')
const StrategyTriMiniChefDualLP = artifacts.require('StrategyTriMiniChefDualLP')

const [owner, strategist1 ] = accounts;

// Aurora
const ADDRESSES = ALL_ADDRESSES.AURORA

const APPROVAL_DELAY = 60 // seconds

let poolId = 0;

describe('deploy and interact with Uni V2 clone Vaults', async function () {

  it('initializes contracts', async function () {

    const uniswapV2Router02 = await IUniswapV2Router02.at(ADDRESSES.TRISOLARIS.ROUTER02)

    const wethAddress = await uniswapV2Router02.WETH()


    const lpToken = await IUniV2Pair.at(ADDRESSES.TRISOLARIS.LP_TOKEN_WNEAR_BASTION)

    const token0 = await lpToken.token0()
    const token1 = await lpToken.token1()
    console.log({
      wethAddress,
      token0
    })

    const treasury = await PlunderFinanceTreasury.new({ from: owner })
    const vault = await PlunderVault.new(
      lpToken.address,
      'Plunder Vault: Trisolaris LP BASTION-WNEAR',
      'PV-TRI-LP-BST-WNEAR',
      APPROVAL_DELAY, {
        from: owner
      }
    );

    const feeRemitters = [treasury.address, strategist1]
    const strategists = [strategist1]
    const want = lpToken.address

    const strategy = await StrategyTriMiniChefDualLP.new()

    const masterChef = ADDRESSES.TRISOLARIS.MASTER_CHEF
    const dexToken = ADDRESSES.TRISOLARIS.TRI
    const baseLayerToken = wethAddress

    await strategy.initialize(
      vault.address,
      feeRemitters,
      strategists,
      lpToken.address,
      poolId++,
      uniswapV2Router02.address,
      masterChef,
      baseLayerToken,
      dexToken
    );
  })
})
