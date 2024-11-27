import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { NumberGoUp } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import "@nomicfoundation/hardhat-chai-matchers"

describe("NumberGoUp", function () {
  async function deployNumberGoUpFixture() {
    const signers = await ethers.getSigners()

    // Deploy Uniswap v3 factory
    const uniswapV3FactorySource = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json")
    const uniswapV3Factory = await new ethers.ContractFactory(
      uniswapV3FactorySource.abi,
      uniswapV3FactorySource.bytecode,
      signers[0]
    ).deploy()

    // Deploy WETH
    const wethSource = require("@uniswap/v2-periphery/build/WETH9.json")
    const weth = await new ethers.ContractFactory(
      wethSource.interface,
      wethSource.bytecode,
      signers[0]
    ).deploy()

    // Deploy Position Manager
    const positionManagerSource = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")
    const positionManager = await new ethers.ContractFactory(
      positionManagerSource.abi,
      positionManagerSource.bytecode,
      signers[0]
    ).deploy(
      await uniswapV3Factory.getAddress(),
      await weth.getAddress(),
      ethers.ZeroAddress
    )
    console.log("NFPM from deployment: ", await positionManager.getAddress())

    // Deploy Router
    const routerSource = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json")
    const router = await new ethers.ContractFactory(
      routerSource.abi,
      routerSource.bytecode,
      signers[0]
    ).deploy(
      await uniswapV3Factory.getAddress(),
      await weth.getAddress()
    )
    console.log("Router from deployment: ", await router.getAddress())

    // Deploy NumberGoUp
    const [owner, recipient] = signers
    const NumberGoUpFactory = await ethers.getContractFactory("NumberGoUp")
    const routerAddress = await router.getAddress()
    const positionManagerAddress = await positionManager.getAddress()
    const numberGoUp = (await NumberGoUpFactory.deploy(
      "Number Go Up",
      "NGU",
      18,
      100000n,
      owner.address,
      owner.address,
      routerAddress,
      positionManagerAddress
    ) as unknown) as NumberGoUp

    // Verify exemption status
    console.log("\nExemption Status:");
    console.log("Owner exempt status:", await numberGoUp.erc721TransferExempt(owner.address));
    console.log("Initial ERC20 balance:", await numberGoUp.erc20BalanceOf(owner.address));
    console.log("Initial minted value:", await numberGoUp.minted());

    return { numberGoUp, owner, recipient, router, positionManager, signers }
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { numberGoUp, owner } = await loadFixture(deployNumberGoUpFixture)
      expect(await numberGoUp.owner()).to.equal(owner.address)
    })

    it("Should set the correct token URI base", async function () {
      const { numberGoUp } = await loadFixture(deployNumberGoUpFixture)
      expect(await numberGoUp._uriBase()).to.equal("https://ipfs.io/ipfs/QmUMUSjDwvMqgbPneHnvpQAt8cEBDEDgDZUyYM93qazLga/")
    })

    it("Should exempt Uniswap contracts", async function () {
      const { numberGoUp, router, positionManager, owner } = await loadFixture(deployNumberGoUpFixture)
      const routerAddress = await router.getAddress()
      const positionManagerAddress = await positionManager.getAddress()
      
      // Add deployment logging
      console.log("\n=== Contract Addresses ===")
      console.log("NumberGoUp Address:", await numberGoUp.getAddress())
      console.log("Position Manager Address:", positionManagerAddress)
      console.log("Router Address:", routerAddress)

      // Add constructor params logging
      console.log("\n=== Constructor Parameters ===")
      console.log("Router Address used in constructor:", await router.getAddress())
      console.log("Position Manager Address used in constructor:", await positionManager.getAddress())

      // Check exemption status with try-catch for detailed errors
      console.log("\n=== Exemption Status ===")
      try {
        const isExemptedRouter = await numberGoUp.erc721TransferExempt(routerAddress)
        console.log("Router Exemption Status:", isExemptedRouter)
      } catch (error) {
        console.error("Router Exemption Check Failed:", error)
      }
      try {
        const isExemptOwner = await numberGoUp.erc721TransferExempt(owner.address)
        console.log("Owner Exemption Status:", isExemptOwner)
      } catch (error) {
        console.error("Owner Exemption Check Failed:", error)
      }
      try {
        const isExemptedPositionManager = await numberGoUp.erc721TransferExempt(positionManagerAddress)
        console.log("Position Manager Exemption Status:", isExemptedPositionManager)
      } catch (error) {
        console.error("Position Manager Exemption Check Failed:", error)
      }

      // Original assertions with more context
      const isExemptedRouter = await numberGoUp.erc721TransferExempt(routerAddress)
      const isExemptedPositionManager = await numberGoUp.erc721TransferExempt(positionManagerAddress)
      
      expect(isExemptedRouter, "Router should be exempt").to.be.true
      expect(isExemptedPositionManager, "Position Manager should be exempt").to.be.true
    })
  })

  describe("Token Operations", function () {
    it("Should handle ERC20 transfers correctly", async function () {
      const { numberGoUp, recipient, owner, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("1")

      // Get initial balances
      const initialBalance = await numberGoUp.erc20BalanceOf(owner.address)
      console.log("Initial Balance of Owner:", initialBalance)

      // Transfer from owner to third party (owner has the initial supply)
      await numberGoUp.connect(owner).transfer(thirdParty.address, amount) 
      
      // Check balances after transfer
      const finalOwnerBalance = await numberGoUp.erc20BalanceOf(owner.address)
      const finalThirdPartyBalance = await numberGoUp.erc20BalanceOf(thirdParty.address)
      
      console.log("Final Owner Balance:", finalOwnerBalance)
      console.log("Final ThirdParty Balance:", finalThirdPartyBalance)

      expect(finalThirdPartyBalance).to.equal(amount)
    })

    it("Should handle ERC721 transfers correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("1")

      // Transfer should mint an NFT (from owner who has the initial supply)
      await numberGoUp.connect(owner).transfer(thirdParty.address, amount)
      
      // Check NFT ownership
      const tokenId = 1n
      expect(await numberGoUp.ownerOf(tokenId)).to.equal(thirdParty.address)
      
      console.log("NFT Owner:", await numberGoUp.ownerOf(tokenId))
      console.log("ERC721 Balance:", await numberGoUp.erc721BalanceOf(thirdParty.address))
    })

    it("Should prevent transfer of staked NFTs", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      await expect(
        numberGoUp.connect(thirdParty).transfer(fourthParty.address, amount)
      ).to.be.revertedWithCustomError(numberGoUp, "InsufficientBalance")
    })
  })

  describe("Staking", function () {
    it("Should allow staking an NFT", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("1")

      // First transfer to mint an NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n

      console.log("\nBefore Staking:")
      console.log("Owner ERC20 Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("Owner Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      console.log("NFT Owner:", await numberGoUp.ownerOf(tokenId))

      // Get queue contents before staking
      const queueBefore = await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10)
      console.log("Queue before staking:", queueBefore)

      // Stake the NFT
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      console.log("\nAfter Staking:")
      console.log("Owner ERC20 Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("Owner Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      
      const stakedTokens = await numberGoUp.getStakedTokens(thirdParty.address)
      console.log("Staked Tokens:", stakedTokens)

      // Verify staking
      expect(await numberGoUp.getStakedERC20Balance(thirdParty.address)).to.equal(amount)
      expect(stakedTokens).to.include(tokenId)
    })

    it("Should allow unstaking and subsequent transfer", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      // Initial transfer and stake
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      console.log("\nBefore Unstaking:")
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))

      // Unstake
      await numberGoUp.connect(thirdParty).unstakeNFT(tokenId)

      console.log("\nAfter Unstaking:")
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))

      // Now transfer should work
      await numberGoUp.connect(thirdParty).transfer(fourthParty.address, amount)
      expect(await numberGoUp.ownerOf(tokenId)).to.equal(fourthParty.address)
    })
  })

  describe("Staking Edge Cases", function () {
    it("Should prevent staking the same NFT twice", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("2")

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      
      await expect(
        numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "NotTokenOwner")
    })

    it("Should prevent unstaking NFT not owned by caller", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      await expect(
        numberGoUp.connect(fourthParty).unstakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "NotTokenOwner")
    })

    it("Should prevent staking with insufficient ERC20 balance", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).transfer(fourthParty.address, amount)

      await expect(
        numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "InsufficientBalance")
    })

    it("Should handle multiple stake/unstake operations correctly", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("3") // Mint 3 NFTs

      // Mint NFTs
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenIds = [1n, 2n, 3n]

      console.log("\nInitial State:")
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("Queue Length:", await numberGoUp.getQueueLength(thirdParty.address))

      // Stake all NFTs
      await numberGoUp.connect(thirdParty).stakeMultipleNFTs(tokenIds)

      console.log("\nAfter Staking:")
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      console.log("Queue Length:", await numberGoUp.getQueueLength(thirdParty.address))

      // Unstake one NFT
      await numberGoUp.connect(thirdParty).unstakeNFT(tokenIds[0])

      console.log("\nAfter Unstaking One:")
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(thirdParty.address))
      console.log("Queue Length:", await numberGoUp.getQueueLength(thirdParty.address))
      console.log("Queue Contents:", await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10))

      // Verify balances
      expect(await numberGoUp.getStakedERC20Balance(thirdParty.address)).to.equal(ethers.parseEther("2"))
      expect(await numberGoUp.getQueueLength(thirdParty.address)).to.equal(1n)
    })

    it("Should maintain correct queue order during stake/unstake operations", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("3")

      // Mint NFTs
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      
      console.log("\nInitial Queue:")
      const initialQueue = await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10)
      console.log(initialQueue)

      // Stake first and last NFTs
      await numberGoUp.connect(thirdParty).stakeNFT(1n)
      await numberGoUp.connect(thirdParty).stakeNFT(3n)

      console.log("\nQueue After Staking 1 and 3:")
      const midQueue = await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10)
      console.log(midQueue)

      // Unstake them in reverse order
      await numberGoUp.connect(thirdParty).unstakeNFT(3n)
      await numberGoUp.connect(thirdParty).unstakeNFT(1n)

      console.log("\nFinal Queue:")
      const finalQueue = await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10)
      console.log(finalQueue)

      // Verify queue length and contents
      expect(await numberGoUp.getQueueLength(thirdParty.address)).to.equal(3n)
    })
  })

  describe("Advanced Token Operations", function () {
    it("Should handle fractional transfers correctly", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("0.5") // Half a token

      console.log("\nBefore Transfer:")
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address))
      console.log("Recipient NFT Balance:", await numberGoUp.erc721BalanceOf(recipient.address))

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)

      console.log("\nAfter Transfer:")
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address))
      console.log("ThirdParty Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("ThirdParty NFT Balance:", await numberGoUp.erc721BalanceOf(thirdParty.address))

      // Should not mint NFT for fractional transfer
      expect(await numberGoUp.erc721BalanceOf(thirdParty.address)).to.equal(0n)
    })

    it("Should handle multiple transfers and maintain correct balances", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("2.5") // 2.5 tokens

      console.log("\nInitial State:")
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address))

      // First transfer
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      
      console.log("\nAfter First Transfer:")
      console.log("ThirdParty Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("ThirdParty NFTs:", await numberGoUp.erc721BalanceOf(thirdParty.address))

      // Second transfer of half
      await numberGoUp.connect(thirdParty).transfer(fourthParty.address, ethers.parseEther("1.25"))

      console.log("\nAfter Second Transfer:")
      console.log("ThirdParty Balance:", await numberGoUp.erc20BalanceOf(thirdParty.address))
      console.log("FourthParty Balance:", await numberGoUp.erc20BalanceOf(fourthParty.address))
      console.log("ThirdParty NFTs:", await numberGoUp.erc721BalanceOf(thirdParty.address))
      console.log("FourthParty NFTs:", await numberGoUp.erc721BalanceOf(fourthParty.address))
    })
  })

  describe("Queue Management", function () {
    it("Should maintain correct queue order during transfers", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("3") // 3 tokens to mint 3 NFTs

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)

      console.log("\nInitial Queue State:")
      console.log("Queue Length:", await numberGoUp.getQueueLength(thirdParty.address))
      console.log("Queue Contents:", await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10))

      // Get first token from queue
      const firstToken = await numberGoUp.getNextQueueId(thirdParty.address)
      console.log("First Token in Queue:", firstToken)

      // Get specific token at index
      const tokenAtIndex1 = await numberGoUp.getIdAtQueueIndex(thirdParty.address, 1)
      console.log("Token at Index 1:", tokenAtIndex1)

      expect(await numberGoUp.getQueueLength(thirdParty.address)).to.equal(3n)
    })

    it("Should handle queue operations during stake/unstake cycles", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("2")

      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)

      console.log("\nInitial State:")
      console.log("Queue Contents:", await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10))

      // Stake first NFT
      await numberGoUp.connect(thirdParty).stakeNFT(1n)
      
      console.log("\nAfter Staking:")
      console.log("Queue Contents:", await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10))
      console.log("Staked Tokens:", await numberGoUp.getStakedTokens(thirdParty.address))

      // Unstake NFT
      await numberGoUp.connect(thirdParty).unstakeNFT(1n)

      console.log("\nAfter Unstaking:")
      console.log("Queue Contents:", await numberGoUp.getERC721TokensInQueue(thirdParty.address, 10))
      console.log("Staked Tokens:", await numberGoUp.getStakedTokens(thirdParty.address))

      // Verify queue state
      expect(await numberGoUp.getQueueLength(thirdParty.address)).to.equal(2n)
    })
  })
})