import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { NumberGoUp } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import "@nomicfoundation/hardhat-chai-matchers"

describe("NumberGoUp", function () {
  async function deployNumberGoUpFixture() {
    const signers = await ethers.getSigners();
    const owner = signers[0];
    
    // Deploy mock contracts first
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    const mockSwapRouter = await MockSwapRouter.deploy();
    
    const MockNonfungiblePositionManager = await ethers.getContractFactory("MockNonfungiblePositionManager");
    const mockPositionManager = await MockNonfungiblePositionManager.deploy();
    
    const NumberGoUpFactory = await ethers.getContractFactory("NumberGoUp");
    const maxSupply = 10_000n;
    const decimals = 18n;
    const units = 10n ** decimals;
    
    const numberGoUp = await NumberGoUpFactory.deploy(
        "Number Go Up",
        "NGU",
        decimals,
        maxSupply,
        owner.address,
        owner.address,
        await mockSwapRouter.getAddress(),
        await mockPositionManager.getAddress()
    ) as unknown as NumberGoUp;

    // Log initial state
    console.log("\nInitial contract state:");
    console.log("Owner balance:", ethers.formatEther(await numberGoUp.balanceOf(owner.address)));
    console.log("Total supply:", ethers.formatEther(await numberGoUp.totalSupply()));
    console.log("Max supply:", maxSupply.toString());

    return { numberGoUp, owner, signers };
  }

  // Add helper function to log state
  async function logState(numberGoUp: any, address: string, label: string) {
    const balance = await numberGoUp.erc721BalanceOf(address);
    const staked = await numberGoUp.getStakedERC721Tokens(address);
    const stakedBalance = await numberGoUp.getStakedERC20Balance(address);
    const erc20Balance = await numberGoUp.balanceOf(address);

    console.log(`\nState for ${label}:`);
    console.log(`- NFT Balance: ${balance}`);
    console.log(`- Staked NFTs: ${staked.length}`);
    console.log(`- ERC20 Balance: ${ethers.formatEther(erc20Balance)}`);
    console.log(`- Staked ERC20: ${ethers.formatEther(stakedBalance)}`);
  }

  async function logQueueState(numberGoUp: any, address: string, label: string) {
    const queueTokens = await numberGoUp.getQueueTokens(address);
    console.log(`\nQueue state for ${label}:`);
    console.log(`- Queue length: ${queueTokens.length}`);
    if (queueTokens.length > 0) {
      console.log(`- Queue tokens: ${queueTokens.map((t: any) => t.toString())}`);
    }
  }

  describe("Initial State", function() {
    it("Should have all tokens minted to initialMintRecipient (owner)", async function() {
      const { numberGoUp, owner } = await loadFixture(deployNumberGoUpFixture);
      
      const maxSupply = ethers.parseEther("10000"); // 10,000 tokens
      expect(await numberGoUp.totalSupply()).to.equal(maxSupply);
      expect(await numberGoUp.balanceOf(owner.address)).to.equal(maxSupply);
      expect(await numberGoUp.erc20BalanceOf(owner.address)).to.equal(maxSupply);
    });
  });

  describe("Basic Transfer Scenarios", function() {
    it("Should handle whole token transfers between non-exempt addresses", async function() {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, user1, user2] = signers;
      const amount = ethers.parseEther("10"); // 10 tokens
      
      // Transfer tokens to user1
      await numberGoUp.connect(owner).transfer(user1.address, amount);
      console.log("\nInitial State:");
      await logState(numberGoUp, user1.address, "User1");
      await logQueueState(numberGoUp, user1.address, "User1");

      // Transfer from user1 to user2
      await numberGoUp.connect(user1).transfer(user2.address, amount);
      
      console.log("\nFinal State:");
      await logState(numberGoUp, user1.address, "User1");
      await logState(numberGoUp, user2.address, "User2");
      await logQueueState(numberGoUp, user1.address, "User1");
      await logQueueState(numberGoUp, user2.address, "User2");

      // Verify balances
      expect(await numberGoUp.balanceOf(user1.address)).to.equal(0n);
      expect(await numberGoUp.balanceOf(user2.address)).to.equal(amount);
      
      // Verify NFT counts
      expect(await numberGoUp.erc721BalanceOf(user1.address)).to.equal(0n);
      expect(await numberGoUp.erc721BalanceOf(user2.address)).to.equal(10n);
    });

    it("Should handle simple fractional token transfer", async function() {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, user1, user2] = signers;
      
      // Transfer 1.5 tokens to user1
      const amount = ethers.parseEther("1.5");
      await numberGoUp.connect(owner).transfer(user1.address, amount);

      // Verify initial state
      expect(await numberGoUp.erc721BalanceOf(user1.address)).to.equal(1n);
      expect(await numberGoUp.balanceOf(user1.address)).to.equal(amount);

      // Transfer 0.7 tokens to user2
      const transferAmount = ethers.parseEther("0.7");
      await numberGoUp.connect(user1).transfer(user2.address, transferAmount);

      // Verify final state
      expect(await numberGoUp.erc721BalanceOf(user1.address)).to.equal(0n);
      expect(await numberGoUp.erc721BalanceOf(user2.address)).to.equal(0n);
      expect(await numberGoUp.balanceOf(user1.address)).to.equal(amount - transferAmount);
      expect(await numberGoUp.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should handle basic exempt/non-exempt transfer", async function() {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, exempt1, nonExempt1] = signers;

      // Set up exempt address
      await numberGoUp.connect(owner).setERC721TransferExempt(exempt1.address, true);

      // Transfer to exempt address
      const amount = ethers.parseEther("2.0");
      await numberGoUp.connect(owner).transfer(exempt1.address, amount);

      // Verify exempt address state
      expect(await numberGoUp.erc721BalanceOf(exempt1.address)).to.equal(0n);
      expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(amount);

      // Transfer to non-exempt address
      await numberGoUp.connect(exempt1).transfer(nonExempt1.address, amount);

      // Verify final states
      expect(await numberGoUp.erc721BalanceOf(exempt1.address)).to.equal(0n);
      expect(await numberGoUp.erc721BalanceOf(nonExempt1.address)).to.equal(2n);
      expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(0n);
      expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(amount);
    });
  });

  describe("Complex transfer scenario tests", () => {
    let numberGoUp: any;
    let owner: any;
    let user1: any;
    let user2: any;
    let exempt1: any;
    let exempt2: any;
    let nonExempt1: any;
    let nonExempt2: any;

    beforeEach(async () => {
      const fixture = await loadFixture(deployNumberGoUpFixture);
      numberGoUp = fixture.numberGoUp;
      [owner, user1, user2, exempt1, exempt2, nonExempt1, nonExempt2] = fixture.signers;

      // Set up exempt addresses
      await numberGoUp.connect(owner).setERC721TransferExempt(exempt1.address, true);
      await numberGoUp.connect(owner).setERC721TransferExempt(exempt2.address, true);

      // Initial setup: Transfer 5.6 tokens to user1
      await numberGoUp.connect(owner).transfer(user1.address, ethers.parseEther("5.6"));
    });

    it("should handle initial transfer of 2.3 tokens correctly", async () => {
      const user1InitialBalance = await numberGoUp.erc721BalanceOf(user1.address);
      const user1InitialStaked = await numberGoUp.getStakedERC721Tokens(user1.address);
      expect(user1InitialBalance).to.equal(5n); // 5.6 tokens = 5 NFTs
      expect(user1InitialStaked.length).to.equal(0); // No staked tokens yet

      // Transfer 2.3 tokens from user1 to user2
      const transferAmount = ethers.parseEther("2.3");
      await numberGoUp.connect(user1).transfer(user2.address, transferAmount);

      // Verify NFT state after first transfer
      const user1AfterTransferBalance = await numberGoUp.erc721BalanceOf(user1.address);
      const user2AfterTransferBalance = await numberGoUp.erc721BalanceOf(user2.address);
      const user1AfterTransferStaked = await numberGoUp.getStakedERC721Tokens(user1.address);
      const user2AfterTransferStaked = await numberGoUp.getStakedERC721Tokens(user2.address);

      expect(user1AfterTransferBalance).to.equal(3n); // 3.3 tokens = 3 NFTs
      expect(user2AfterTransferBalance).to.equal(2n); // 2.3 tokens = 2 NFTs
      expect(user1AfterTransferStaked.length).to.equal(0);
      expect(user2AfterTransferStaked.length).to.equal(0);
    });

    it("should handle receiving 0.7 tokens correctly", async () => {
      // First do the initial 2.3 token transfer
      await numberGoUp.connect(user1).transfer(user2.address, ethers.parseEther("2.3"));

      // Now test small fractional amounts
      const smallAmount = ethers.parseEther("0.7");
      await numberGoUp.connect(user2).transfer(user1.address, smallAmount);

      // Verify NFT state after small amount transfer
      const user1AfterSmallBalance = await numberGoUp.erc721BalanceOf(user1.address);
      expect(user1AfterSmallBalance).to.equal(4n); // 4.0 tokens = 4 NFTs
    });

    it("should handle transfer of 0.5 tokens correctly", async () => {
      // First do the previous transfers
      await numberGoUp.connect(user1).transfer(user2.address, ethers.parseEther("2.3"));
      await numberGoUp.connect(user2).transfer(user1.address, ethers.parseEther("0.7"));

      // Transfer 0.5 tokens
      const smallTransfer = ethers.parseEther("0.5");
      await numberGoUp.connect(user1).transfer(user2.address, smallTransfer);

      // Verify final NFT state
      const user1FinalBalance = await numberGoUp.erc721BalanceOf(user1.address);
      const user2FinalBalance = await numberGoUp.erc721BalanceOf(user2.address);
      const user1FinalStaked = await numberGoUp.getStakedERC721Tokens(user1.address);
      const user2FinalStaked = await numberGoUp.getStakedERC721Tokens(user2.address);

      expect(user1FinalBalance).to.equal(3n); // 3.5 tokens = 3 NFTs
      expect(user2FinalBalance).to.equal(2n); // 2.8 tokens = 2 NFTs
      expect(user1FinalStaked.length).to.equal(0);
      expect(user2FinalStaked.length).to.equal(0);
    });

    it("should handle exempt to non-exempt transfer correctly", async () => {
      // Transfer from exempt to non-exempt
      await numberGoUp.connect(owner).transfer(exempt1.address, ethers.parseEther("2.3"));
      await numberGoUp.connect(exempt1).transfer(nonExempt1.address, ethers.parseEther("2.3"));

      // Verify NFT state for exempt -> non-exempt
      const exempt1Balance = await numberGoUp.erc721BalanceOf(exempt1.address);
      const nonExempt1Balance = await numberGoUp.erc721BalanceOf(nonExempt1.address);
      expect(exempt1Balance).to.equal(0n); // Exempt address should have no NFTs
      expect(nonExempt1Balance).to.equal(2n); // 2.3 tokens = 2 NFTs

      await logState(numberGoUp, exempt1.address, "Exempt1");
      await logState(numberGoUp, nonExempt1.address, "NonExempt1");
    });

    it("should handle non-exempt to exempt transfer correctly", async () => {
      // First set up nonExempt1 with some tokens
      await numberGoUp.connect(owner).transfer(nonExempt1.address, ethers.parseEther("2.3"));

      // Transfer from non-exempt to exempt
      await numberGoUp.connect(nonExempt1).transfer(exempt2.address, ethers.parseEther("1.1"));

      // Verify NFT state for non-exempt -> exempt
      const nonExempt1AfterBalance = await numberGoUp.erc721BalanceOf(nonExempt1.address);
      const exempt2Balance = await numberGoUp.erc721BalanceOf(exempt2.address);
      expect(nonExempt1AfterBalance).to.equal(1n); // Should have 1 NFT from remaining 1.2 tokens
      expect(exempt2Balance).to.equal(0n); // Exempt address should have no NFTs

      // Verify ERC20 balances
      expect(await numberGoUp.erc20BalanceOf(nonExempt1.address)).to.equal(ethers.parseEther("1.2"));
      expect(await numberGoUp.erc20BalanceOf(exempt2.address)).to.equal(ethers.parseEther("1.1"));
    });

    it("should handle exempt to exempt transfer correctly", async () => {
      // Set up exempt1 with tokens
      await numberGoUp.connect(owner).transfer(exempt1.address, ethers.parseEther("3.3"));

      // Transfer between exempt addresses
      await numberGoUp.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1.5"));

      // Verify NFT state for exempt -> exempt
      const exempt1AfterBalance = await numberGoUp.erc721BalanceOf(exempt1.address);
      const exempt2AfterBalance = await numberGoUp.erc721BalanceOf(exempt2.address);
      expect(exempt1AfterBalance).to.equal(0n); // Exempt addresses should have no NFTs
      expect(exempt2AfterBalance).to.equal(0n);

      await logState(numberGoUp, exempt1.address, "Exempt1");
      await logState(numberGoUp, exempt2.address, "Exempt2");
    });

    it("should handle non-exempt to non-exempt transfer correctly", async () => {
      // Set up nonExempt1 with tokens
      await numberGoUp.connect(owner).transfer(nonExempt1.address, ethers.parseEther("4.2"));

      // Transfer between non-exempt addresses
      await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, ethers.parseEther("2.7"));

      // Verify NFT state for non-exempt -> non-exempt
      const nonExempt1FinalBalance = await numberGoUp.erc721BalanceOf(nonExempt1.address);
      const nonExempt2FinalBalance = await numberGoUp.erc721BalanceOf(nonExempt2.address);
      expect(nonExempt1FinalBalance).to.equal(1n); // 1.5 tokens = 1 NFT
      expect(nonExempt2FinalBalance).to.equal(2n); // 2.7 tokens = 2 NFTs

      await logState(numberGoUp, nonExempt1.address, "NonExempt1");
      await logState(numberGoUp, nonExempt2.address, "NonExempt2");
    });
  });

  describe("Staking and Queue Order Tests", function() {
    it("Should maintain correct queue order with unstaked tokens at front", async function() {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, user1] = signers;
      
      // First transfer some tokens to user1 to get NFTs
      await numberGoUp.connect(owner).transfer(user1.address, ethers.parseEther("5"));
      
      console.log("\nInitial state:");
      await logState(numberGoUp, user1.address, "User1");
      await logQueueState(numberGoUp, user1.address, "User1");
      
      // Get initial queue and prepare NFTs to stake. Skipping ID 0 but 0 is still valid. 
      const initialQueue = await numberGoUp.getQueueTokens(user1.address);
      const nftsToStake = [1, 2, 3];
      await numberGoUp.connect(user1).stake(nftsToStake);
      
      console.log("\nAfter staking: 1, 2, 3");
      await logState(numberGoUp, user1.address, "User1");
      await logQueueState(numberGoUp, user1.address, "User1");
      
      // Get staked NFTs and verify count
      const stakedNFTs = await numberGoUp.getStakedERC721Tokens(user1.address);
      expect(stakedNFTs.length).to.equal(3);
      
      const nftsToUnstake = [1, 3]
      // Unstake the NFTs
      // Queue is 0, 4
      // Unstake 1 should be 1, 0, 4
      // unstake 3 should be 3, 1, 0, 4
      await numberGoUp.connect(user1).unstake(nftsToUnstake);
      
      console.log("\nAfter unstaking: 1, 3");
      await logState(numberGoUp, user1.address, "User1");
      await logQueueState(numberGoUp, user1.address, "User1");
      
      // Get final queue and verify order
      const finalQueue = await numberGoUp.getQueueTokens(user1.address);
      
      const expectedValues = [3, 1, 0, 4]
      // Verify unstaked NFTs are at the front (first 3 positions)
      for (let i = 0; i < 2; i++) {
        expect(finalQueue[i]).to.equal(expectedValues[i]);
      }
      
      // Verify original non-staked NFTs are at the back
      expect(finalQueue[2]).to.equal(0);
      expect(finalQueue[3]).to.equal(4);
    });
  });
});