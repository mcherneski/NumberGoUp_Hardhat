import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));

  const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
  const numberGoUp = await NumberGoUp.deploy(
    "Number Go Up", // name
    "NGU", // symbol
    18, // decimals
    100000, // maxTotalSupply
    deployer.address, // initialOwner
    deployer.address, // initialMintRecipient
    "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Replace with actual Uniswap Swap Router address
    "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2" // Replace with actual Uniswap V3 Nonfungible Position Manager address
  );

  await numberGoUp.deployed();

  console.log("NumberGoUp deployed to:", numberGoUp.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 