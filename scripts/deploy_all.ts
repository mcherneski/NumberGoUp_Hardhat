import { ethers } from "hardhat";
import { deploy_uniswap } from "./deploy_uniswap";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // First deploy Uniswap V3 contracts
  console.log("\n=== Deploying Uniswap V3 Contracts ===");
  const uniswapAddresses = await deploy_uniswap();

  // Then deploy our contracts
  console.log("\n=== Deploying NumberGoUp Contracts ===");
  const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
  const numberGoUp = await NumberGoUp.deploy(
    "Number Go Up",
    "NGU",
    18n, // decimals
    100000000n, // maxTotalSupply
    deployer.address, // initialOwner
    deployer.address, // initialMintRecipient
    uniswapAddresses.SwapRouter,
    uniswapAddresses.PositionManager
  );

  await numberGoUp.waitForDeployment();
  console.log("NumberGoUp deployed to:", await numberGoUp.getAddress());

  // Log all deployed addresses
  console.log("\n=== All Deployed Addresses ===");
  console.log("Uniswap V3:", uniswapAddresses);
  console.log("NumberGoUp:", await numberGoUp.getAddress());

  return {
    uniswap: uniswapAddresses,
    numberGoUp: await numberGoUp.getAddress()
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 