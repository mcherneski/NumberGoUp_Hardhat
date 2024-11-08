import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const numberGoUpModule = buildModule("NumberGoUpModule_v2", (m) => {
  const name = "Number Go Up";
  const symbol = "NGU";
  const decimals = 18;
  const maxTotalSupply = 100000; // Example max total supply
  const initialOwner = "0x504AE5Caf5462654806F83e3C508A1A105887876"; // Replace with actual address
  const initialMintRecipient = "0x504AE5Caf5462654806F83e3C508A1A105887876"; // Replace with actual address
  const uniswapSwapRouter = "0x050E797f3625EC8785265e1d9BDd4799b97528A1"; // Replace with actual address
  const uniswapV3NonfungiblePositionManager = "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2"; // Replace with actual address

  const numberGoUp = m.contract("NumberGoUp", [
    name,
    symbol,
    decimals,
    maxTotalSupply,
    initialOwner,
    initialMintRecipient,
    uniswapSwapRouter,
    uniswapV3NonfungiblePositionManager
  ]);

  return { numberGoUp };
});

export default numberGoUpModule;

