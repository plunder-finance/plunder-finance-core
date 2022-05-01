const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES } = require('./common')

const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')
const PlunderVault = artifacts.require('PlunderVault')
const PlunderFinanceTreasury = artifacts.require('PlunderFinanceTreasury')
const IUniV2Pair = artifacts.require('IUniV2Pair')
const PlunderStrategyUniswapV2 = artifacts.require('PlunderStrategyUniswapV2')

const [owner, strategist1 ] = accounts;

const impersonateAccount = async member => network.provider.request({ method: 'hardhat_impersonateAccount', params: [member] })

const giveEther = async to => web3.eth.sendTransaction({ from: accounts[0], to, value: ether('1000000') })

// Aurora
const ADDRESSES = ALL_ADDRESSES.AURORA


const APPROVAL_DELAY = 60 // seconds

let poolId = 0;

describe('deploy and interact with Vaults', async function () {

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

    const strategy = await PlunderStrategyUniswapV2.new()

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