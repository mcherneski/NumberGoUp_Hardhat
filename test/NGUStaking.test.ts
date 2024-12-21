import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp, NGUStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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

        // Transfer tokens to user1 for testing
        await numberGoUp.connect(owner).transfer(user1.address, INITIAL_TOKENS);
    });

    describe("Initial State", function () {
        it("Should have correct NGU token address", async function () {
            expect(await staking.nguToken()).to.equal(await numberGoUp.getAddress());
        });

        it("Should have correct owner", async function () {
            expect(await staking.owner()).to.equal(owner.address);
        });

        it("Should have zero staked balance initially", async function () {
            expect(await staking.getStakedERC20Balance(user1.address)).to.equal(0);
        });
    });

    describe("Staking", function () {
        it("Should stake single token successfully", async function () {
            // Get user1's first NFT ID
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            expect(ownedNFTs.length).to.be.greaterThan(0);
            
            const tokenId = ownedNFTs[0];
            
            // Approve staking contract
            await numberGoUp.connect(user1).approve(
                await staking.getAddress(),
                UNITS // Approve 1 token
            );

            // Convert tokenId to number for the stake call
            const tokenIdToStake = [BigInt(tokenId.toString())];
            await staking.connect(user1).stake(tokenIdToStake);

            // Verify staking state
            expect(await staking.getStakedOwner(tokenId)).to.equal(user1.address);
            expect(await staking.getStakedIndex(tokenId)).to.equal(0);
            expect(await staking.getStakedERC20Balance(user1.address)).to.equal(UNITS);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            expect(stakedTokens.length).to.equal(1);
            expect(stakedTokens[0]).to.equal(tokenId);
        });

        it("Should stake multiple tokens successfully", async function () {
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const tokenIds = ownedNFTs.slice(0, 3); // Take first 3 NFTs
            
            // Approve staking contract
            await numberGoUp.connect(user1).approve(
                await staking.getAddress(),
                UNITS * 3n // Approve 3 tokens
            );

            // Convert tokenIds to BigInt array
            const tokenIdsToStake = tokenIds.map(id => BigInt(id.toString()));
            await staking.connect(user1).stake(tokenIdsToStake);

            // Verify staking state
            for (let i = 0; i < tokenIds.length; i++) {
                expect(await staking.getStakedOwner(tokenIds[i])).to.equal(user1.address);
                expect(await staking.getStakedIndex(tokenIds[i])).to.equal(i);
            }

            expect(await staking.getStakedERC20Balance(user1.address)).to.equal(UNITS * 3n);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            expect(stakedTokens.length).to.equal(3);
            for (let i = 0; i < tokenIds.length; i++) {
                expect(stakedTokens[i]).to.equal(tokenIds[i]);
            }
        });

        it("Should fail to stake already staked token", async function () {
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const tokenId = ownedNFTs[0];
            const tokenIdToStake = [BigInt(tokenId.toString())];
            
            // First stake
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake(tokenIdToStake);

            // Try to stake again
            await expect(
                staking.connect(user1).stake(tokenIdToStake)
            ).to.be.revertedWithCustomError(staking, "TokenAlreadyStaked");
        });

        it("Should fail to stake with insufficient balance", async function () {
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const tokenId = ownedNFTs[0];
            const tokenIdToStake = [BigInt(tokenId.toString())];
            
            // Transfer all tokens away
            await numberGoUp.connect(user1).transfer(user2.address, INITIAL_TOKENS);

            await expect(
                staking.connect(user1).stake(tokenIdToStake)
            ).to.be.revertedWithCustomError(staking, "StakerInsufficientBalance");
        });
    });

    describe("Unstaking", function () {
        let stakedTokenId: bigint;

        beforeEach(async function () {
            // Setup: Stake a token first
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            stakedTokenId = BigInt(ownedNFTs[0].toString());
            
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake([stakedTokenId]);
        });

        it("Should unstake single token successfully", async function () {
            // Record balances before
            const balanceBefore = await numberGoUp.balanceOf(user1.address);
            
            // Unstake
            await staking.connect(user1).unstake([stakedTokenId]);

            // Verify unstaking
            expect(await staking.getStakedOwner(stakedTokenId)).to.equal(ethers.ZeroAddress);
            expect(await staking.getStakedERC20Balance(user1.address)).to.equal(0);
            expect(await numberGoUp.balanceOf(user1.address)).to.equal(balanceBefore + UNITS);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            expect(stakedTokens.length).to.equal(0);
        });

        it("Should fail to unstake non-staked token", async function () {
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const nonStakedToken = BigInt(ownedNFTs[1].toString());
            
            await expect(
                staking.connect(user1).unstake([nonStakedToken])
            ).to.be.revertedWithCustomError(staking, "NotTokenOwner");
        });

        it("Should fail to unstake token owned by another user", async function () {
            await expect(
                staking.connect(user2).unstake([stakedTokenId])
            ).to.be.revertedWithCustomError(staking, "NotTokenOwner");
        });
    });

    describe("Batch Operations", function () {
        it("Should respect MAX_BATCH_SIZE limit for staking", async function () {
            // Get MAX_BATCH_SIZE and ensure we have enough tokens
            const MAX_BATCH_SIZE = await staking.MAX_BATCH_SIZE();
            
            // Transfer more tokens to user1 if needed for the large batch
            const requiredTokens = UNITS * (BigInt(MAX_BATCH_SIZE) + 1n);
            if ((await numberGoUp.balanceOf(user1.address)) < requiredTokens) {
                await numberGoUp.connect(owner).transfer(user1.address, requiredTokens);
            }

            // Get owned NFTs and ensure we have more than MAX_BATCH_SIZE
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            expect(ownedNFTs.length).to.be.greaterThan(Number(MAX_BATCH_SIZE));

            // Create array with MAX_BATCH_SIZE + 1 tokens
            const tooManyTokens = ownedNFTs.slice(0, Number(MAX_BATCH_SIZE) + 1)
                .map(id => BigInt(id.toString()));
            
            // Verify we actually have more than MAX_BATCH_SIZE tokens
            expect(tooManyTokens.length).to.equal(Number(MAX_BATCH_SIZE) + 1);

            // Approve enough tokens for the large batch
            await numberGoUp.connect(user1).approve(
                await staking.getAddress(),
                requiredTokens
            );

            // Attempt to stake more than MAX_BATCH_SIZE tokens
            await expect(
                staking.connect(user1).stake(tooManyTokens)
            ).to.be.revertedWithCustomError(staking, "BatchSizeExceeded");
        });

        it("Should handle index updates correctly when unstaking from middle", async function () {
            // Stake 3 tokens
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const tokenIds = ownedNFTs.slice(0, 3).map(id => BigInt(id.toString()));
            
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS * 3n);
            await staking.connect(user1).stake(tokenIds);

            // Unstake middle token
            await staking.connect(user1).unstake([tokenIds[1]]);

            // Verify indices were updated correctly
            expect(await staking.getStakedIndex(tokenIds[0])).to.equal(0);
            expect(await staking.getStakedIndex(tokenIds[2])).to.equal(1);

            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            expect(stakedTokens.length).to.equal(2);
            expect(stakedTokens[0]).to.equal(tokenIds[0]);
            expect(stakedTokens[1]).to.equal(tokenIds[2]);
        });
    });

    describe("View Functions", function () {
        it("Should track total balance correctly", async function () {
            const ownedNFTs = await numberGoUp.getOwnedNFTs(user1.address);
            const tokenIds = ownedNFTs.slice(0, 2).map(id => BigInt(id.toString()));
            
            // Initial balance
            const initialBalance = await numberGoUp.balanceOf(user1.address);
            expect(await staking.erc20TotalBalanceOf(user1.address))
                .to.equal(initialBalance);

            // After staking
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS * 2n);
            await staking.connect(user1).stake(tokenIds);

            expect(await staking.erc20TotalBalanceOf(user1.address))
                .to.equal(initialBalance);
        });
    });
}); 