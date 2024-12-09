import { ethers } from "hardhat";
import { Contract } from "ethers";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";

function tickToPrice(tick: number): number {
  return 1.0001 ** tick;
}

async function main() {
  // Contract addresses from previous deployment
  const POOL_ADDRESS = "0x378e7300f53879D9cE65033a78e985F9d036be0c";
  const NGU_ADDRESS = "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE";
  const WETH_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
  const POSITION_MANAGER_ADDRESS = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";

  const [signer] = await ethers.getSigners();

  // Connect to contracts
  const pool = new ethers.Contract(
    POOL_ADDRESS, 
    [
      ...UniswapV3Pool.abi,
      "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
      "function liquidity() external view returns (uint128)",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)"
    ],
    signer
  );
  const ngu = new ethers.Contract(NGU_ADDRESS, IERC20.abi, signer);
  const weth = new ethers.Contract(WETH_ADDRESS, IERC20.abi, signer);

  console.log("\nPool State:");
  
  // Get pool info
  const slot0 = await pool.slot0();
  const liquidity = await pool.liquidity();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  
  // Get token balances based on correct token ordering
  const isNGUToken0 = token0.toLowerCase() === NGU_ADDRESS.toLowerCase();
  const nguBalance = await ngu.balanceOf(POOL_ADDRESS);
  const wethBalance = await weth.balanceOf(POOL_ADDRESS);
  
  // Calculate price from tick
  const price = Math.pow(1.0001, Number(slot0.tick));
  
  // Convert to NGU/ETH based on token ordering
  const priceInEth = isNGUToken0 ? 1 / price : price;
  
  console.log("\nLiquidity Information:");
  console.log("- Current Liquidity:", liquidity.toString());
  console.log("- WETH Balance:", ethers.formatEther(wethBalance));
  console.log("- NGU Balance:", ethers.formatEther(nguBalance));
  
  console.log("\nPrice Information:");
  console.log("- Current Price (NGU per ETH):", priceInEth.toFixed(2));
  console.log("- Current Tick:", Number(slot0.tick));
  console.log("- SqrtPriceX96:", slot0.sqrtPriceX96.toString());

  // Get position information
  const positionManager = new ethers.Contract(
    POSITION_MANAGER_ADDRESS,
    [
      "function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
      "function balanceOf(address) view returns (uint256)",
      "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)"
    ],
    signer
  );

  // Get deployer's positions
  const positionBalance = await positionManager.balanceOf(signer.address);
  console.log("\nLiquidity Positions:", positionBalance.toString());

  if (positionBalance > 0n) {
    const tokenId = await positionManager.tokenOfOwnerByIndex(signer.address, 0);
    const position = await positionManager.positions(tokenId);
    
    console.log("\nPosition Details:");
    console.log("- Token ID:", tokenId.toString());
    console.log("- Liquidity:", position.liquidity.toString());
    console.log("- Tick Range:", Number(position.tickLower), "to", Number(position.tickUpper));
    
    const lowerPrice = tickToPrice(Number(position.tickLower));
    const upperPrice = tickToPrice(Number(position.tickUpper));
    console.log("- Price Range:", 
      `${lowerPrice.toFixed(2)} to ${upperPrice.toFixed(2)} NGU per ETH`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 