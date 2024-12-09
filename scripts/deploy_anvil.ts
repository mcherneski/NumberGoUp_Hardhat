import { ethers } from "hardhat";
import WETH9 from "@uniswap/v2-periphery/build/WETH9.json";
import UniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
import SwapRouter from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json";
import NonfungiblePositionManager from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy WETH9
  console.log("\nDeploying WETH9...");
  const weth9 = await new ethers.ContractFactory(
    WETH9.abi,
    WETH9.bytecode,
    deployer
  ).deploy();
  await weth9.waitForDeployment();
  console.log("WETH9 deployed to:", await weth9.getAddress());

  // Deploy Factory
  console.log("\nDeploying UniswapV3Factory...");
  const factory = await new ethers.ContractFactory(
    UniswapV3Factory.abi,
    UniswapV3Factory.bytecode,
    deployer
  ).deploy();
  await factory.waitForDeployment();
  console.log("UniswapV3Factory deployed to:", await factory.getAddress());

  // Deploy SwapRouter
  console.log("\nDeploying SwapRouter...");
  const swapRouter = await new ethers.ContractFactory(
    SwapRouter.abi,
    SwapRouter.bytecode,
    deployer
  ).deploy(
    await factory.getAddress(),
    await weth9.getAddress()
  );
  await swapRouter.waitForDeployment();
  console.log("SwapRouter deployed to:", await swapRouter.getAddress());

  // Deploy NonfungiblePositionManager
  console.log("\nDeploying NonfungiblePositionManager...");
  const positionManager = await new ethers.ContractFactory(
    NonfungiblePositionManager.abi,
    NonfungiblePositionManager.bytecode,
    deployer
  ).deploy(
    await factory.getAddress(),
    await weth9.getAddress(),
    await factory.getAddress() // Using factory address as token descriptor for simplicity
  );
  await positionManager.waitForDeployment();


  // Deploy NumberGoUp
  console.log("\nDeploying NumberGoUp...");
  const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
  const numberGoUp = await NumberGoUp.deploy(
    "Number Go Up",
    "NGU",
    18n, // decimals
    10000n, // maxTotalSupply (10k tokens)
    deployer.address, // initialOwner
    deployer.address, // initialMintRecipient
    await swapRouter.getAddress(),
    await positionManager.getAddress()
  );
  await numberGoUp.waitForDeployment();
  console.log("NumberGoUp deployed to:", await numberGoUp.getAddress());

  // Create pool with lowest fee tier (0.05%)
  console.log("\nCreating Uniswap V3 pool...");
  const FEE_TIER = 500; // 0.05%
  const factoryContract = new ethers.Contract(
    await factory.getAddress(),
    [
      "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
      "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ],
    deployer
  );
  
  await (await factoryContract.createPool(
    await numberGoUp.getAddress(),
    await weth9.getAddress(),
    FEE_TIER
  )).wait();
  console.log("Pool created at:", await factoryContract.getPool(
    await numberGoUp.getAddress(),
    await weth9.getAddress(),
    FEE_TIER
  ));

  // Set initial price (1 ETH = 260 NGU)
  const INITIAL_PRICE = 260;
  const tick = Math.floor(Math.log(INITIAL_PRICE) / Math.log(1.0001));
  const sqrtPriceX96 = Math.sqrt(INITIAL_PRICE) * 2 ** 96;
  
  const poolAddress = await factoryContract.getPool(
    await numberGoUp.getAddress(),
    await weth9.getAddress(),
    FEE_TIER
  );
  
  const pool = new ethers.Contract(
    poolAddress,
    [
      "function initialize(uint160 sqrtPriceX96) external",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)"
    ],
    deployer
  );
  
  await (await pool.initialize(BigInt(Math.floor(sqrtPriceX96)))).wait();
  console.log("Pool initialized with price:", INITIAL_PRICE.toString(), "NGU per ETH");
  console.log("Initial tick:", tick);

  // Print important addresses
  console.log("\nImportant Contract Addresses:");
  console.log("WETH:", await weth9.getAddress());
  console.log("NGU:", await numberGoUp.getAddress());
  console.log("SwapRouter:", await swapRouter.getAddress());
  console.log("Pool:", poolAddress);
  console.log("NonfungiblePositionManager deployed to:", await positionManager.getAddress());

  // Set ERC721 transfer exemptions
  console.log("\nSetting ERC721 transfer exemptions...");
  const numberGoUpContract = new ethers.Contract(
    await numberGoUp.getAddress(),
    ["function setERC721TransferExempt(address account_, bool value_) external"],
    deployer
  );
  
  await (await numberGoUpContract.setERC721TransferExempt(poolAddress, true)).wait();
  console.log("Pool set as ERC721 transfer exempt");
  
  await (await numberGoUpContract.setERC721TransferExempt(await positionManager.getAddress(), true)).wait();
  console.log("Position Manager set as ERC721 transfer exempt");

  // Add initial liquidity
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const NGU_AMOUNT = ethers.parseEther("6500"); // 6,500 NGU
  const ETH_AMOUNT = ethers.parseEther("25.19"); // 25 ETH

  console.log("\nToken addresses:");
  console.log("token0:", token0);
  console.log("token1:", token1);
  console.log("NGU:", await numberGoUp.getAddress());
  console.log("WETH:", await weth9.getAddress());

  // Check balances before
  console.log("\nBalances before:");
  const IERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  
  const nguToken = new ethers.Contract(await numberGoUp.getAddress(), IERC20_ABI, deployer);
  const wethToken = new ethers.Contract(await weth9.getAddress(), IERC20_ABI, deployer);
  
  console.log("NGU balance:", ethers.formatEther(await nguToken.balanceOf(deployer.address)));
  console.log("ETH balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("WETH balance:", ethers.formatEther(await wethToken.balanceOf(deployer.address)));

  // Convert ETH to WETH
  console.log("\nConverting ETH to WETH...");
  const weth9Contract = new ethers.Contract(
    await weth9.getAddress(),
    ["function deposit() external payable"],
    deployer
  );
  await (await weth9Contract.deposit({ value: ETH_AMOUNT })).wait();
  console.log("WETH balance after deposit:", ethers.formatEther(await wethToken.balanceOf(deployer.address)));

  // Approve tokens
  console.log("\nApproving tokens...");
  await (await nguToken.approve(await positionManager.getAddress(), ethers.MaxUint256)).wait();
  console.log("NGU approved for position manager");
  
  await (await wethToken.approve(await positionManager.getAddress(), ethers.MaxUint256)).wait();
  console.log("WETH approved for position manager");

  // Verify approvals and balances
  console.log("\nVerifying approvals and balances:");
  const nguPMAllowance = await nguToken.allowance(deployer.address, await positionManager.getAddress());
  const wethPMAllowance = await wethToken.allowance(deployer.address, await positionManager.getAddress());
  
  console.log("NGU allowance (Position Manager):", ethers.formatEther(nguPMAllowance));
  console.log("WETH allowance (Position Manager):", ethers.formatEther(wethPMAllowance));

  console.log("\nDeployer balances:");
  console.log("NGU:", ethers.formatEther(await nguToken.balanceOf(deployer.address)));
  console.log("WETH:", ethers.formatEther(await wethToken.balanceOf(deployer.address)));

  // Create position with correct token ordering and adjusted tick range
  console.log("\nAdding initial liquidity...");
  const isNGUToken0 = token0.toLowerCase() === (await numberGoUp.getAddress()).toLowerCase();
  const amount0Desired = isNGUToken0 ? NGU_AMOUNT : ETH_AMOUNT;
  const amount1Desired = isNGUToken0 ? ETH_AMOUNT : NGU_AMOUNT;
  
  // Calculate tick range for price of 260 NGU per ETH with ±15% range
  const minPrice = INITIAL_PRICE * 0.85; // -15%
  const maxPrice = INITIAL_PRICE * 1.15; // +15%
  const minTick = Math.floor(Math.log(minPrice) / Math.log(1.0001));
  const maxTick = Math.ceil(Math.log(maxPrice) / Math.log(1.0001));
  
  // Ensure ticks are on supported boundaries and centered around the initial price
  const tickSpacing = 10; // 0.05% fee tier uses 10 tick spacing
  const tickLower = Math.floor(minTick / tickSpacing) * tickSpacing;
  const tickUpper = Math.ceil(maxTick / tickSpacing) * tickSpacing;
  
  // Center the range around the initial tick
  const midTick = (tickLower + tickUpper) / 2;
  const tickDelta = Math.abs(midTick - tick);
  const adjustedTickLower = Math.floor((tick - tickDelta) / tickSpacing) * tickSpacing;
  const adjustedTickUpper = Math.ceil((tick + tickDelta) / tickSpacing) * tickSpacing;
  
  console.log("Minting position with:");
  console.log("amount0Desired:", ethers.formatEther(amount0Desired), isNGUToken0 ? "NGU" : "WETH");
  console.log("amount1Desired:", ethers.formatEther(amount1Desired), isNGUToken0 ? "WETH" : "NGU");
  console.log("tickLower:", adjustedTickLower);
  console.log("tickUpper:", adjustedTickUpper);
  console.log("Price Range:", `${Math.pow(1.0001, adjustedTickLower)} to ${Math.pow(1.0001, adjustedTickUpper)} NGU per ETH`);

  const mintParams = {
    token0: token0,
    token1: token1,
    fee: FEE_TIER,
    tickLower: adjustedTickLower,
    tickUpper: adjustedTickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: ethers.MaxUint256
  };

  console.log("\nMint Parameters:", mintParams);
  const positionManagerContract = new ethers.Contract(
    await positionManager.getAddress(),
    ["function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"],
    deployer
  );
  await (await positionManagerContract.mint(mintParams)).wait();
  console.log("Initial liquidity added");

  return {
    numberGoUp: await numberGoUp.getAddress(),
    weth9: await weth9.getAddress(),
    factory: await factory.getAddress(),
    swapRouter: await swapRouter.getAddress(),
    positionManager: await positionManager.getAddress(),
    pool: poolAddress
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 