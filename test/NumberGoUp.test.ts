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
    
    const NumberGoUpFactory = await ethers.getContractFactory("NumberGoUp");
    const maxSupply = 100000n;
    const decimals = 18n;
    const units = 10n ** decimals;

    // Deploy with mock addresses for Uniswap contracts
    const mockAddress = "0x0000000000000000000000000000000000000001";
    
    const numberGoUp = (await NumberGoUpFactory.deploy(
        "Number Go Up",
        "NGU",
        decimals,
        maxSupply,
        owner.address,
        owner.address,
        mockAddress, // mock router
        mockAddress  // mock position manager
    ) as unknown) as NumberGoUp;

    return { numberGoUp, owner, signers };
  }

  // Add helper function to log state
  async function logState(numberGoUp: any, address: string, label: string) {
    const owned = await numberGoUp.getOwnedTokens(address);
    const staked = await numberGoUp.getStakedTokens(address);
    const stakedBalance = await numberGoUp.getStakedERC20Balance(address);
    const erc20Balance = await numberGoUp.erc20BalanceOf(address);
    
    console.log(`\n=== State for ${label} (${address}) ===`);
    console.log("Owned NFTs:", owned.map((id: bigint) => id.toString()));
    console.log("Staked NFTs:", staked.map((id: bigint) => id.toString()));
    console.log("ERC20 Balance:", erc20Balance.toString());
    console.log("Staked ERC20 Balance:", stakedBalance.toString());
  }

  async function logQueueState(numberGoUp: any, address: string, label: string) {
    // Get queue tokens directly using the new function
    const queueTokens = await numberGoUp.getQueueTokens(address);
    const queueIds = queueTokens.map((id: bigint) => Number(id));
    
    console.log(`\n=== Queue State for ${label} (${address}) ===`);
    console.log("Queue tokens (in order):", queueIds);
    return queueIds;
  }

  describe("Staking Operations", function () {
    it("Should stake a single token correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, staker] = signers;
      const amount = ethers.parseEther("1"); // 1 whole token

      // Transfer a token to the staker
      await numberGoUp.connect(owner).transfer(staker.address, amount);
      await logState(numberGoUp, staker.address, "Staker before staking");

      // Get the token ID from the staker's owned tokens
      const tokenIds = await numberGoUp.getOwnedTokens(staker.address);
      expect(tokenIds.length).to.equal(1);

      // Stake the token
      await numberGoUp.connect(staker).stake([tokenIds[0]]);
      await logState(numberGoUp, staker.address, "Staker after staking");

      // Verify staking state
      const stakedTokens = await numberGoUp.getStakedTokens(staker.address);
      expect(stakedTokens.length).to.equal(1);
      expect(stakedTokens[0]).to.equal(tokenIds[0]);
      expect(await numberGoUp.getStakedERC20Balance(staker.address)).to.equal(amount);
    });

    it("Should stake multiple tokens correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, staker] = signers;
      const amount = ethers.parseEther("3"); // 3 whole tokens

      // Transfer tokens to the staker
      await numberGoUp.connect(owner).transfer(staker.address, amount);
      await logState(numberGoUp, staker.address, "Staker before staking");

      // Get the token IDs from the staker's owned tokens
      const tokenIds = await numberGoUp.getOwnedTokens(staker.address);
      expect(tokenIds.length).to.equal(3);

      // Convert BigInts to numbers for the array
      const tokenIdsToStake = tokenIds.map(id => Number(id));

      // Stake all tokens
      await numberGoUp.connect(staker).stake(tokenIdsToStake);
      await logState(numberGoUp, staker.address, "Staker after staking");

      // Verify staking state
      const stakedTokens = await numberGoUp.getStakedTokens(staker.address);
      expect(stakedTokens.length).to.equal(3);
      expect(await numberGoUp.getStakedERC20Balance(staker.address)).to.equal(amount);
    });

    it("Should unstake tokens correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, staker] = signers;
      const amount = ethers.parseEther("2"); // 2 whole tokens

      // Transfer and stake tokens
      await numberGoUp.connect(owner).transfer(staker.address, amount);
      const tokenIds = await numberGoUp.getOwnedTokens(staker.address);
      const tokenIdsToStake = tokenIds.map(id => Number(id));
      await numberGoUp.connect(staker).stake(tokenIdsToStake);
      await logState(numberGoUp, staker.address, "Staker after staking");

      // Unstake one token
      await numberGoUp.connect(staker).unstake([Number(tokenIds[0])]);
      await logState(numberGoUp, staker.address, "Staker after unstaking one token");

      // Verify unstaking state
      const stakedTokens = await numberGoUp.getStakedTokens(staker.address);
      expect(stakedTokens.length).to.equal(1);
      expect(await numberGoUp.getStakedERC20Balance(staker.address)).to.equal(ethers.parseEther("1"));
    });

    it("Should handle staking errors correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, staker] = signers;
      const amount = ethers.parseEther("1");

      // Transfer a token to the staker
      await numberGoUp.connect(owner).transfer(staker.address, amount);
      const tokenIds = await numberGoUp.getOwnedTokens(staker.address);

      // Try to stake with empty array
      await expect(
        numberGoUp.connect(staker).stake([])
      ).to.be.revertedWithCustomError(numberGoUp, "EmptyStakingArray");

      // Try to stake non-existent token (should fail with NotTokenOwner)
      await expect(
        numberGoUp.connect(staker).stake([999999])
      ).to.be.revertedWithCustomError(numberGoUp, "NotTokenOwner");

      // Stake the valid token
      await numberGoUp.connect(staker).stake([Number(tokenIds[0])]);
      
      // Try to stake the same token again (should fail with insufficient balance since token is already staked)
      await expect(
        numberGoUp.connect(staker).stake([Number(tokenIds[0])])
      ).to.be.revertedWithCustomError(numberGoUp, "StakerInsufficientBalance");
    });
  });

  describe("Transfer Scenarios", function () {
    it("Should handle transfers from non-exempt to exempt users correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, nonExemptUser, exemptUser] = signers;
      const amount = ethers.parseEther("2");

      // Make exemptUser exempt
      await numberGoUp.setERC721TransferExempt(exemptUser.address, true);
      expect(await numberGoUp.erc721TransferExempt(exemptUser.address)).to.be.true;

      // Transfer to non-exempt user first
      await numberGoUp.connect(owner).transfer(nonExemptUser.address, amount);
      await logState(numberGoUp, nonExemptUser.address, "Non-exempt user after receiving tokens");

      // Transfer from non-exempt to exempt user
      await numberGoUp.connect(nonExemptUser).transfer(exemptUser.address, ethers.parseEther("1"));
      
      await logState(numberGoUp, nonExemptUser.address, "Non-exempt user after transfer");
      await logState(numberGoUp, exemptUser.address, "Exempt user after receiving tokens");

      // Verify exempt user got ERC20 but no NFT
      expect(await numberGoUp.erc20BalanceOf(exemptUser.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(exemptUser.address)).to.equal(0);
    });

    it("Should handle transfers between non-exempt users correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, nonExemptUser1, nonExemptUser2] = signers;
      const amount = ethers.parseEther("2");

      // Initial transfer to first non-exempt user
      await numberGoUp.connect(owner).transfer(nonExemptUser1.address, amount);
      await logState(numberGoUp, nonExemptUser1.address, "First non-exempt user after receiving tokens");

      // Transfer between non-exempt users
      await numberGoUp.connect(nonExemptUser1).transfer(nonExemptUser2.address, ethers.parseEther("1"));
      
      await logState(numberGoUp, nonExemptUser1.address, "First non-exempt user after transfer");
      await logState(numberGoUp, nonExemptUser2.address, "Second non-exempt user after receiving tokens");

      // Verify both ERC20 and ERC721 balances
      expect(await numberGoUp.erc20BalanceOf(nonExemptUser1.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(nonExemptUser1.address)).to.equal(1);
      expect(await numberGoUp.erc20BalanceOf(nonExemptUser2.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(nonExemptUser2.address)).to.equal(1);
    });

    it("Should handle transfers between exempt users correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, exemptUser1, exemptUser2] = signers;
      const amount = ethers.parseEther("2");

      // Make both users exempt
      await numberGoUp.setERC721TransferExempt(exemptUser1.address, true);
      await numberGoUp.setERC721TransferExempt(exemptUser2.address, true);

      // Transfer to first exempt user
      await numberGoUp.connect(owner).transfer(exemptUser1.address, amount);
      await logState(numberGoUp, exemptUser1.address, "First exempt user after receiving tokens");

      // Transfer between exempt users
      await numberGoUp.connect(exemptUser1).transfer(exemptUser2.address, ethers.parseEther("1"));
      
      await logState(numberGoUp, exemptUser1.address, "First exempt user after transfer");
      await logState(numberGoUp, exemptUser2.address, "Second exempt user after receiving tokens");

      // Verify only ERC20 balances changed, no NFTs involved
      expect(await numberGoUp.erc20BalanceOf(exemptUser1.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(exemptUser1.address)).to.equal(0);
      expect(await numberGoUp.erc20BalanceOf(exemptUser2.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(exemptUser2.address)).to.equal(0);
    });
  });

  describe("NFT Metadata", function () {
    it("Should return correct metadata URI for NFT IDs", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, nonExemptUser] = signers;
      const amount = ethers.parseEther("1");

      // Transfer to mint an NFT
      await numberGoUp.connect(owner).transfer(nonExemptUser.address, amount);
      const tokenIds = await numberGoUp.getOwnedTokens(nonExemptUser.address);
      expect(tokenIds.length).to.equal(1);

      // Get and verify metadata URI
      const uri = await numberGoUp.tokenURI(tokenIds[0]);
      console.log(`\nMetadata URI for token ${tokenIds[0]}: ${uri}`);
      
      // Verify URI format
      expect(uri).to.match(/^https:\/\/ipfs\.io\/ipfs\/.*\.json$/);
      expect(uri).to.include(await numberGoUp._uriBase());
    });
  });

  describe("Post-Staking Trading", function () {
    it("Should maintain correct queue order after staking and trading", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, trader1, trader2] = signers;
      const amount = ethers.parseEther("3");

      // Initial setup: Transfer tokens to trader1
      await numberGoUp.connect(owner).transfer(trader1.address, amount);
      await logState(numberGoUp, trader1.address, "Trader1 after receiving tokens");

      // Stake one token
      const tokenIds = await numberGoUp.getOwnedTokens(trader1.address);
      await numberGoUp.connect(trader1).stake([Number(tokenIds[0])]);
      await logState(numberGoUp, trader1.address, "Trader1 after staking");

      // Transfer one token to trader2
      await numberGoUp.connect(trader1).transfer(trader2.address, ethers.parseEther("1"));
      await logState(numberGoUp, trader1.address, "Trader1 after transfer");
      await logState(numberGoUp, trader2.address, "Trader2 after receiving token");

      // Verify balances and ownership
      expect(await numberGoUp.erc20BalanceOf(trader1.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(trader1.address)).to.equal(2); // 1 staked, 1 in queue
      expect(await numberGoUp.erc20BalanceOf(trader2.address)).to.equal(ethers.parseEther("1"));
      expect(await numberGoUp.erc721BalanceOf(trader2.address)).to.equal(1);

      // Unstake the token
      await numberGoUp.connect(trader1).unstake([Number(tokenIds[0])]);
      await logState(numberGoUp, trader1.address, "Trader1 after unstaking");

      // Get final state of owned tokens
      const trader1Owned = await numberGoUp.getOwnedTokens(trader1.address);
      expect(trader1Owned.length).to.equal(2);

      // Verify the unstaked token is added to owned tokens
      const hasUnstakedToken = trader1Owned.some(id => id.toString() === tokenIds[0].toString());
      expect(hasUnstakedToken, "Unstaked token should be in owned tokens").to.be.true;

      // Verify ERC20 balance is restored
      expect(await numberGoUp.erc20BalanceOf(trader1.address)).to.equal(ethers.parseEther("2"));
      expect(await numberGoUp.getStakedERC20Balance(trader1.address)).to.equal(0);
    });
  });

  describe("Realistic Game Scenarios", function () {
    it("Should handle complex staking and trading flow", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, player1, player2, player3] = signers;
      const initialAmount = ethers.parseEther("10");

      console.log("\n=== Starting Complex Game Scenario ===");
      
      // Initial transfer of 10 tokens to player1
      await numberGoUp.connect(owner).transfer(player1.address, initialAmount);
      console.log("\nAfter initial 10 token transfer to Player1:");
      await logState(numberGoUp, player1.address, "Player1");
      await logQueueState(numberGoUp, player1.address, "Player1");

      // Transfer 2 tokens to player3
      console.log("\nTransferring 2 tokens to Player3:");
      await numberGoUp.connect(owner).transfer(player3.address, ethers.parseEther("2"));
      await logState(numberGoUp, player3.address, "Player3");
      await logQueueState(numberGoUp, player3.address, "Player3");

      // Get all token IDs and randomly select 5 for staking
      const allTokenIds = await numberGoUp.getOwnedTokens(player1.address);
      expect(allTokenIds.length).to.equal(10, "Should have 10 tokens initially");
      
      // Sort token IDs to make it deterministic and take every other one
      const sortedIds = allTokenIds.map(id => Number(id)).sort((a, b) => a - b);
      const stakingIds = sortedIds.filter((_, index) => index % 2 === 0); // Take tokens at even indices
      
      console.log("\nSelected tokens for staking:", stakingIds);
      
      // Stake 5 tokens
      await numberGoUp.connect(player1).stake(stakingIds);
      console.log("\nAfter staking 5 tokens:");
      await logState(numberGoUp, player1.address, "Player1");
      await logQueueState(numberGoUp, player1.address, "Player1");

      // Transfer 3 unstaked tokens to player2
      const remainingTokens = await numberGoUp.getOwnedTokens(player1.address);
      const unstaked = remainingTokens.filter(id => !stakingIds.includes(Number(id)));
      const tokensToTransfer = ethers.parseEther("3");
      
      console.log("\nTransferring 3 tokens to Player2");
      await numberGoUp.connect(player1).transfer(player2.address, tokensToTransfer);
      
      console.log("\nAfter transferring 3 tokens to Player2:");
      await logState(numberGoUp, player1.address, "Player1");
      await logQueueState(numberGoUp, player1.address, "Player1");
      await logState(numberGoUp, player2.address, "Player2");
      await logQueueState(numberGoUp, player2.address, "Player2");

      // Transfer 1 token from Player1 to Player3
      console.log("\nTransferring 1 token from Player1 to Player3:");
      await numberGoUp.connect(player1).transfer(player3.address, ethers.parseEther("1"));
      await logState(numberGoUp, player1.address, "Player1");
      await logQueueState(numberGoUp, player1.address, "Player1");
      await logState(numberGoUp, player3.address, "Player3");
      await logQueueState(numberGoUp, player3.address, "Player3");

      // Transfer 1 token from Player2 to Player3
      console.log("\nTransferring 1 token from Player2 to Player3:");
      await numberGoUp.connect(player2).transfer(player3.address, ethers.parseEther("1"));
      await logState(numberGoUp, player2.address, "Player2");
      await logQueueState(numberGoUp, player2.address, "Player2");
      await logState(numberGoUp, player3.address, "Player3");
      await logQueueState(numberGoUp, player3.address, "Player3");

      // Verify final state
      console.log("\nFinal state verification:");
      
      // Player1 should have 5 staked + 1 unstaked = 6 tokens
      expect(await numberGoUp.erc721BalanceOf(player1.address)).to.equal(6);
      expect(await numberGoUp.erc20BalanceOf(player1.address)).to.equal(ethers.parseEther("1")); // 10 - 5(staked) - 3(to P2) - 1(to P3)
      expect(await numberGoUp.getStakedERC20Balance(player1.address)).to.equal(ethers.parseEther("5"));

      // Player2 should have 2 tokens
      expect(await numberGoUp.erc721BalanceOf(player2.address)).to.equal(2);
      expect(await numberGoUp.erc20BalanceOf(player2.address)).to.equal(ethers.parseEther("2")); // 3 from P1 - 1 to P3
      expect(await numberGoUp.getStakedERC20Balance(player2.address)).to.equal(0);

      // Player3 should have 4 tokens
      expect(await numberGoUp.erc721BalanceOf(player3.address)).to.equal(4);
      expect(await numberGoUp.erc20BalanceOf(player3.address)).to.equal(ethers.parseEther("4")); // 2 from owner + 1 from P1 + 1 from P2
      expect(await numberGoUp.getStakedERC20Balance(player3.address)).to.equal(0);

      // Get final arrays for verification
      const player1Final = await numberGoUp.getOwnedTokens(player1.address);
      const player1Staked = await numberGoUp.getStakedTokens(player1.address);
      const player2Final = await numberGoUp.getOwnedTokens(player2.address);
      const player3Final = await numberGoUp.getOwnedTokens(player3.address);

      console.log("\nFinal token ownership:");
      console.log("Player1 owned tokens:", player1Final.map(id => Number(id)));
      console.log("Player1 staked tokens:", player1Staked.map(id => Number(id)));
      console.log("Player2 owned tokens:", player2Final.map(id => Number(id)));
      console.log("Player3 owned tokens:", player3Final.map(id => Number(id)));
      
      console.log("\nFinal Queue States:");
      await logQueueState(numberGoUp, player1.address, "Player1");
      await logQueueState(numberGoUp, player2.address, "Player2");
      await logQueueState(numberGoUp, player3.address, "Player3");
    });
  });
});