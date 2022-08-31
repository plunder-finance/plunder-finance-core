const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES, impersonateAccount, getDeployAddressAfter } = require('./common')
const { deployUniV2ChefV1Strategy, deployTreasury } = require("../../scripts/deploy/common");

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



    console.log(`Starting deployment on ${network.name}`)

    const accounts = await web3.eth.getAccounts();
    console.log({
      accounts
    })



    const owner = '0x50E625D01b624d5898D64F438957C72EFff3d943'

    console.log('Fetch balance of owner')


    const ownerBalance = await web3.eth.getBalance(owner)



    console.log({
      ownerBalance: ownerBalance.toString()
    })
    await impersonateAccount(owner)

    // console.log({
    //   accounts
    // })
    // const [owner, ] = accounts

    const treasuryContract = await deployTreasury(owner)

    const treasury = treasuryContract.address
    const feeRecipient = owner
    const keeper1 = owner
    const strategist1 = owner

    const POOLS = [
      {
        lpTokenAddress: ADDRESSES.YODESWAP.LP_TOKEN_WDOGE_USDC,
        baseProtocolName: "YODESWAP",
        baseProtocolSymbol: "YODE",
        masterChef: ADDRESSES.YODESWAP.MASTER_CHEF,
        dexTokenAddress: ADDRESSES.YODESWAP.DEX_TOKEN,
        wrappedBaseLayerTokenAddress: ADDRESSES.WWDOGE,
        router02Address: ADDRESSES.YODESWAP.ROUTER02,
      }
    ]

    for (const pool of POOLS) {
      await deployUniV2ChefV1Strategy(
        {...pool,
          owner,
          treasury,
          feeRecipient,
          keeper1,
          strategist1
        }
      )
    }

  })
})
