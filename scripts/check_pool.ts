import { ethers } from "hardhat";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import IERC20 from "@openzeppelin/contracts/build/contracts/IERC20.json";

async function main() {
  const POOL_ADDRESS = "0xAb9ACD4F51C57F66F3FF48024DB892839f2c0831";
  const NGU_ADDRESS = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
  const WETH_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

  // Connect to contracts
  const pool = new ethers.Contract(POOL_ADDRESS, UniswapV3Pool.abi, ethers.provider);
  const ngu = new ethers.Contract(NGU_ADDRESS, IERC20.abi, ethers.provider);
  const weth = new ethers.Contract(WETH_ADDRESS, IERC20.abi, ethers.provider);

  // Get pool info
  const slot0 = await pool.slot0();
  const liquidity = await pool.liquidity();
  const token0Balance = await ngu.balanceOf(POOL_ADDRESS);
  const token1Balance = await weth.balanceOf(POOL_ADDRESS);

  console.log("Pool State:");
  console.log("- Current Liquidity:", liquidity.toString());
  console.log("- Current Price (sqrt):", slot0.sqrtPriceX96.toString());
  console.log("- NGU Balance:", ethers.formatEther(token0Balance));
  console.log("- WETH Balance:", ethers.formatEther(token1Balance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 