import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { NumberGoUp } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { deploy_uniswap } from "../scripts/deploy_uniswap";

describe("GameplayScenarios", function () {
  // Initial pool setup values
  const NGU_AMOUNT = ethers.parseEther("6500"); // 6500 NGU tokens
  const ETH_AMOUNT = ethers.parseEther("25"); // 25 ETH
  const POOL_FEE = 3000; // 0.3% fee tier

  async function deployContractsFixture() {
    const [deployer, player1, player2, player3] = await ethers.getSigners();

    // Deploy Uniswap V3 contracts
    const uniswapAddresses = await deploy_uniswap();

    // Deploy NumberGoUp
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

    // Get contract instances
    const weth = await ethers.getContractAt("WETH9", uniswapAddresses.WETH9);
    const factory = await ethers.getContractAt("IUniswapV3Factory", uniswapAddresses.Factory);
    const positionManager = await ethers.getContractAt(
      "INonfungiblePositionManager",
      uniswapAddresses.PositionManager
    );
    const swapRouter = await ethers.getContractAt(
      "ISwapRouter",
      uniswapAddresses.SwapRouter
    );

    // Create pool
    await factory.createPool(
      await numberGoUp.getAddress(),
      uniswapAddresses.WETH9,
      POOL_FEE
    );

    const poolAddress = await factory.getPool(
      await numberGoUp.getAddress(),
      uniswapAddresses.WETH9,
      POOL_FEE
    );
    const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddress);

    // Initialize pool with a price
    const sqrtPriceX96 = ethers.toBigInt("1771845812700903892492222464"); // Price = 1 ETH = 260 NGU
    await pool.initialize(sqrtPriceX96);

    // Approve tokens
    await numberGoUp.approve(uniswapAddresses.PositionManager, ethers.MaxUint256);
    await weth.deposit({ value: ETH_AMOUNT }); // Convert ETH to WETH
    await weth.approve(uniswapAddresses.PositionManager, ethers.MaxUint256);

    // Calculate price range
    const minTick = -887272;
    const maxTick = 887272;

    // Add initial liquidity
    await positionManager.mint({
      token0: await numberGoUp.getAddress(),
      token1: uniswapAddresses.WETH9,
      fee: POOL_FEE,
      tickLower: minTick,
      tickUpper: maxTick,
      amount0Desired: NGU_AMOUNT,
      amount1Desired: ETH_AMOUNT,
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer.address,
      deadline: ethers.MaxUint256
    });

    return {
      numberGoUp,
      uniswapAddresses,
      pool,
      weth,
      positionManager,
      swapRouter,
      deployer,
      player1,
      player2,
      player3
    };
  }

  describe("Uniswap Pool Setup", function () {
    it("Should create pool and add initial liquidity", async function () {
      const { pool, numberGoUp, weth } = await loadFixture(deployContractsFixture);
      
      // Check pool setup
      expect(await pool.token0()).to.equal(await numberGoUp.getAddress());
      expect(await pool.token1()).to.equal(await weth.getAddress());
      expect(await pool.fee()).to.equal(POOL_FEE);

      // Get pool state
      const { sqrtPriceX96, tick } = await pool.slot0();
      console.log("\nPool State:");
      console.log("SqrtPriceX96:", sqrtPriceX96.toString());
      console.log("Tick:", tick.toString());
    });

    it("Should allow trading NGU tokens for ETH", async function () {
      const { numberGoUp, weth, swapRouter, player1 } = await loadFixture(deployContractsFixture);
      
      // Transfer some NGU tokens to player1
      const tradeAmount = ethers.parseEther("100"); // 100 NGU tokens
      await numberGoUp.transfer(player1.address, tradeAmount);
      
      // Player1 approves SwapRouter
      await numberGoUp.connect(player1).approve(swapRouter.getAddress(), ethers.MaxUint256);
      
      // Get initial balances
      const initialNGUBalance = await numberGoUp.balanceOf(player1.address);
      const initialETHBalance = await ethers.provider.getBalance(player1.address);
      
      console.log("\nInitial Balances:");
      console.log("NGU:", ethers.formatEther(initialNGUBalance));
      console.log("ETH:", ethers.formatEther(initialETHBalance));

      // Perform swap
      const exactInputParams = {
        tokenIn: await numberGoUp.getAddress(),
        tokenOut: await weth.getAddress(),
        fee: POOL_FEE,
        recipient: player1.address,
        deadline: ethers.MaxUint256,
        amountIn: tradeAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      };

      await swapRouter.connect(player1).exactInputSingle(exactInputParams);

      // Get final balances
      const finalNGUBalance = await numberGoUp.balanceOf(player1.address);
      const finalETHBalance = await ethers.provider.getBalance(player1.address);

      console.log("\nFinal Balances:");
      console.log("NGU:", ethers.formatEther(finalNGUBalance));
      console.log("ETH:", ethers.formatEther(finalETHBalance));

      // Verify the trade
      expect(finalNGUBalance).to.be.lt(initialNGUBalance);
      expect(finalETHBalance).to.be.gt(initialETHBalance);
    });
  });

  // ... rest of your existing test scenarios ...
});