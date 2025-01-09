import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

async function logState(ngu: NumberGoUp, address: string, label: string) {
    const erc20Balance = await ngu.erc20BalanceOf(address);
    const erc721Balance = await ngu.erc721BalanceOf(address);
    const [fullTokenIds, formattedIds] = await ngu.getOwnedERC721Data(address);
    
    console.log(`\n=== State for ${label} (${address}) ===`);
    console.log(`ERC20 Balance: ${ethers.formatEther(erc20Balance)} NGU`);
    console.log(`ERC721 Balance: ${erc721Balance} NFTs`);
    console.log(`Owned NFTs (formatted): [${formattedIds.map(id => id.toString()).join(', ')}]`);
    console.log('=======================================\n');
}

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

    describe("Core Functionality", function() {
        it("Should handle NFT burns when adding exempt status", async function() {
            console.log("\n=== Testing NFT Burns When Adding Exempt Status ===");
            
            // Transfer tokens to non-exempt user
            const balance = UNITS * 10n;
            console.log(`\nTransferring ${ethers.formatEther(balance)} NGU to non-exempt user...`);
            await ngu.transfer(nonExempt1.address, balance);
            console.log("\nAfter transferring to non-exempt user:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // First attempt to make exempt should fail due to balance
            console.log("\nAttempting to make address exempt with non-zero balance (should fail)...");
            await expect(
                ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true)
            ).to.be.revertedWith("Cannot make address exempt while holding ERC20 balance");

            // Transfer tokens away
            console.log(`\nTransferring ${ethers.formatEther(balance)} NGU away to exempt1...`);
            await ngu.connect(nonExempt1).transfer(exempt1.address, balance);
            console.log("\nAfter transferring tokens away:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Now making exempt should succeed
            console.log("\nAttempting to make address exempt with zero balance (should succeed)...");
            await ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true);
            console.log("\nAfter setting exempt status:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Verify final state
            expect(await ngu.erc721TransferExempt(nonExempt1.address)).to.equal(true);
            expect(await ngu.erc20BalanceOf(nonExempt1.address)).to.equal(0);
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(0);
        });

        it("Should handle NFT minting when removing exempt status", async function() {
            console.log("\n=== Testing NFT Minting When Removing Exempt Status ===");
            
            // Give exempt user tokens
            const transferAmount = UNITS * 5n;
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU to exempt user...`);
            await ngu.transfer(exempt1.address, transferAmount);
            console.log("\nAfter transferring to exempt user:");
            await logState(ngu, exempt1.address, "Exempt1");
            
            // Remove exempt status - should mint NFTs
            console.log("\nRemoving exempt status (should mint NFTs)...");
            await ngu.connect(owner).setERC721TransferExempt(exempt1.address, false);
            console.log("\nAfter removing exempt status:");
            await logState(ngu, exempt1.address, "Exempt1");

            // Verify final state
            expect(await ngu.erc721BalanceOf(exempt1.address)).to.equal(5);
            expect(await ngu.erc20BalanceOf(exempt1.address)).to.equal(transferAmount);
        });

        it("Should handle transfers between exempt and non-exempt addresses", async function() {
            console.log("\n=== Testing Transfers Between Exempt and Non-Exempt ===");
            
            // Setup: Give exempt user tokens and transfer to non-exempt
            const transferAmount = UNITS * 5n;
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU to exempt user...`);
            await ngu.transfer(exempt1.address, transferAmount);
            console.log("\nAfter transferring to exempt user:");
            await logState(ngu, exempt1.address, "Exempt1");
            
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU from exempt to non-exempt...`);
            await ngu.connect(exempt1).transfer(nonExempt1.address, transferAmount);
            console.log("\nAfter transferring from exempt to non-exempt:");
            await logState(ngu, exempt1.address, "Exempt1");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Transfer back to exempt user
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU back to exempt user...`);
            await ngu.connect(nonExempt1).transfer(exempt1.address, transferAmount);
            console.log("\nAfter transferring back to exempt:");
            await logState(ngu, exempt1.address, "Exempt1");
            await logState(ngu, nonExempt1.address, "NonExempt1");
        });

        it("Should handle transfers between non-exempt addresses", async function() {
            console.log("\n=== Testing Transfers Between Non-Exempt Addresses ===");
            
            // Setup initial tokens
            const transferAmount = UNITS * 5n;
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU to first non-exempt user...`);
            await ngu.transfer(nonExempt1.address, transferAmount);
            console.log("\nAfter initial transfer to first non-exempt:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Transfer to another non-exempt address
            const secondTransfer = UNITS * 3n;
            console.log(`\nTransferring ${ethers.formatEther(secondTransfer)} NGU between non-exempt addresses...`);
            await ngu.connect(nonExempt1).transfer(nonExempt2.address, secondTransfer);
            console.log("\nAfter transfer between non-exempt addresses:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, nonExempt2.address, "NonExempt2");
        });
    });

    describe("Fractional Transfers", function() {
        const HALF_UNIT = UNITS / 2n;
        const QUARTER_UNIT = UNITS / 4n;

        beforeEach(async function() {
            // Give initial balance only to exempt1
            await ngu.transfer(exempt1.address, UNITS * 5n);
        });

        it("Should handle fractional transfers between exempt addresses", async function() {
            console.log("\n=== Testing Fractional Transfers Between Exempt Addresses ===");
            
            // Transfer 1.5 tokens
            const transferAmount = UNITS + HALF_UNIT;
            console.log(`\nTransferring ${ethers.formatEther(transferAmount)} NGU from Exempt1 to Exempt2...`);
            await ngu.connect(exempt1).transfer(exempt2.address, transferAmount);

            console.log("\nAfter transfer:");
            await logState(ngu, exempt1.address, "Exempt1");
            await logState(ngu, exempt2.address, "Exempt2");

            // Verify balances
            expect(await ngu.erc20BalanceOf(exempt1.address)).to.equal(UNITS * 5n - transferAmount);
            expect(await ngu.erc20BalanceOf(exempt2.address)).to.equal(transferAmount);
            // No NFTs should be involved
            expect(await ngu.erc721BalanceOf(exempt1.address)).to.equal(0);
            expect(await ngu.erc721BalanceOf(exempt2.address)).to.equal(0);
        });

        it("Should handle fractional transfers from exempt to non-exempt", async function() {
            console.log("\n=== Testing Fractional Transfers from Exempt to Non-Exempt ===\n");
            
            // Transfer 2.75 NGU from Exempt1 to NonExempt1
            console.log("Transferring 2.75 NGU from Exempt1 to NonExempt1...\n");
            await ngu.connect(exempt1).transfer(nonExempt1.address, ethers.parseEther("2.75"));

            console.log("After transfer:\n");
            await logState(ngu, exempt1.address, "Exempt1");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            console.log("\n");

            // NonExempt1 should have 2 NFTs (floor of 2.75)
            expect(await ngu.balanceOf(nonExempt1.address)).to.equal(ethers.parseEther("2.75"));
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(2);
        });

        it("Should handle fractional transfers from non-exempt to exempt", async function() {
            // First give tokens to non-exempt user
            await ngu.connect(owner).transfer(nonExempt1.address, UNITS * 5n);
            console.log("\nTransferring 3.25 NGU from NonExempt1 to Exempt1...");
            await ngu.connect(nonExempt1).transfer(exempt1.address, UNITS * 325n / 100n);
        });

        it("Should handle fractional transfers between non-exempt addresses", async function() {
            // First give tokens to first non-exempt user
            await ngu.connect(owner).transfer(nonExempt1.address, UNITS * 5n);
            console.log("\nTransferring 4.5 NGU from NonExempt1 to NonExempt2...");
            await ngu.connect(nonExempt1).transfer(nonExempt2.address, UNITS * 45n / 10n);
        });

        it("Should handle multiple fractional transfers maintaining correct NFT counts", async function() {
            // First give tokens to exempt1
            await ngu.connect(owner).transfer(exempt1.address, UNITS * 5n);

            console.log("\nStep 1: Transferring 1.75 NGU from Exempt1 to NonExempt1...");
            await ngu.connect(exempt1).transfer(nonExempt1.address, UNITS * 175n / 100n);
            console.log("\nAfter first transfer:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            console.log("\nStep 2: Transferring 0.5 NGU from NonExempt1 to Exempt2...");
            await ngu.connect(nonExempt1).transfer(exempt2.address, UNITS * 50n / 100n);
            console.log("\nAfter second transfer:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, exempt2.address, "Exempt2");

            console.log("\nStep 3: Transferring 1.25 NGU from NonExempt1 to NonExempt2...");
            await ngu.connect(nonExempt1).transfer(nonExempt2.address, UNITS * 125n / 100n);
            console.log("\nFinal state:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, nonExempt2.address, "NonExempt2");
        });
    });

    describe("Gas Analysis", function() {
        it("Should measure gas cost for burning NFTs", async function() {
            console.log("\n=== Testing NFT Burn Gas Costs ===");
            
            // First, give non-exempt user a large balance to create many NFTs
            const initialBalance = UNITS * 100n; // 100 tokens = 100 NFTs
            console.log(`\nTransferring ${ethers.formatEther(initialBalance)} NGU to non-exempt user (will create 100 NFTs)...`);
            await ngu.transfer(nonExempt1.address, initialBalance);
            console.log("\nAfter transferring to non-exempt user:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Now transfer to exempt user to trigger burns
            console.log(`\nTransferring ${ethers.formatEther(initialBalance)} NGU to exempt user (will burn 100 NFTs)...`);
            const tx = await ngu.connect(nonExempt1).transfer(exempt1.address, initialBalance);
            const receipt = await tx.wait();
            const gasUsed = receipt?.gasUsed || 0n;
            const nftsBurned = 100; // We know we burned 100 NFTs

            console.log(`Gas used: ${gasUsed}`);
            console.log(`NFTs burned: ${nftsBurned}`);
            console.log(`Gas per NFT burn: ${Number(gasUsed) / nftsBurned}`);

            // Verify final state
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, exempt1.address, "Exempt1");
        });
    });

    describe("Exemption Management", function() {
        it("Should prevent address with non-zero balance from becoming exempt", async function() {
            console.log("\n=== Testing Exemption with Non-Zero Balance ===");
            
            // Give non-exempt user some tokens
            const balance = UNITS * 5n;
            console.log(`\nTransferring ${ethers.formatEther(balance)} NGU to non-exempt user...`);
            await ngu.transfer(nonExempt1.address, balance);
            console.log("\nAfter giving tokens to non-exempt user:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Try to make them exempt (should fail)
            console.log("\nAttempting to make address exempt with non-zero balance (should fail)...");
            await expect(
                ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true)
            ).to.be.revertedWith("Cannot make address exempt while holding ERC20 balance");

            // Verify state remains unchanged
            expect(await ngu.erc721TransferExempt(nonExempt1.address)).to.equal(false);
            expect(await ngu.erc20BalanceOf(nonExempt1.address)).to.equal(balance);
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(5);
        });

        it("Should allow address with zero balance to become exempt", async function() {
            console.log("\n=== Testing Exemption with Zero Balance ===");
            
            console.log("\nBefore setting exempt status:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Make address exempt (should succeed)
            console.log("\nAttempting to make address exempt with zero balance (should succeed)...");
            await ngu.connect(owner).setERC721TransferExempt(nonExempt1.address, true);

            console.log("\nAfter setting exempt status:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Verify state
            expect(await ngu.erc721TransferExempt(nonExempt1.address)).to.equal(true);
            expect(await ngu.erc20BalanceOf(nonExempt1.address)).to.equal(0);
            expect(await ngu.erc721BalanceOf(nonExempt1.address)).to.equal(0);
        });

        it("Should allow removing exempt status regardless of balance", async function() {
            console.log("\n=== Testing Removing Exempt Status ===");
            
            // Give exempt user some tokens
            const balance = UNITS * 5n;
            console.log(`\nTransferring ${ethers.formatEther(balance)} NGU to exempt user...`);
            await ngu.transfer(exempt1.address, balance);
            console.log("\nAfter giving tokens to exempt user:");
            await logState(ngu, exempt1.address, "Exempt1");

            // Remove exempt status (should succeed)
            console.log("\nRemoving exempt status (should mint NFTs)...");
            await ngu.connect(owner).setERC721TransferExempt(exempt1.address, false);
            console.log("\nAfter removing exempt status:");
            await logState(ngu, exempt1.address, "Exempt1");

            // Verify state
            expect(await ngu.erc721TransferExempt(exempt1.address)).to.equal(false);
            expect(await ngu.erc20BalanceOf(exempt1.address)).to.equal(balance);
            expect(await ngu.erc721BalanceOf(exempt1.address)).to.equal(5);
        });
    });

    describe("Queue Ordering", function() {
        let stakingContract: any;

        beforeEach(async function() {
            // Deploy staking contract
            const NGUStaking = await ethers.getContractFactory("NGUStaking");
            stakingContract = await NGUStaking.deploy(await ngu.getAddress(), owner.address);
            await stakingContract.waitForDeployment();

            // Set staking contract in NGU
            await ngu.setStakingContract(await stakingContract.getAddress());

            // Initial setup logging
            console.log("\n=== Initial Setup ===");
            await logState(ngu, owner.address, "Owner");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, nonExempt2.address, "NonExempt2");
        });

        it("Should maintain correct NFT ordering through transfers and staking", async function() {
            console.log("\n=== Testing Queue Ordering Through Complex Operations ===");

            // Step 1: Transfer 5 NGU to nonExempt1
            console.log("\nStep 1: Transferring 5.0 NGU to NonExempt1 (creates 5 NFTs)...");
            await ngu.connect(owner).transfer(nonExempt1.address, ethers.parseEther("5"));

            console.log("\nAfter initial transfer:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 2: Transfer 2 NGU from nonExempt1 to nonExempt2
            console.log("\nStep 2: Transferring 2.0 NGU from NonExempt1 to NonExempt2...");
            await ngu.connect(nonExempt1).transfer(nonExempt2.address, ethers.parseEther("2"));

            console.log("\nAfter transfer between users:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, nonExempt2.address, "NonExempt2");

            // Step 3: nonExempt1 stakes 2 NFTs
            console.log("\nStep 3: NonExempt1 staking 2 NFTs...");
            const [nonExempt1NFTs] = await ngu.getOwnedERC721Data(nonExempt1.address);
            await ngu.connect(nonExempt1).approve(await stakingContract.getAddress(), ethers.parseEther("2"));
            await stakingContract.connect(nonExempt1).stake([nonExempt1NFTs[0], nonExempt1NFTs[1]]);

            console.log("\nAfter staking:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 4: nonExempt2 stakes 1 NFT
            console.log("\nStep 4: NonExempt2 staking 1 NFT...");
            const [nonExempt2NFTs] = await ngu.getOwnedERC721Data(nonExempt2.address);
            await ngu.connect(nonExempt2).approve(await stakingContract.getAddress(), ethers.parseEther("1"));
            await stakingContract.connect(nonExempt2).stake([nonExempt2NFTs[0]]);

            console.log("\nAfter NonExempt2 staking:");
            await logState(ngu, nonExempt2.address, "NonExempt2");

            // Step 5: nonExempt1 unstakes 1 NFT
            console.log("\nStep 5: NonExempt1 unstaking 1 NFT...");
            const [stakedNFTs] = await stakingContract.getStakedERC721Tokens(nonExempt1.address);
            await stakingContract.connect(nonExempt1).unstake([stakedNFTs[0]]);

            console.log("\nAfter unstaking:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 6: nonExempt1 transfers remaining unstaked NFT to nonExempt2
            console.log("\nStep 6: NonExempt1 transferring remaining unstaked NFT to NonExempt2...");
            await ngu.connect(nonExempt1).transfer(nonExempt2.address, ethers.parseEther("1"));

            console.log("\nFinal state:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
            await logState(ngu, nonExempt2.address, "NonExempt2");
        });

        it("Should handle rapid unstaking and restaking", async function() {
            console.log("\n=== Testing Rapid Unstaking and Restaking ===");

            // Step 1: Transfer 3 NGU to nonExempt1
            console.log("\nStep 1: Transferring 3.0 NGU to NonExempt1 (creates 3 NFTs)...");
            await ngu.connect(owner).transfer(nonExempt1.address, ethers.parseEther("3"));

            console.log("\nAfter initial transfer:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 2: Stake all 3 NFTs
            console.log("\nStep 2: Staking all 3 NFTs...");
            const [initialNFTs] = await ngu.getOwnedERC721Data(nonExempt1.address);
            await ngu.connect(nonExempt1).approve(await stakingContract.getAddress(), ethers.parseEther("3"));
            await stakingContract.connect(nonExempt1).stake([initialNFTs[0], initialNFTs[1], initialNFTs[2]]);

            console.log("\nAfter staking all NFTs:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 3: Unstake 2 NFTs
            console.log("\nStep 3: Unstaking 2 NFTs...");
            const [stakedNFTs] = await stakingContract.getStakedERC721Tokens(nonExempt1.address);
            await stakingContract.connect(nonExempt1).unstake([stakedNFTs[0], stakedNFTs[1]]);

            console.log("\nAfter unstaking 2 NFTs:");
            await logState(ngu, nonExempt1.address, "NonExempt1");

            // Step 4: Restake 1 NFT
            console.log("\nStep 4: Restaking 1 NFT...");
            const [currentNFTs] = await ngu.getOwnedERC721Data(nonExempt1.address);
            await ngu.connect(nonExempt1).approve(await stakingContract.getAddress(), ethers.parseEther("1"));
            await stakingContract.connect(nonExempt1).stake([currentNFTs[0]]);

            console.log("\nFinal state:");
            await logState(ngu, nonExempt1.address, "NonExempt1");
        });
    });
});
