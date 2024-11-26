import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { NumberGoUp } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import "@nomicfoundation/hardhat-chai-matchers"

chai.use(chaiAsPromised)


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

    // Deploy NumberGoUp
    const [owner, recipient] = signers
    const NumberGoUpFactory = await ethers.getContractFactory("NumberGoUp")
    const numberGoUp = (await NumberGoUpFactory.deploy(
      "Number Go Up",
      "NGU",
      18,
      100000n,
      owner.address,
      recipient.address,
      await router.getAddress(),
      await positionManager.getAddress()
    ) as unknown) as NumberGoUp

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
      const { numberGoUp, router, positionManager } = await loadFixture(deployNumberGoUpFixture)
      expect(await numberGoUp.erc721TransferExempt(await router.getAddress())).to.be.true
      expect(await numberGoUp.erc721TransferExempt(await positionManager.getAddress())).to.be.true
    })
  })

  describe("Token Operations", function () {
    it("Should handle ERC20 transfers correctly", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("1")

      // Get initial balances
      const initialBalance = await numberGoUp.erc20BalanceOf(recipient.address)
      console.log("Initial Balance:", initialBalance)

      // Transfer from recipient to third party
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      
      // Check balances after transfer
      const finalRecipientBalance = await numberGoUp.erc20BalanceOf(recipient.address)
      const finalThirdPartyBalance = await numberGoUp.erc20BalanceOf(thirdParty.address)
      
      console.log("Final Recipient Balance:", finalRecipientBalance)
      console.log("Final ThirdParty Balance:", finalThirdPartyBalance)

      expect(finalThirdPartyBalance).to.equal(amount)
    })

    it("Should handle ERC721 transfers correctly", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty] = signers
      const amount = ethers.parseEther("1")

      // Transfer should mint an NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      
      // Check NFT ownership
      const tokenId = 1n
      expect(await numberGoUp.ownerOf(tokenId)).to.equal(thirdParty.address)
      
      console.log("NFT Owner:", await numberGoUp.ownerOf(tokenId))
      console.log("ERC721 Balance:", await numberGoUp.erc721BalanceOf(thirdParty.address))
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

    it("Should prevent transfer of staked NFTs", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      // First transfer to mint an NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n

      // Stake the NFT
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      // Try to transfer while staked
      await expect(
        numberGoUp.connect(thirdParty).transfer(fourthParty.address, amount)
      ).to.be.revertedWith("InsufficientBalance")
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
      const amount = ethers.parseEther("2") // Need extra balance for second stake attempt

      // Mint NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n

      // First stake should succeed
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      
      // Second stake should fail
      await expect(
        numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      ).to.be.revertedWith("NotTokenOwner")
    })

    it("Should prevent unstaking NFT not owned by caller", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      // Mint and stake NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n
      await numberGoUp.connect(thirdParty).stakeNFT(tokenId)

      // Another user tries to unstake
      await expect(
        numberGoUp.connect(fourthParty).unstakeNFT(tokenId)
      ).to.be.revertedWith("NotTokenOwner")
    })

    it("Should prevent staking with insufficient ERC20 balance", async function () {
      const { numberGoUp, recipient, signers } = await loadFixture(deployNumberGoUpFixture)
      const [_, __, thirdParty, fourthParty] = signers
      const amount = ethers.parseEther("1")

      // Mint NFT
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount)
      const tokenId = 1n

      // Transfer away ERC20 balance
      await numberGoUp.connect(thirdParty).transfer(fourthParty.address, amount)

      // Try to stake without ERC20 balance
      await expect(
        numberGoUp.connect(thirdParty).stakeNFT(tokenId)
      ).to.be.revertedWith("InsufficientBalance")
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
})