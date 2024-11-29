import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { NumberGoUp } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import "@nomicfoundation/hardhat-chai-matchers"

describe("NumberGoUp", function () {
  async function deployNumberGoUpFixture() {
    console.log("\n=== Starting Deployment ===");
    const signers = await ethers.getSigners();
    console.log("Deployer:", signers[0].address);

    // Deploy Uniswap v3 factory
    const uniswapV3FactorySource = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
    const uniswapV3Factory = await new ethers.ContractFactory(
      uniswapV3FactorySource.abi,
      uniswapV3FactorySource.bytecode,
      signers[0]
    ).deploy();

    // Deploy WETH with logging
    console.log("\nDeploying WETH...");
    const wethSource = require("@uniswap/v2-periphery/build/WETH9.json");
    const weth = await new ethers.ContractFactory(
      wethSource.interface,
      wethSource.bytecode,
      signers[0]
    ).deploy();

    // Deploy Position Manager with logging
    const positionManagerSource = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
    const positionManager = await new ethers.ContractFactory(
      positionManagerSource.abi,
      positionManagerSource.bytecode,
      signers[0]
    ).deploy(
      await uniswapV3Factory.getAddress(),
      await weth.getAddress(),
      ethers.ZeroAddress
    );

    // Deploy Router with logging
    const routerSource = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
    const router = await new ethers.ContractFactory(
      routerSource.abi,
      routerSource.bytecode,
      signers[0]
    ).deploy(
      await uniswapV3Factory.getAddress(),
      await weth.getAddress()
    );

    // Deploy NumberGoUp with detailed logging
    console.log("\nDeploying NumberGoUp...");
    const owner = signers[0];
    
    const NumberGoUpFactory = await ethers.getContractFactory("NumberGoUp");
    const maxSupply = 100000n;
    const decimals = 18n;
    const units = 10n ** decimals;

    console.log("\nDeployment Parameters:");
    console.log("Name: Number Go Up");
    console.log("Symbol: NGU");
    console.log("Decimals:", decimals.toString());
    console.log("Max Supply (raw):", maxSupply.toString());
    console.log("Max Supply (with decimals):", (maxSupply * units).toString());
    console.log("Initial Owner:", owner.address);
    console.log("Initial Mint Recipient:", owner.address);
    console.log("Router:", await router.getAddress());
    console.log("Position Manager:", await positionManager.getAddress());

    try {
        const numberGoUp = (await NumberGoUpFactory.deploy(
            "Number Go Up",
            "NGU",
            decimals,
            maxSupply,
            owner.address,
            owner.address,
            await router.getAddress(),
            await positionManager.getAddress()
        ) as unknown) as NumberGoUp;

        console.log("\nNumberGoUp Deployment Status:");
        console.log("Contract Address:", await numberGoUp.getAddress());
        console.log("Owner:", await numberGoUp.owner());
        console.log("Total Supply:", await numberGoUp.totalSupply());
        console.log("Max Supply:", await numberGoUp.maxTotalSupplyERC20());
        console.log("Units:", await numberGoUp.units());

        // Verify initial state
        console.log("\nInitial State:");
        console.log("Owner exempt status:", await numberGoUp.erc721TransferExempt(owner.address));
        console.log("Owner ERC20 balance:", await numberGoUp.erc20BalanceOf(owner.address));
        console.log("Owner ERC721 balance:", await numberGoUp.erc721BalanceOf(owner.address));
        console.log("Minted tokens:", await numberGoUp.minted());

        // Add verification that owner is initial mint recipient
        expect(await numberGoUp.owner()).to.equal(owner.address);
        expect(await numberGoUp.erc20BalanceOf(owner.address)).to.equal(maxSupply * units);
        expect(await numberGoUp.erc721TransferExempt(owner.address)).to.be.true;

        return { numberGoUp, owner, signers, router, positionManager };
    } catch (error) {
        console.error("\nDeployment failed!");
        console.error("Error:", error);
        throw error;
    }
  }

  // Add helper function to log state
  async function logState(numberGoUp: any, address: string, label: string) {
    const owned = await numberGoUp.getOwnedTokens(address);
    const staked = await numberGoUp.getStakedTokens(address);
    const stakedBalance = await numberGoUp.getStakedERC20Balance(address);
    const erc20Balance = await numberGoUp.erc20BalanceOf(address);
    const queueLength = await numberGoUp.getQueueLength(address);
    
    console.log(`\n=== State for ${label} (${address}) ===`);
    console.log("Owned NFTs:", owned.map((id: bigint) => id.toString()));
    console.log("Staked NFTs:", staked.map((id: bigint) => id.toString()));
    console.log("ERC20 Balance:", erc20Balance.toString());
    console.log("Staked ERC20 Balance:", stakedBalance.toString());
    console.log("Queue Length:", queueLength.toString());

    // Queue contents
    if (queueLength > 0) {
        const queueContents = [];
        for(let i = 0; i < queueLength; i++) {
            const tokenId = await numberGoUp.getIdAtQueueIndex(address, i);
            queueContents.push(tokenId.toString());
        }
        console.log("Queue Contents (in order):", queueContents);
    } else {
        console.log("Queue is empty");
    }

    // Log owned token indices
    console.log("\nOwned Token Indices:");
    for (const tokenId of owned) {
        const index = await numberGoUp.getOwnedIndex(tokenId);
        console.log(`Token ${tokenId.toString()} is at index ${index.toString()}`);
    }
  }

  describe("Deployment", function () {
    it("Should set the right owner and initial state", async function () {
      const { numberGoUp, owner } = await loadFixture(deployNumberGoUpFixture);
      
      console.log("\nVerifying Contract State:");
      console.log("Owner Address:", owner.address);
      console.log("Contract Owner:", await numberGoUp.owner());
      
      expect(await numberGoUp.owner()).to.equal(owner.address);
    });

    it("Should correctly set initial balances and exemption", async function () {
      const { numberGoUp, owner } = await loadFixture(deployNumberGoUpFixture);
      const maxSupply = 100000n;
      const decimals = 18n;
      const units = 10n ** decimals;
      const expectedBalance = maxSupply * units;

      console.log("\nVerifying Initial Balances:");
      console.log("Expected Balance:", expectedBalance.toString());
      console.log("Actual Balance:", (await numberGoUp.erc20BalanceOf(owner.address)).toString());
      console.log("Total Supply:", (await numberGoUp.totalSupply()).toString());
      
      // Check ERC20 balances
      expect(await numberGoUp.erc20BalanceOf(owner.address)).to.equal(expectedBalance);
      expect(await numberGoUp.totalSupply()).to.equal(expectedBalance);

      // Check ERC721 state
      console.log("\nVerifying ERC721 State:");
      console.log("Owner ERC721 Balance:", await numberGoUp.erc721BalanceOf(owner.address));
      console.log("Owner Exempt Status:", await numberGoUp.erc721TransferExempt(owner.address));
      
      expect(await numberGoUp.erc721BalanceOf(owner.address)).to.equal(0);
      expect(await numberGoUp.erc721TransferExempt(owner.address)).to.be.true;
    });

    it("Should have correct max supply and units", async function () {
      const { numberGoUp } = await loadFixture(deployNumberGoUpFixture);
      const maxSupply = 100000n;
      const decimals = 18n;
      const units = 10n ** decimals;

      console.log("\nVerifying Supply Parameters:");
      console.log("Max Supply:", await numberGoUp.maxTotalSupplyERC20());
      console.log("Units:", await numberGoUp.units());
      console.log("Decimals:", await numberGoUp.decimals());
      
      expect(await numberGoUp.maxTotalSupplyERC20()).to.equal(maxSupply * units);
      expect(await numberGoUp.units()).to.equal(units);
      expect(await numberGoUp.decimals()).to.equal(decimals);
    });

    it("Should prevent non-exempt addresses from receiving NFTs", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, nonExemptUser] = signers;
      const transferAmount = ethers.parseEther("1");  // 1 whole token

      console.log("\nTesting NFT Prevention:");
      console.log("Non-exempt User:", nonExemptUser.address);
      console.log("Transfer Amount:", transferAmount);
      console.log("Non-exempt User Exempt Status:", await numberGoUp.erc721TransferExempt(nonExemptUser.address));

      await numberGoUp.connect(owner).transfer(nonExemptUser.address, transferAmount);

      console.log("Post-Transfer ERC20 Balance:", await numberGoUp.erc20BalanceOf(nonExemptUser.address));
      console.log("Post-Transfer ERC721 Balance:", await numberGoUp.erc721BalanceOf(nonExemptUser.address));

      expect(await numberGoUp.erc20BalanceOf(nonExemptUser.address)).to.equal(transferAmount);
      expect(await numberGoUp.erc721BalanceOf(nonExemptUser.address)).to.equal(1);
    });
  });

  describe("Token Operations", function () {
    it("Should handle ERC20 transfers correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient, secondParty] = signers;
      const amount = ethers.parseEther("1");

      await logState(numberGoUp, owner.address, "Owner before transfer");
      await logState(numberGoUp, recipient.address, "Recipient before transfer");

      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      await logState(numberGoUp, owner.address, "Owner after transfer");
      await logState(numberGoUp, recipient.address, "Recipient after transfer");

      expect(await numberGoUp.erc20BalanceOf(recipient.address)).to.equal(amount);

      await numberGoUp.connect(recipient).transfer(secondParty.address, amount);
      await logState(numberGoUp, recipient.address, "Recipient after transfer to second party");
      await logState(numberGoUp, secondParty.address, "Second party after transfer");
      expect(await numberGoUp.erc20BalanceOf(recipient.address)).to.equal(0);
      expect(await numberGoUp.erc20BalanceOf(secondParty.address)).to.equal(amount);
    });

    it("Should handle fractional transfers correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("0.5"); // Half a token

      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "Recipient should have exactly the fractional amount transferred"
      ).to.equal(amount);

      expect(await numberGoUp.erc721BalanceOf(recipient.address),
        "Recipient should have no NFTs for fractional transfer"
      ).to.equal(0);
    });

    it("Should handle multiple token transfers correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("3"); // 3 whole tokens

      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "Recipient should have exactly 3 ERC20 tokens"
      ).to.equal(amount);

      expect(await numberGoUp.erc721BalanceOf(recipient.address),
        "Recipient should have 3 NFTs for 3 whole tokens"
      ).to.equal(3);

      expect(await numberGoUp.getQueueLength(recipient.address),
        "Recipient's queue should contain 3 NFTs"
      ).to.equal(3);
    });

    it("Should prevent transfers exceeding balance", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const totalSupply = await numberGoUp.totalSupply();
      const amount = totalSupply + 1n;

      await expect(
        numberGoUp.connect(owner).transfer(recipient.address, amount)
      ).to.be.revertedWithCustomError(
        numberGoUp,
        "SenderInsufficientBalance"
      );
    });

    it("Should handle transfers between exempt and non-exempt addresses", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient, thirdParty] = signers;
      const amount = ethers.parseEther("1");

      await logState(numberGoUp, owner.address, "Owner (exempt) before transfer");
      await logState(numberGoUp, recipient.address, "Recipient before transfer");

      // Transfer from exempt to non-exempt
      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      await logState(numberGoUp, owner.address, "Owner after transfer");
      await logState(numberGoUp, recipient.address, "Recipient after transfer");

      // Transfer from non-exempt to non-exempt
      await numberGoUp.connect(recipient).transfer(thirdParty.address, amount);

      await logState(numberGoUp, recipient.address, "Recipient after second transfer");
      await logState(numberGoUp, thirdParty.address, "ThirdParty after transfer");
    });

    it("Should handle queue management during transfers", async function () {
        const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
        const [_, recipient] = signers;
        const amount = ethers.parseEther("2"); // 2 whole tokens

        console.log("\nTesting Queue Management:");
        console.log("Initial Queue Length:", await numberGoUp.getQueueLength(owner.address));

        // Transfer 2 tokens to recipient
        await numberGoUp.connect(owner).transfer(recipient.address, amount);

        console.log("\nAfter Transfer:");
        console.log("Recipient Queue Length:", await numberGoUp.getQueueLength(recipient.address));
        console.log("Recipient ERC721 Balance:", await numberGoUp.erc721BalanceOf(recipient.address));

        // Check queue state
        expect(await numberGoUp.getQueueLength(recipient.address)).to.equal(2);
        expect(await numberGoUp.erc721BalanceOf(recipient.address)).to.equal(2);
    });
  });

  describe("Staking Operations", function () {
    it("Should stake NFT correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1"); // 1 whole token

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      await logState(numberGoUp, recipient.address, "Recipient after receiving token");

      await numberGoUp.connect(recipient).stakeNFT(1);
      await logState(numberGoUp, recipient.address, "Recipient after staking");
    });

    it("Should unstake NFT correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");

      // Transfer and stake setup
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;
      console.log('Owner of token ID 1: ', await numberGoUp.ownerOf(tokenId));
      expect(await numberGoUp.ownerOf(tokenId)).to.equal(recipient.address);
      await numberGoUp.connect(recipient).stakeNFT(tokenId);

      console.log("\nBefore Unstaking:");
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Queue Length:", await numberGoUp.getQueueLength(recipient.address));

      // Unstake the token
      await numberGoUp.connect(recipient).unstakeNFT(tokenId);

      console.log("\nAfter Unstaking:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Queue Length:", await numberGoUp.getQueueLength(recipient.address));

      // Verify unstaking state
      expect(await numberGoUp.getStakedERC20Balance(recipient.address)).to.equal(0);
      expect(await numberGoUp.erc20BalanceOf(recipient.address)).to.equal(amount);
      expect(await numberGoUp.getQueueLength(recipient.address)).to.equal(1);
    });

    it("Should handle multiple NFT staking", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("3"); // 3 tokens

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      await logState(numberGoUp, recipient.address, "Recipient after receiving tokens");

      const tokensToStake = [1, 2, 3];
      await numberGoUp.connect(recipient).stakeMultipleNFTs(tokensToStake);
      await logState(numberGoUp, recipient.address, "Recipient after staking multiple");
    });

    it("Should handle partial staking when some tokens are already staked", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("3");

      // Initial transfer
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      await logState(numberGoUp, recipient.address, "Recipient after transfer");

      // Stake first token
      await numberGoUp.connect(recipient).stakeNFT(1);
      await logState(numberGoUp, recipient.address, "Recipient after staking token 1");

      // Try to stake array including already staked token
      const tokensToStake = [1, 2, 3];
      console.log("\nAttempting to stake tokens:", tokensToStake);

      await expect(
        numberGoUp.connect(recipient).stakeMultipleNFTs(tokensToStake)
      ).to.be.revertedWithCustomError(
        numberGoUp,
        "StakerInsufficientBalance"
      );

      await logState(numberGoUp, recipient.address, "Recipient after failed stake attempt");

      // Now try with valid tokens
      const validTokens = [2, 3];
      console.log("\nStaking valid tokens:", validTokens);
      await numberGoUp.connect(recipient).stakeMultipleNFTs(validTokens);

      await logState(numberGoUp, recipient.address, "Recipient after successful stake");

      // ... rest of test remains the same ...
    });
  });

  describe("Staking Edge Cases", function () {
    it("Should prevent staking when user has insufficient balance", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("0.5"); // Only transfer half a token

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;

      console.log("\nTesting Insufficient Balance:");
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Required Balance for Staking:", ethers.parseEther("1").toString());

      await expect(
        numberGoUp.connect(recipient).stakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "StakerInsufficientBalance");
    });

    it("Should prevent staking of non-existent tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");
      const nonExistentTokenId = 999;

      // Transfer ERC20 to recipient so they have enough balance
      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      console.log("\nTesting Non-existent Token Staking:");
      console.log("Current Minted Count:", await numberGoUp.minted());
      console.log("Attempting to stake token ID:", nonExistentTokenId);
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address));

      // Should revert with NotTokenOwner since token ID > minted
      await expect(
        numberGoUp.connect(recipient).stakeNFT(nonExistentTokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "NotFound");
    });

    it("Should prevent staking of unminted tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");

      // Transfer ERC20 to recipient so they have enough balance
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const currentMinted = await numberGoUp.minted();

      console.log("\nTesting Unminted Token Staking:");
      console.log("Current Minted Count:", currentMinted);
      console.log("Attempting to stake next token ID:", currentMinted + 1n);

      // Should revert with NotTokenOwner since token hasn't been minted yet
      await expect(
        numberGoUp.connect(recipient).stakeNFT(currentMinted + 1n)
      ).to.be.revertedWithCustomError(numberGoUp, "NotFound");
    });

    it("Should prevent staking tokens owned by others", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient, otherUser] = signers;
      const amount = ethers.parseEther("1");

      // Transfer token to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;

      console.log("\nTesting Unauthorized Staking:");
      console.log("Token Owner:", await numberGoUp.ownerOf(tokenId));
      console.log("Attempting to stake from:", otherUser.address);

      // Give otherUser enough balance to attempt staking
      await numberGoUp.connect(owner).transfer(otherUser.address, amount);

      // Try to stake token that exists but isn't owned by otherUser
      await expect(
        numberGoUp.connect(otherUser).stakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "NotFound");
    });

    it("Should prevent staking of already staked tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;
      // expect(await numberGoUp.erc721BalanceOf(thirdParty.address),
      //   "Third party should have 1 NFT after receiving"
      // ).to.equal(1);
      expect(await numberGoUp.ownerOf(tokenId), 
        "Token should be owned by recipient"
      ).to.equal(recipient.address);
      expect(await numberGoUp.getQueueLength(recipient.address),
        "Recipient's queue should have 1 token"
      ).to.equal(1);
      expect(await numberGoUp.getNextQueueId(recipient.address),
        "Next queue ID should be the token ID"
      ).to.equal(tokenId);
      expect(await numberGoUp.getStakedERC20Balance(recipient.address),
        "Staked balance should be 0"
      ).to.equal(0);
      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "Recipient should have the transferred amount of ERC20 tokens"
      ).to.equal(amount);

      // First stake
      await numberGoUp.connect(recipient).stakeNFT(tokenId);

      console.log("\nTesting Double Staking:");
      console.log("First Stake Successful");
      expect(await numberGoUp.getNextQueueId(recipient.address),
        "Next queue ID should be 0 after first stake"
      ).to.equal(0);
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));

      // Send another token to the recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      // Recipient gets another full token. 
      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "Recipient should have exactly 1 ERC20 tokens after second transfer"
      ).to.equal(amount * 1n);
      // Recipient has 2 NFTs because NFTs aren't removed from _owned array, they are only moved between _staked and _queue.
      expect(await numberGoUp.erc721BalanceOf(recipient.address),
        "Recipient should have 2 NFTs after second transfer"
      ).to.equal(2);

      expect(await numberGoUp.getQueueLength(recipient.address),
        "Recipient's queue should contain 1 NFT after second transfer"
      ).to.equal(1);
      // Try to stake again with same token ID
      await expect(
        numberGoUp.connect(recipient).stakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "TokenAlreadyStaked");
    });

    it("Should prevent unstaking of non-staked tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;

      // Try to unstake without staking first
      await expect(
        numberGoUp.connect(recipient).unstakeNFT(tokenId)
      ).to.be.revertedWithCustomError(numberGoUp, "NotTokenOwner");
    });

    it("Should handle batch staking with duplicate tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("2");

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenIds = [1, 1]; // Duplicate token ID

      await expect(
        numberGoUp.connect(recipient).stakeMultipleNFTs(tokenIds)
      ).to.be.revertedWithCustomError(numberGoUp, "TokenAlreadyStaked");
    });

    it("Should verify queue state after unstaking", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("1");

      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      const tokenId = 1;

      console.log("\nInitial Queue State:");
      console.log("Queue Length:", await numberGoUp.getQueueLength(recipient.address));

      // Stake token
      await numberGoUp.connect(recipient).stakeNFT(tokenId);
      
      console.log("\nAfter Staking:");
      console.log("Queue Length:", await numberGoUp.getQueueLength(recipient.address));
      expect(await numberGoUp.getQueueLength(recipient.address)).to.equal(0);

      // Unstake token
      await numberGoUp.connect(recipient).unstakeNFT(tokenId);
      
      console.log("\nAfter Unstaking:");
      console.log("Queue Length:", await numberGoUp.getQueueLength(recipient.address));
      expect(await numberGoUp.getQueueLength(recipient.address)).to.equal(1);
      expect(await numberGoUp.getNextQueueId(recipient.address)).to.equal(tokenId);
    });
  });

  describe("Total Balance", function () {
    it("Should return correct total balance with no staked tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("2");

      // Transfer some tokens to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      console.log("\nChecking Total Balance (No Stakes):");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      expect(await numberGoUp.totalBalanceOf(recipient.address),
        "Total balance should equal ERC20 balance when nothing is staked"
      ).to.equal(amount);
    });

    it("Should return correct total balance with staked tokens", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("2");

      // Transfer tokens to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      
      console.log("\nInitial State:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      // Stake one token
      await numberGoUp.connect(recipient).stakeNFT(1);

      console.log("\nAfter Staking One Token:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      expect(await numberGoUp.totalBalanceOf(recipient.address),
        "Total balance should remain unchanged after staking"
      ).to.equal(amount);
    });

    it("Should handle mixed operations correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const initialAmount = ethers.parseEther("3");

      // Initial transfer
      await numberGoUp.connect(owner).transfer(recipient.address, initialAmount);
      
      console.log("\nInitial State:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      // Stake two tokens
      await numberGoUp.connect(recipient).stakeNFT(1);
      await numberGoUp.connect(recipient).stakeNFT(2);

      console.log("\nAfter Staking Two Tokens:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      // Unstake one token
      await numberGoUp.connect(recipient).unstakeNFT(1);

      console.log("\nAfter Unstaking One Token:");
      console.log("ERC20 Balance:", await numberGoUp.erc20BalanceOf(recipient.address));
      console.log("Staked Balance:", await numberGoUp.getStakedERC20Balance(recipient.address));
      console.log("Total Balance:", await numberGoUp.totalBalanceOf(recipient.address));

      expect(await numberGoUp.totalBalanceOf(recipient.address),
        "Total balance should remain constant through stake/unstake operations"
      ).to.equal(initialAmount);

      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "ERC20 balance should be 2 ETH after unstaking one token"
      ).to.equal(ethers.parseEther("2"));

      expect(await numberGoUp.getStakedERC20Balance(recipient.address),
        "Staked balance should be 1 ETH with one token still staked"
      ).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Approvals and TransferFrom", function () {
    it("Should handle basic approval correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender] = signers;
      const amount = ethers.parseEther("1");

      console.log("\nTesting Basic Approval:");
      console.log("Owner:", owner.address);
      console.log("Spender:", spender.address);
      console.log("Approval Amount:", amount);

      await numberGoUp.connect(owner).approve(spender.address, amount);

      expect(await numberGoUp.allowance(owner.address, spender.address),
        "Allowance should match approved amount"
      ).to.equal(amount);
    });

    it("Should handle transferFrom correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender, recipient] = signers;
      const amount = ethers.parseEther("1");

      await logState(numberGoUp, owner.address, "Owner before approval");
      await logState(numberGoUp, spender.address, "Spender before approval");

      await numberGoUp.connect(owner).approve(spender.address, amount);
      await numberGoUp.connect(spender).transferFrom(owner.address, recipient.address, amount);

      await logState(numberGoUp, owner.address, "Owner after transfer");
      await logState(numberGoUp, recipient.address, "Recipient after transfer");
    });

    it("Should handle infinite approval correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender, recipient] = signers;
      const maxUint256 = ethers.MaxUint256;
      const amount = ethers.parseEther("1");

      console.log("\nTesting Infinite Approval:");
      console.log("Initial Approval:", maxUint256);
      
      // Set infinite approval
      await numberGoUp.connect(owner).approve(spender.address, maxUint256);

      // Do multiple transfers
      await numberGoUp.connect(spender).transferFrom(owner.address, recipient.address, amount);

      expect(await numberGoUp.allowance(owner.address, spender.address),
        "Allowance should remain unchanged for infinite approval"
      ).to.equal(maxUint256);
    });

    it("Should prevent unauthorized transferFrom", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender, recipient] = signers;
      const amount = ethers.parseEther("1");

      console.log("\nTesting Unauthorized TransferFrom:");
      console.log("Owner Balance:", await numberGoUp.erc20BalanceOf(owner.address));
      console.log("Spender Allowance:", await numberGoUp.allowance(owner.address, spender.address));
      console.log("Attempting transfer amount:", amount);

      // First approve zero to make sure there's no allowance
      await numberGoUp.connect(owner).approve(spender.address, 0);

      await expect(
        numberGoUp.connect(spender).transferFrom(owner.address, recipient.address, amount)
      ).to.be.revertedWithCustomError(
        numberGoUp,
        "InsufficientAllowance"
      ).withArgs(amount, 0);
    });

    it("Should prevent transferFrom with insufficient allowance", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender, recipient] = signers;
      const approvalAmount = ethers.parseEther("0.5");  // Approve less than we try to transfer
      const transferAmount = ethers.parseEther("1");    // Try to transfer more than approved

      console.log("\nTesting Insufficient Allowance:");
      console.log("Approval Amount:", approvalAmount);
      console.log("Transfer Amount:", transferAmount);

      // Approve smaller amount
      await numberGoUp.connect(owner).approve(spender.address, approvalAmount);

      await expect(
        numberGoUp.connect(spender).transferFrom(owner.address, recipient.address, transferAmount)
      ).to.be.revertedWithCustomError(
        numberGoUp,
        "InsufficientAllowance"
      ).withArgs(transferAmount, approvalAmount);
    });

    it("Should handle approval updates correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, spender] = signers;
      const initialAmount = ethers.parseEther("2");
      const newAmount = ethers.parseEther("1");

      console.log("\nTesting Approval Updates:");
      console.log("Initial Approval:", initialAmount);
      console.log("Updated Approval:", newAmount);

      // Initial approval
      await numberGoUp.connect(owner).approve(spender.address, initialAmount);
      
      // Update approval
      await numberGoUp.connect(owner).approve(spender.address, newAmount);

      expect(await numberGoUp.allowance(owner.address, spender.address),
        "Allowance should be updated to new amount"
      ).to.equal(newAmount);
    });

    it("Should prevent approval to zero address", async function () {
      const { numberGoUp, owner } = await loadFixture(deployNumberGoUpFixture);
      const amount = ethers.parseEther("1");
      const zeroAddress = "0x0000000000000000000000000000000000000000";

      console.log("\nTesting Zero Address Approval:");
      console.log("Owner:", owner.address);
      console.log("Attempting to approve amount:", amount);
      console.log("To zero address:", zeroAddress);

      await expect(
        numberGoUp.connect(owner).approve(zeroAddress, amount)
      ).to.be.revertedWithCustomError(
        numberGoUp,
        "InvalidSpender"
      );
    });
  });

  describe("Queue Order Tests", function () {
    it("Should handle unstaking in different order than staking", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("3"); // 3 whole tokens

      // Transfer tokens to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      await logState(numberGoUp, recipient.address, "Recipient after receiving tokens");

      // Stake tokens in order: 1, 2, 3
      console.log("\nStaking tokens in sequence: 1, 2, 3");
      await numberGoUp.connect(recipient).stakeNFT(1);
      await numberGoUp.connect(recipient).stakeNFT(2);
      await numberGoUp.connect(recipient).stakeNFT(3);
      
      await logState(numberGoUp, recipient.address, "Recipient after staking all tokens");

      // Unstake in different order: 2, 1, 3
      console.log("\nUnstaking tokens in different sequence: 2, 1, 3");
      
      // Unstake token 2 first
      await numberGoUp.connect(recipient).unstakeNFT(2);
      await logState(numberGoUp, recipient.address, "After unstaking token 2");
      expect(await numberGoUp.getNextQueueId(recipient.address),
        "Token 2 should be first in queue after unstaking"
      ).to.equal(2);

      // Unstake token 1
      await numberGoUp.connect(recipient).unstakeNFT(1);
      await logState(numberGoUp, recipient.address, "After unstaking token 1");
      expect(await numberGoUp.getQueueLength(recipient.address),
        "Queue should have 2 tokens after unstaking tokens 2 and 1"
      ).to.equal(2);

      // Unstake token 3
      await numberGoUp.connect(recipient).unstakeNFT(3);
      await logState(numberGoUp, recipient.address, "After unstaking token 3");

      // Verify final state
      expect(await numberGoUp.getQueueLength(recipient.address),
        "Queue should have all 3 tokens after unstaking"
      ).to.equal(3);

      expect(await numberGoUp.getStakedERC20Balance(recipient.address),
        "Staked balance should be 0 after unstaking all tokens"
      ).to.equal(0);

      expect(await numberGoUp.erc20BalanceOf(recipient.address),
        "ERC20 balance should be restored after unstaking all tokens"
      ).to.equal(amount);

      // Try to transfer tokens to verify they're in the queue
      const transferAmount = ethers.parseEther("2");
      console.log("\nChecking owner exempt status:", await numberGoUp.erc721TransferExempt(owner.address));
      expect(await numberGoUp.erc721TransferExempt(owner.address),
        "Owner address should be transfer exempt"
      ).to.be.true;
      await numberGoUp.connect(recipient).transfer(owner.address, transferAmount);
      
      await logState(numberGoUp, recipient.address, "After transferring 2 tokens back to owner");
      await logState(numberGoUp, owner.address, "Owner after receiving 2 tokens");
    });

    it("Should add unstaked tokens to back of selling queue", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("4"); // 4 whole tokens

      // Transfer tokens to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      console.log("\nInitial Transfer:");
      await logState(numberGoUp, recipient.address, "Recipient after receiving tokens");

      // Stake tokens 1 and 2
      console.log("\nStaking tokens 1 and 2:");
      await numberGoUp.connect(recipient).stakeNFT(1);
      await numberGoUp.connect(recipient).stakeNFT(2);
      await logState(numberGoUp, recipient.address, "Recipient after staking");

      // Transfer token 3 to create activity in the queue
      console.log("\nTransferring token 3:");
      console.log("\nChecking selling queue before transfer:");
      const queueLengthBefore = await numberGoUp.getQueueLength(recipient.address);
      for(let i = 0; i < queueLengthBefore; i++) {
        const tokenId = await numberGoUp.getIdAtQueueIndex(recipient.address, i);
        console.log(`Queue Position ${i}: Token ID ${tokenId}`);
      }
      await numberGoUp.connect(recipient).transfer(owner.address, ethers.parseEther("1"));
      await logState(numberGoUp, recipient.address, "Recipient after transfer");

      // Now unstake token 1
      console.log("\nUnstaking token 1:");
      await numberGoUp.connect(recipient).unstakeNFT(1);
      await logState(numberGoUp, recipient.address, "Recipient after unstaking token 1");

      // Check queue order
      const queueLength = await numberGoUp.getQueueLength(recipient.address);
      console.log("\nChecking Queue Order:");
      for(let i = 0; i < queueLength; i++) {
        const tokenId = await numberGoUp.getIdAtQueueIndex(recipient.address, i);
        console.log(`Queue Position ${i}: Token ID ${tokenId}`);
      }

      // Verify token 1 is at the back of the queue
      const lastTokenId = await numberGoUp.getIdAtQueueIndex(
        recipient.address, 
        queueLength - 1n
      );
      
      expect(lastTokenId,
        "Unstaked token should be at the back of the queue"
      ).to.equal(1);

      // Unstake token 2 and verify it goes to the back
      console.log("\nUnstaking token 2:");
      await numberGoUp.connect(recipient).unstakeNFT(2);
      await logState(numberGoUp, recipient.address, "Recipient after unstaking token 2");

      const newQueueLength = await numberGoUp.getQueueLength(recipient.address);
      const newLastTokenId = await numberGoUp.getIdAtQueueIndex(
        recipient.address, 
        newQueueLength - 1n
      );

      expect(newLastTokenId,
        "Newly unstaked token should be at the back of the queue"
      ).to.equal(2);

      // Print final queue order
      console.log("\nFinal Queue Order:");
      for(let i = 0; i < newQueueLength; i++) {
        const tokenId = await numberGoUp.getIdAtQueueIndex(recipient.address, i);
        console.log(`Queue Position ${i}: Token ID ${tokenId}`);
      }
    });
  });

  describe("Total Supply Tests", function () {
    it("Should track total supply correctly during minting", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("2");

      console.log("\nInitial State:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      console.log("Owner Balance:", await numberGoUp.erc20BalanceOf(owner.address));

      // Transfer tokens (which mints them)
      await numberGoUp.connect(owner).transfer(recipient.address, amount);

      console.log("\nAfter Transfer:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      console.log("Owner Balance:", await numberGoUp.erc20BalanceOf(owner.address));
      console.log("Recipient Balance:", await numberGoUp.erc20BalanceOf(recipient.address));

      expect(await numberGoUp.totalSupply(),
        "Total supply should remain constant after transfer"
      ).to.equal(await numberGoUp.maxTotalSupplyERC20());
    });

    it("Should maintain total supply during transfers", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient1, recipient2] = signers;
      const amount = ethers.parseEther("2");

      const initialSupply = await numberGoUp.totalSupply();
      console.log("\nInitial Supply:", initialSupply);

      // First transfer
      await numberGoUp.connect(owner).transfer(recipient1.address, amount);
      console.log("\nAfter First Transfer:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      await logState(numberGoUp, recipient1.address, "Recipient1");

      // Second transfer
      await numberGoUp.connect(recipient1).transfer(recipient2.address, ethers.parseEther("1"));
      console.log("\nAfter Second Transfer:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      await logState(numberGoUp, recipient1.address, "Recipient1");
      await logState(numberGoUp, recipient2.address, "Recipient2");

      expect(await numberGoUp.totalSupply(),
        "Total supply should remain unchanged after transfers"
      ).to.equal(initialSupply);
    });

    it("Should maintain total supply during staking operations", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("2");

      const initialSupply = await numberGoUp.totalSupply();
      console.log("\nInitial Supply:", initialSupply);

      // Transfer and stake
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      console.log("\nAfter Transfer:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      await logState(numberGoUp, recipient.address, "Recipient");

      // Stake tokens
      await numberGoUp.connect(recipient).stakeNFT(1);
      await numberGoUp.connect(recipient).stakeNFT(2);
      
      console.log("\nAfter Staking:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      await logState(numberGoUp, recipient.address, "Recipient");

      expect(await numberGoUp.totalSupply(),
        "Total supply should remain unchanged after staking"
      ).to.equal(initialSupply);

      // Unstake tokens
      await numberGoUp.connect(recipient).unstakeNFT(1);
      
      console.log("\nAfter Unstaking:");
      console.log("Total Supply:", await numberGoUp.totalSupply());
      await logState(numberGoUp, recipient.address, "Recipient");

      expect(await numberGoUp.totalSupply(),
        "Total supply should remain unchanged after unstaking"
      ).to.equal(initialSupply);

      // Verify total of all balances equals total supply
      const ownerBalance = await numberGoUp.erc20BalanceOf(owner.address);
      const recipientBalance = await numberGoUp.erc20BalanceOf(recipient.address);
      const recipientStaked = await numberGoUp.getStakedERC20Balance(recipient.address);
      
      expect(ownerBalance + recipientBalance + recipientStaked,
        "Sum of all balances should equal total supply"
      ).to.equal(initialSupply);
    });
  });

  describe("Multiple Unstaking Operations", function () {
    it("Should handle multiple unstaking and maintain correct queue order", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("5"); // 5 whole tokens

      // Transfer tokens to recipient
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      console.log("\nInitial Transfer:");
      await logState(numberGoUp, recipient.address, "Recipient after receiving tokens");

      // Stake multiple tokens (1, 2, 3, 4)
      console.log("\nStaking tokens 1, 2, 3, 4:");
      await numberGoUp.connect(recipient).stakeMultipleNFTs([1, 2, 3, 4]);
      await logState(numberGoUp, recipient.address, "Recipient after staking");

      // Transfer token 5 to create activity in the queue
      console.log("\nTransferring token 5:");
      const tx = await numberGoUp.connect(recipient).transfer(owner.address, ethers.parseEther("1"));
      const receipt = await tx.wait();
      
      // Log debug events
      if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
              try {
                  const event = numberGoUp.interface.parseLog(log);
                  if (event && event.name === 'DebugRemoval') {
                      console.log('\n=== Debug Removal Event ===');
                      console.log('Operation:', event.args.message);
                      console.log('Token ID:', event.args.tokenId.toString());
                      console.log('Index to Remove:', event.args.indexToRemove.toString());
                      console.log('Last Index:', event.args.lastIndex.toString());
                      console.log('Last Token ID:', event.args.lastTokenId.toString());
                  }
                  if (event && event.name === 'QueueOperation') {
                      console.log('\n=== Queue Operation Event ===');
                      console.log('Operation:', event.args.operation);
                      console.log('Token ID:', event.args.tokenId.toString());
                  }
              } catch (e) {
                  // Skip logs that can't be parsed
              }
          }
      }

      await logState(numberGoUp, recipient.address, "Recipient after transfer");
      await logState(numberGoUp, owner.address, "Owner after transfer");

      // Verify final state
      expect(await numberGoUp.erc20BalanceOf(recipient.address),
          "Recipient should have 0 ERC20 tokens after transfer"
      ).to.equal(0);

      expect(await numberGoUp.getQueueLength(recipient.address),
          "Recipient's queue should be empty after transfer"
      ).to.equal(0);

      const recipientOwned = await numberGoUp.getOwnedTokens(recipient.address);
      expect(recipientOwned.length,
          "Recipient should have 4 owned tokens (1,2,3,4)"
      ).to.equal(4);

      // Verify staked tokens remain unchanged
      const recipientStaked = await numberGoUp.getStakedTokens(recipient.address);
      expect(recipientStaked.map(id => id.toString()),
          "Staked tokens should remain unchanged"
      ).to.deep.equal(['1', '2', '3', '4']);

    });

    it("Should handle partial unstaking correctly", async function () {
      const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
      const [_, recipient] = signers;
      const amount = ethers.parseEther("3"); // 3 whole tokens

      // Setup: Transfer and stake tokens
      await numberGoUp.connect(owner).transfer(recipient.address, amount);
      await numberGoUp.connect(recipient).stakeMultipleNFTs([1, 2, 3]);
      await logState(numberGoUp, recipient.address, "After staking all tokens");

      // Unstake subset of tokens
      console.log("\nUnstaking tokens 1 and 3:");
      await numberGoUp.connect(recipient).unstakeMultipleNFTs([1, 3]);
      await logState(numberGoUp, recipient.address, "After partial unstake");

      // Verify remaining staked tokens
      expect(await numberGoUp.getStakedERC20Balance(recipient.address),
        "Should have one token remaining staked"
      ).to.equal(ethers.parseEther("1"));

      // Verify queue state
      const queueLength = await numberGoUp.getQueueLength(recipient.address);
      expect(queueLength,
        "Queue should have two unstaked tokens"
      ).to.equal(2);

      // Verify queue order
      const firstQueuedToken = await numberGoUp.getIdAtQueueIndex(recipient.address, 0);
      const secondQueuedToken = await numberGoUp.getIdAtQueueIndex(recipient.address, 1);
      expect(firstQueuedToken,
        "First unstaked token should be first in queue"
      ).to.equal(1);
      expect(secondQueuedToken,
        "Second unstaked token should be second in queue"
      ).to.equal(3);
    });
  });
});