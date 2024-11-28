import { ethers } from "hardhat"
import { abi as IUniswapV3FactoryABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json'

async function main() {
   const [deployer] = await ethers.getSigners();

   const NGU_ADDRESS = '0x2db40d56E523dFA2ED881D39fD5866bd1A5Db9a5'
   const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
   const FACTORY_ADDRESS = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'

   const factory = await ethers.getContractAt(
      IUniswapV3FactoryABI,
      FACTORY_ADDRESS,
      deployer
   )

   let poolAddress = await factory.getPool(NGU_ADDRESS, WETH_ADDRESS, 100)
   
   if (poolAddress !== ethers.ZeroAddress) {
      console.log(`Pool already exists at ${poolAddress}`)
   } else {
      const tx = await factory.createPool(NGU_ADDRESS, WETH_ADDRESS, 100)
      const receipt = await tx.wait()
      console.log(receipt)
      console.log(`Pool created at ${receipt.transactionHash}`)
      poolAddress = receipt.events?.find(e => e.event === 'PoolCreated')?.args?.pool

   }
}

main()
.then(() => process.exit(0))
.catch((error) => {
   console.error(error)
   process.exit(1)
})