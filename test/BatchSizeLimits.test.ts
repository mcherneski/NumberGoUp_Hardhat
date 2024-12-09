import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { NumberGoUp } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import "@nomicfoundation/hardhat-chai-matchers";

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

    return { numberGoUp, owner, signers };
}

describe("BatchSizeLimits", function () {
    const MAX_GAS = 30_000_000; // Mainnet's typical block gas limit

    // Helper function to check if error is gas-related
    function isGasError(error: any): boolean {
        const errorString = error.toString().toLowerCase();
        return errorString.includes('gas') || 
               errorString.includes('out of gas') ||
               errorString.includes('transaction ran out of gas');
    }

    // Helper function to delay between transactions
    async function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    it("Should find maximum exempt to non-exempt transfer size (minting)", async function() {
        const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
        const [_, nonExempt1] = signers;

        // Owner is already exempt and has all tokens from deployment
        // No need to set exemption or transfer initial tokens

        // Binary search for maximum transfer size
        let left = 1n;
        let right = 500n;
        let maxTransfer = 0n;

        while (left <= right) {
            const mid = (left + right) / 2n;
            const amount = ethers.parseEther(mid.toString());

            try {
                await numberGoUp.connect(owner).transfer(nonExempt1.address, amount, { gasLimit: MAX_GAS });
                await delay(100);
                left = mid + 1n;
                maxTransfer = mid;
            } catch (e: unknown) {
                console.log(`Error at ${mid} tokens:`, e instanceof Error ? e.toString() : String(e));
                if (!isGasError(e)) {
                    break;
                }
                right = mid - 1n;
            }
        }

        console.log("Maximum exempt to non-exempt transfer:", maxTransfer.toString(), "tokens");
        expect(maxTransfer).to.be.greaterThan(0n);
    });

    it("Should find maximum non-exempt to non-exempt transfer size", async function() {
        const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
        const [_, nonExempt1, nonExempt2] = signers;

        // Transfer tokens in batches of 300 to ensure we have enough for testing
        const batchSize = ethers.parseEther("300");
        console.log("\nTransferring initial tokens in batches...");
        await numberGoUp.connect(owner).transfer(nonExempt1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);
        await numberGoUp.connect(owner).transfer(nonExempt1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);

        // Log initial state
        console.log("\nInitial state:");
        console.log("NonExempt1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
        console.log("NonExempt1 NFT balance:", (await numberGoUp.erc721BalanceOf(nonExempt1.address)).toString());
        
        // Binary search for maximum transfer size
        let left = 1n;
        let right = 500n;
        let maxTransfer = 0n;

        while (left <= right) {
            const mid = (left + right) / 2n;
            const amount = ethers.parseEther(mid.toString());

            try {
                console.log(`\nTrying to transfer ${mid} tokens (and NFTs)...`);
                const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, amount, { gasLimit: MAX_GAS });
                const receipt = await tx.wait();
                if (receipt) {
                    console.log("Gas used:", receipt.gasUsed.toString());
                }
                await delay(100);

                // Log successful transfer details
                console.log("Success!");
                console.log("NonExempt1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("NonExempt1 NFT balance:", (await numberGoUp.erc721BalanceOf(nonExempt1.address)).toString());
                console.log("NonExempt2 token balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));
                console.log("NonExempt2 NFT balance:", (await numberGoUp.erc721BalanceOf(nonExempt2.address)).toString());

                left = mid + 1n;
                maxTransfer = mid;
            } catch (e: unknown) {
                const errorStr = e instanceof Error ? e.toString() : String(e);
                console.log(`Error at ${mid} tokens:`, errorStr);
                
                // Only continue binary search for gas errors
                if (!isGasError(e)) {
                    console.log("Non-gas error encountered, stopping search");
                    break;
                }
                right = mid - 1n;
            }
        }

        console.log("\nMaximum non-exempt to non-exempt transfer:", maxTransfer.toString(), "tokens");
        expect(maxTransfer).to.be.greaterThan(0n);
    });

    it("Should find maximum non-exempt to exempt transfer size (burning)", async function() {
        const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
        const [_, nonExempt1] = signers;

        // Transfer tokens in batches of 300 to ensure we have enough for testing
        const batchSize = ethers.parseEther("300");
        console.log("\nTransferring initial tokens in batches...");
        await numberGoUp.connect(owner).transfer(nonExempt1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);
        await numberGoUp.connect(owner).transfer(nonExempt1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);

        // Log initial state
        console.log("\nInitial state:");
        console.log("NonExempt1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
        console.log("NonExempt1 NFT balance:", (await numberGoUp.erc721BalanceOf(nonExempt1.address)).toString());
        console.log("Owner token balance:", ethers.formatEther(await numberGoUp.balanceOf(owner.address)));
        console.log("Owner NFT balance:", (await numberGoUp.erc721BalanceOf(owner.address)).toString());
        
        // Binary search for maximum transfer size
        let left = 1n;
        let right = 500n;
        let maxTransfer = 0n;

        while (left <= right) {
            const mid = (left + right) / 2n;
            const amount = ethers.parseEther(mid.toString());

            try {
                console.log(`\nTrying to transfer ${mid} tokens (and burn NFTs)...`);
                const tx = await numberGoUp.connect(nonExempt1).transfer(owner.address, amount, { gasLimit: MAX_GAS });
                const receipt = await tx.wait();
                if (receipt) {
                    console.log("Gas used:", receipt.gasUsed.toString());
                }
                await delay(100);

                // Log successful transfer details
                console.log("Success!");
                console.log("NonExempt1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("NonExempt1 NFT balance:", (await numberGoUp.erc721BalanceOf(nonExempt1.address)).toString());
                console.log("Owner token balance:", ethers.formatEther(await numberGoUp.balanceOf(owner.address)));
                console.log("Owner NFT balance:", (await numberGoUp.erc721BalanceOf(owner.address)).toString());

                left = mid + 1n;
                maxTransfer = mid;
            } catch (e: unknown) {
                const errorStr = e instanceof Error ? e.toString() : String(e);
                console.log(`Error at ${mid} tokens:`, errorStr);
                
                // Only continue binary search for gas errors
                if (!isGasError(e)) {
                    console.log("Non-gas error encountered, stopping search");
                    break;
                }
                right = mid - 1n;
            }
        }

        console.log("\nMaximum non-exempt to exempt transfer:", maxTransfer.toString(), "tokens");
        expect(maxTransfer).to.be.greaterThan(0n);
    });

    it("Should find maximum staking batch size", async function() {
        const { numberGoUp, owner, signers } = await loadFixture(deployNumberGoUpFixture);
        const [_, user1] = signers;

        // Transfer tokens in batches of 300 to ensure we have enough for testing
        const batchSize = ethers.parseEther("300");
        console.log("\nTransferring initial tokens in batches...");
        await numberGoUp.connect(owner).transfer(user1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);
        await numberGoUp.connect(owner).transfer(user1.address, batchSize, { gasLimit: MAX_GAS });
        await delay(100);

        // Log initial state
        console.log("\nInitial state:");
        console.log("User1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(user1.address)));
        console.log("User1 NFT balance:", (await numberGoUp.erc721BalanceOf(user1.address)).toString());
        console.log("User1 staked token balance:", ethers.formatEther(await numberGoUp.getStakedERC20Balance(user1.address)));
        console.log("User1 staked NFT count:", (await numberGoUp.getStakedERC721Tokens(user1.address)).length.toString());
        
        // Binary search for maximum stake size
        let left = 1n;
        let right = 500n;
        let maxStake = 0n;

        while (left <= right) {
            const mid = (left + right) / 2n;
            
            try {
                // Get actual NFTs owned by user1
                const queueTokens = await numberGoUp.getQueueTokens(user1.address);
                console.log("\nCurrent queue tokens:", queueTokens.map(t => t.toString()));
                
                // Take the first 'mid' tokens from their queue
                const tokenIds = queueTokens.slice(0, Number(mid)).map(id => BigInt(id.toString()));
                console.log(`\nTrying to stake ${mid} NFTs:`, tokenIds.map(t => t.toString()));
                
                const tx = await numberGoUp.connect(user1).stake(tokenIds, { gasLimit: MAX_GAS });
                const receipt = await tx.wait();
                if (receipt) {
                    console.log("Gas used for staking:", receipt.gasUsed.toString());
                }
                await delay(100);

                // Log successful stake details
                console.log("Success!");
                console.log("User1 token balance:", ethers.formatEther(await numberGoUp.balanceOf(user1.address)));
                console.log("User1 NFT balance:", (await numberGoUp.erc721BalanceOf(user1.address)).toString());
                console.log("User1 staked token balance:", ethers.formatEther(await numberGoUp.getStakedERC20Balance(user1.address)));
                console.log("User1 staked NFT count:", (await numberGoUp.getStakedERC721Tokens(user1.address)).length.toString());
                
                // Unstake for next iteration
                console.log("Unstaking for next iteration...");
                const unstakeTx = await numberGoUp.connect(user1).unstake(tokenIds, { gasLimit: MAX_GAS });
                const unstakeReceipt = await unstakeTx.wait();
                if (unstakeReceipt) {
                    console.log("Gas used for unstaking:", unstakeReceipt.gasUsed.toString());
                }
                await delay(100);

                left = mid + 1n;
                maxStake = mid;
            } catch (e: unknown) {
                const errorStr = e instanceof Error ? e.toString() : String(e);
                console.log(`Error at ${mid} tokens:`, errorStr);
                
                // Only continue binary search for gas errors
                if (!isGasError(e)) {
                    console.log("Non-gas error encountered, stopping search");
                    break;
                }
                right = mid - 1n;
            }
        }

        console.log("\nMaximum stake batch size:", maxStake.toString(), "NFTs");
        expect(maxStake).to.be.greaterThan(0n);
    });
});