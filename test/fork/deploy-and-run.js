const { artifacts, web3, accounts, network } = require('hardhat')
const { ether, time, expectRevert } = require('@openzeppelin/test-helpers')
const { ADDRESSES: ALL_ADDRESSES } = require('./common')

const IUniswapV2Router02 = artifacts.require('IUniswapV2Router02')

const [minter ] = accounts;

const impersonateAccount = async member => network.provider.request({ method: 'hardhat_impersonateAccount', params: [member] })

const giveEther = async to => web3.eth.sendTransaction({ from: accounts[0], to, value: ether('1000000') })

// Aurora
const ADDRESSES = ALL_ADDRESSES.AURORA


describe('deploy and interact with Chests', async function () {

  it('initializes contracts', async function () {

    const uniswapV2Router02 = await IUniswapV2Router02.at(ADDRESSES.TRISOLARIS.ROUTER02)

    const wethAddress = await uniswapV2Router02.WETH()
    console.log({
      wethAddress
    })
  })
})