import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NumberGoUp", function() {
    let ngu: NumberGoUp;
    let owner: SignerWithAddress;
    let exempt1: SignerWithAddress;
    let exempt2: SignerWithAddress;
    let nonExempt1: SignerWithAddress;
    let nonExempt2: SignerWithAddress;
    const UNITS = ethers.parseEther("1");

    beforeEach(async function() {
        [owner, exempt1, exempt2, nonExempt1, nonExempt2] = await ethers.getSigners();
        const NGU = await ethers.getContractFactory("NumberGoUp");
        ngu = await NGU.deploy(
            "NumberGoUp",
            "NGU",
            18,
            10000n,
            owner.address,
            owner.address,
            owner.address,  // SwapRouter
            owner.address   // PositionManager
        );
        await ngu.waitForDeployment();

        // Set up exempt addresses
        await ngu.setERC721TransferExempt(exempt1.address, true);
        await ngu.setERC721TransferExempt(exempt2.address, true);
    });

    describe("Batch Burning", function() {
        it("Should handle large NFT burns in batches when adding exempt status", async function() {
            // Give non-exempt user a large balance
            const initialBalance = UNITS * 5000n;
            await ngu.transfer(nonExempt1.address, initialBalance);
            
            // Wait for initial NFTs to be minted through pending claims
            while ((await ngu.pendingNFTs(nonExempt1.address)) > 0) {
                await ngu.connect(nonExempt1).mintPendingNFTs();
            }

            // Verify initial state
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(5000);
            console.log("Initial NFT balance:", await ngu.erc721BalanceOf(nonExempt1.address));

            // Set user to exempt - this should trigger batch burns
            await ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true);

            // Check immediate burn amount (should be 1000 due to batch size)
            const remainingNFTs = await ngu.erc721BalanceOf(nonExempt1.address);
            console.log("NFTs remaining after initial burn:", remainingNFTs);
            
            // Check pending burns
            const pendingBurns = await ngu.pendingBurns(nonExempt1.address);
            console.log("Pending burns:", pendingBurns);

            // Process remaining burns
            while ((await ngu.pendingBurns(nonExempt1.address)) > 0) {
                await ngu.connect(nonExempt1).burnPendingNFTs();
                console.log("Remaining pending burns:", await ngu.pendingBurns(nonExempt1.address));
            }

            // Verify final state
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(0);
            expect(await ngu.pendingBurns(nonExempt1.address)).to.equal(0);
        });

        it("Should revert when trying to burn with no pending burns", async function() {
            await expect(ngu.connect(nonExempt1).burnPendingNFTs())
                .to.be.revertedWithCustomError(ngu, "NoPendingBurns");
        });

        it("Should handle pending burns correctly during transfers", async function() {
            // Setup: Give exempt user tokens and transfer to non-exempt
            const transferAmount = UNITS * 2500n;
            await ngu.transfer(exempt1.address, transferAmount);
            await ngu.connect(exempt1).transfer(nonExempt1.address, transferAmount);

            // Process initial pending NFTs
            while ((await ngu.pendingNFTs(nonExempt1.address)) > 0) {
                await ngu.connect(nonExempt1).mintPendingNFTs();
            }

            // Verify NFTs were minted
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(2500);

            // Set to exempt to trigger burns
            await ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true);

            // Process pending burns
            while ((await ngu.pendingBurns(nonExempt1.address)) > 0) {
                await ngu.connect(nonExempt1).burnPendingNFTs();
            }

            // Verify final state
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(0);
            expect(await ngu.pendingBurns(nonExempt1.address)).to.equal(0);
        });
    });
});
