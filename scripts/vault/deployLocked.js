const hardhat = require("hardhat");
const { addressBook } = require("blockchain-addressbook");
import { verifyContract } from "../../utils/verifyContract";
import { predictAddresses } from "../../utils/predictAddresses";

const {
    platforms: { plunderfinance },
    tokens: {
      FTM: { address: FTM },
    },
  } = addressBook.fantom;

const ethers = hardhat.ethers;

const config = {
  want: FTM,
  stakingContract: '0xFC00FACE00000000000000000000000000000000',
  validatorID: 92,
  validator: '0xE97A5292248c2647466222Dc58563046b3E34b18',
  keeper: plunderfinance.keeper,
  rewardPool: '0x0000000000000000000000000000000000000000',
  name: 'Plunder Escrowed Fantom',
  symbol: 'beFTM',
};

async function main() {
  await hardhat.run("compile");

  const [deployer] = await ethers.getSigners();

  const contractNames = {
    plunderStakedFantom: "PlunderEscrowedFantom",
  };

  const PlunderStakedFantom = await ethers.getContractFactory(contractNames.plunderStakedFantom);

  console.log('deploying Plunder Staked Fantom Contract');

  const lockerArguments = [
    config.want,
    config.stakingContract,
    config.validatorID,
    config.validator,
    config.keeper,
    config.rewardPool,
    config.name,
    config.symbol,
  ];

  const staker = await PlunderStakedFantom.deploy(...lockerArguments);

  await staker.deployed();

  console.log(`Deployed at ${staker.address}`);

  console.log(`Verifying contract....`);
  verifyContract(staker.address, lockerArguments);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
