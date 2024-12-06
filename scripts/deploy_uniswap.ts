import { ethers } from "hardhat";
import { Contract } from "ethers";

export async function deploy_uniswap() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Uniswap V3 contracts with account:", deployer.address);

  // Deploy WETH9
  const WETH9Factory = await ethers.getContractFactory("WETH9");
  const weth9 = await WETH9Factory.deploy();
  await weth9.waitForDeployment();
  console.log("WETH9 deployed to:", await weth9.getAddress());

  // Deploy Factory
  const UniswapV3Factory = await ethers.getContractFactory("UniswapV3Factory");
  const factory = await UniswapV3Factory.deploy();
  await factory.waitForDeployment();
  console.log("UniswapV3Factory deployed to:", await factory.getAddress());

  // Deploy SwapRouter
  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(
    await factory.getAddress(),
    await weth9.getAddress()
  );
  await swapRouter.waitForDeployment();
  console.log("SwapRouter deployed to:", await swapRouter.getAddress());

  // Deploy NFTDescriptor
  const NFTDescriptor = await ethers.getContractFactory("NFTDescriptor");
  const nftDescriptor = await NFTDescriptor.deploy();
  await nftDescriptor.waitForDeployment();
  console.log("NFTDescriptor deployed to:", await nftDescriptor.getAddress());

  // Deploy NonfungibleTokenPositionDescriptor
  const NonfungibleTokenPositionDescriptor = await ethers.getContractFactory(
    "NonfungibleTokenPositionDescriptor",
    {
      libraries: {
        NFTDescriptor: await nftDescriptor.getAddress(),
      },
    }
  );
  const nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(
    await weth9.getAddress(),
    // Native currency symbol (e.g., "ETH")
    ethers.encodeBytes32String("ETH")
  );
  await nonfungibleTokenPositionDescriptor.waitForDeployment();
  console.log(
    "NonfungibleTokenPositionDescriptor deployed to:",
    await nonfungibleTokenPositionDescriptor.getAddress()
  );

  // Deploy NonfungiblePositionManager
  const NonfungiblePositionManager = await ethers.getContractFactory(
    "NonfungiblePositionManager"
  );
  const nonfungiblePositionManager = await NonfungiblePositionManager.deploy(
    await factory.getAddress(),
    await weth9.getAddress(),
    await nonfungibleTokenPositionDescriptor.getAddress()
  );
  await nonfungiblePositionManager.waitForDeployment();
  console.log(
    "NonfungiblePositionManager deployed to:",
    await nonfungiblePositionManager.getAddress()
  );

  // Save deployed addresses
  const addresses = {
    WETH9: await weth9.getAddress(),
    Factory: await factory.getAddress(),
    SwapRouter: await swapRouter.getAddress(),
    NFTDescriptor: await nftDescriptor.getAddress(),
    PositionDescriptor: await nonfungibleTokenPositionDescriptor.getAddress(),
    PositionManager: await nonfungiblePositionManager.getAddress(),
  };

  console.log("\nDeployed addresses:", addresses);
  return addresses;
}

// Only run if this script is run directly
if (require.main === module) {
  deploy_uniswap()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} 