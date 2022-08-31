const { network, web3, accounts, ethers } = require("hardhat");
const { ether } = require("@openzeppelin/test-helpers");
const { getContractAddress } = require('@ethersproject/address')


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
      LP_TOKEN_TRI_USDT: '0x61C9E05d1Cdb1b70856c7a2c53fA9c220830633c',
      LP_TOKEN_aUSDO_USDT: '0x6277f94a69df5df0bc58b25917b9ecefbf1b846a',
      TRI: '0xFa94348467f64D5A457F75F8bc40495D33c65aBB',
      MASTER_CHEF: '0x3838956710bcc9D122Dd23863a0549ca8D5675D6'
    },
    WNEAR: '0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d',
    WETH:  '0xc9bdeed33cd01541e1eed10f90519d2c06fe3feb',
    USDT: '0x4988a896b1227218e4A686fdE5EabdcAbd91571f'
  },
  DOGE: {
    YODESWAP: {
      ROUTER02: '0x72d85Ab47fBfc5E7E04a8bcfCa1601D8f8cE1a50',
      DEX_TOKEN: '0x6FC4563460d5f45932C473334d5c1C5B4aEA0E01',
      MASTER_CHEF: '0xf7b1150cb31488bde3eB3201e0FDF1Bd54799712',
      LP_TOKEN_WDOGE_USDC: '0x8DCeBE9f071562D52b5ABB17235f3bCA768C1e44'
    },
    WWDOGE: '0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101',
    USDC: '0x765277EebeCA2e31912C9946eAe1021199B39C61'
  },
  FANTOM: {
    SPOOKYSWAP: {
    }
  }
}

async function getDeployAddressAfter(txCount) {
  const [owner] = await ethers.getSigners()

  const transactionCount = await owner.getTransactionCount()
  const nextAddress = getContractAddress({
    from: owner.address,
    nonce: transactionCount + txCount,
  });
  return nextAddress;
}

module.exports = {
  ADDRESSES,
  impersonateAccount,
  giveEther,
  getDeployAddressAfter
}
