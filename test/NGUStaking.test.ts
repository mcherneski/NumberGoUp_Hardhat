import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp, NGUStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

async function logState(numberGoUp: NumberGoUp, staking: NGUStaking, address: string, label: string) {
    const erc20Balance = await numberGoUp.erc20BalanceOf(address);
    const erc721Balance = await numberGoUp.erc721BalanceOf(address);
    const [fullTokenIds, formattedIds] = await numberGoUp.getOwnedERC721Data(address);
    const stakedBalance = await staking.balanceOf(address);
    const [stakedFullIds, stakedFormattedIds] = await staking.getStakedERC721Tokens(address);
    
    console.log(`\n=== State for ${label} (${address}) ===`);
    console.log(`ERC20 Balance: ${ethers.formatEther(erc20Balance)} NGU`);
    console.log(`ERC721 Balance: ${erc721Balance} NFTs`);
    console.log(`Owned NFTs (formatted): [${formattedIds.map(id => id.toString()).join(', ')}]`);
    console.log(`Staked Balance: ${ethers.formatEther(stakedBalance)} NGU`);
    console.log(`Staked NFTs (formatted): [${stakedFormattedIds.map(id => id.toString()).join(', ')}]`);
    console.log('=======================================\n');
}

describe("NGUStaking", function () {
    let numberGoUp: NumberGoUp;
    let staking: NGUStaking;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let addrs: SignerWithAddress[];

    const NAME = "Number Go Up";
    const SYMBOL = "NGU";
    const DECIMALS = 18n;
    const MAX_SUPPLY = 10_000n;
    const UNITS = 10n ** DECIMALS;
    const INITIAL_TOKENS = 10n * UNITS; // 10 tokens for testing

    beforeEach(async function () {
        [owner, user1, user2, ...addrs] = await ethers.getSigners();

        // Deploy NumberGoUp
        const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
        numberGoUp = await NumberGoUp.deploy(
            NAME,
            SYMBOL,
            DECIMALS,
            MAX_SUPPLY,
            owner.address,
            owner.address,
            addrs[0].address,
            addrs[1].address
        );

        // Deploy Staking contract
        const NGUStaking = await ethers.getContractFactory("NGUStaking");
        staking = await NGUStaking.deploy(
            await numberGoUp.getAddress(),
            owner.address
        );
        await numberGoUp.connect(owner).setStakingContract(await staking.getAddress());
        // Transfer tokens to user1 for testing
        await numberGoUp.connect(owner).transfer(user1.address, INITIAL_TOKENS);
        console.log('\n=== Initial Setup ===');
        console.log('NGU Staking Address:', await staking.getAddress());
        await logState(numberGoUp, staking, owner.address, "Owner");
        await logState(numberGoUp, staking, user1.address, "User1");
        await logState(numberGoUp, staking, user2.address, "User2");
    });

    describe("Initial State", function () {
        it("Should have correct NGU token address", async function () {
            expect(await staking.nguToken()).to.equal(await numberGoUp.getAddress());
        });

        it("Should have correct owner", async function () {
            expect(await staking.owner()).to.equal(owner.address);
        });

        it("Should have zero staked balance initially", async function () {
            expect(await staking.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("Staking", function () {
        it("Should stake single token successfully", async function () {
            console.log("\n=== Testing Single Token Staking ===");
            
            // Get user1's first NFT ID
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            expect(fullTokenId.length).to.be.greaterThan(0);
            
            const tokenId = fullTokenId[0];
            console.log("\nBefore staking:");
            await logState(numberGoUp, staking, user1.address, "User1");

            // Convert tokenId to number for the stake call
            const tokenIdToStake = fullTokenId[0];
            await staking.connect(user1).stake([tokenIdToStake]);

            console.log("\nAfter staking:");
            await logState(numberGoUp, staking, user1.address, "User1");
        });

        it("Should fail to stake already staked token", async function () {
            console.log("\n=== Testing Double Staking Prevention ===");
            
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenId = fullTokenId[0];
            const tokenIdToStake = [BigInt(tokenId.toString())];
            
            console.log("\nBefore first stake:");
            await logState(numberGoUp, staking, user1.address, "User1");
            
            // First stake
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake(tokenIdToStake);

            console.log("\nAfter first stake:");
            await logState(numberGoUp, staking, user1.address, "User1");

            // Try to stake again
            await expect(
                staking.connect(user1).stake(tokenIdToStake)
            ).to.be.revertedWithCustomError(staking, "TokenAlreadyStaked");
        });

        it("Should fail to stake with insufficient balance", async function () {
            console.log("\n=== Testing Insufficient Balance Check ===");
            
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenId = fullTokenId[0];
            const tokenIdToStake = [BigInt(tokenId.toString())];
            
            console.log("\nBefore transferring away tokens:");
            await logState(numberGoUp, staking, user1.address, "User1");
            await logState(numberGoUp, staking, user2.address, "User2");
            
            // Transfer all tokens away
            await numberGoUp.connect(user1).transfer(user2.address, INITIAL_TOKENS);

            console.log("\nAfter transferring away tokens:");
            await logState(numberGoUp, staking, user1.address, "User1");
            await logState(numberGoUp, staking, user2.address, "User2");

            await expect(
                staking.connect(user1).stake(tokenIdToStake)
            ).to.be.revertedWithCustomError(staking, "StakerInsufficientBalance");
        });
    });

    describe("Unstaking", function () {
        let stakedTokenId: bigint;

        beforeEach(async function () {
            console.log("\n=== Setting Up Unstaking Tests ===");
            
            // Setup: Stake a token first
            const [fullTokenIds, formatIds] = await numberGoUp.getOwnedERC721Data(user1.address);
            stakedTokenId = BigInt(fullTokenIds[0].toString());
            
            console.log("\nBefore staking setup:");
            await logState(numberGoUp, staking, user1.address, "User1");
            
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake([stakedTokenId]);
            
            console.log("\nAfter staking setup:");
            await logState(numberGoUp, staking, user1.address, "User1");
        });

        it("Should unstake single token successfully", async function () {
            console.log("\n=== Testing Single Token Unstaking ===");
            
            console.log("\nBefore unstaking:");
            await logState(numberGoUp, staking, user1.address, "User1");

            // Unstake
            await staking.connect(user1).unstake([stakedTokenId]);

            console.log("\nAfter unstaking:");
            await logState(numberGoUp, staking, user1.address, "User1");
        });

        it("Should fail to unstake non-staked token", async function () {
            console.log("\n=== Testing Non-staked Token Unstaking ===");
            
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const nonStakedToken = BigInt(fullTokenId[1].toString());
            
            console.log("\nBefore attempting invalid unstake:");
            await logState(numberGoUp, staking, user1.address, "User1");
            
            await expect(
                staking.connect(user1).unstake([nonStakedToken])
            ).to.be.revertedWithCustomError(staking, "TokenNotStaked");
        });

        it("Should fail to unstake token owned by another user", async function () {
            console.log("\n=== Testing Unauthorized Unstaking ===");
            
            console.log("\nBefore attempting unauthorized unstake:");
            await logState(numberGoUp, staking, user1.address, "User1");
            await logState(numberGoUp, staking, user2.address, "User2");
            
            await expect(
                staking.connect(user2).unstake([stakedTokenId])
            ).to.be.revertedWithCustomError(staking, "NotTokenOwner");
        });
    });

    describe("View Functions", function () {
        it("Should track total balance correctly", async function () {
            console.log("\n=== Testing Balance Tracking ===");
            
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenId = fullTokenId[0];
            const tokenIdToStake = [BigInt(tokenId.toString())];
            
            console.log("\nInitial state:");
            await logState(numberGoUp, staking, user1.address, "User1");

            // After staking
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake(tokenIdToStake);

            console.log("\nAfter staking:");
            await logState(numberGoUp, staking, user1.address, "User1");
        });
    });
}); 