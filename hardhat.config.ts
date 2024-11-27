import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  typechain: {
    externalArtifacts: [
      'node_modules/@uniswap/v3-core/artifacts/contracts/**/*.json',
      'node_modules/@uniswap/v3-periphery/artifacts/contracts/**/*.json'
    ],
  },
  networks: {
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },
  },
};

export default config;
