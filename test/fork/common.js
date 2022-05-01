const { network, web3, accounts } = require("hardhat");
const { ether } = require("@openzeppelin/test-helpers");

const impersonateAccount = async member => network.provider.request({ method: 'hardhat_impersonateAccount', params: [member] })

const giveEther = async to => web3.eth.sendTransaction({ from: accounts[0], to, value: ether('1000000') })

const ADDRESSES = {

  AURORA: {
    CHAINLINK: {
      ETHUSD: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612'
    },
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    TRISOLARIS: {
      ROUTER02: '0x2cb45edb4517d5947afde3beabf95a582506858b',
      LP_TOKEN_WNEAR_BASTION: '0xbbf3d4281f10e537d5b13ca80be22362310b2bf9',
      TRI: '0xFa94348467f64D5A457F75F8bc40495D33c65aBB',
      MASTER_CHEF: '0x3838956710bcc9D122Dd23863a0549ca8D5675D6'
    }
  }
}

module.exports = {
  ADDRESSES,
  impersonateAccount,
  giveEther
}