import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NumberGoUpModule", (m) => {
  // Define the constructor parameters for the NumberGoUp contract
  const name = "NumberGoUp";
  const symbol = "NGU";
  const decimals = 18;
  const maxTotalSupply = 1000000; // Example max total supply
  const initialOwner = "0x504AE5Caf5462654806F83e3C508A1A105887876"; // Replace with actual address
  const initialMintRecipient = "0x504AE5Caf5462654806F83e3C508A1A105887876"; // Replace with actual address
  const uniswapSwapRouter = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4"; // Replace with actual address
  const uniswapV3NonfungiblePositionManager = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2"; // Replace with actual address

  // Deploy the NumberGoUp contract
  const numberGoUp = m.contract("NumberGoUp",
    [
      name,
      symbol,
      decimals,
      maxTotalSupply,
      initialOwner,
      initialMintRecipient,
      uniswapSwapRouter,
      uniswapV3NonfungiblePositionManager,
    ],
  );

  return { numberGoUp };
});

