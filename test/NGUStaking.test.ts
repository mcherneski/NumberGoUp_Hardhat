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
        await numberGoUp.connect(owner).setStakingContract(await staking.getAddress());
        // Transfer tokens to user1 for testing
        await numberGoUp.connect(owner).transfer(user1.address, INITIAL_TOKENS);
        console.log('NGU Staking Address:', await staking.getAddress());
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

        it("Should be set as staking contract in NumberGoUp", async function () {
            expect(await numberGoUp.stakingContract()).to.equal(await staking.getAddress());
        });
    });

    describe("Staking", function () {
        it("Should stake single token successfully", async function () {
            // Get user1's first NFT ID
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            expect(fullTokenId.length).to.be.greaterThan(0);
            
            const tokenId = fullTokenId[0];
            console.log("Staking NFT:", formatId[0]);

            // Convert tokenId to number for the stake call
            const tokenIdToStake = fullTokenId[0];
            console.log('tokenIdToStake:', tokenIdToStake);
            console.log('Owner of tokenIdToStake:', await numberGoUp.ownerOf(tokenIdToStake));
            console.log('user 1 address:', user1.address);
            console.log('staking contract address:', await staking.getAddress());
            await staking.connect(user1).stake([tokenIdToStake]);

            // Verify staking state
            expect(await staking.getStakedOwner(tokenId)).to.equal(user1.address);
            expect(await staking.getStakedIndex(tokenId)).to.equal(0);
            expect(await staking.balanceOf(user1.address)).to.equal(UNITS);
            
            // const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            const tokens = await staking.getStakedERC721Tokens(user1.address);
            const stakedTokens = tokens[1]
            console.log("Staked NFTs: ", stakedTokens)
            const id = stakedTokens[0]
            expect(id).to.equal(1n);
            console.log("Successfully staked NFT:", id);
            console.log("Staked NFTs:", stakedTokens.map(id => id.toString()));
        });

        it("Should stake multiple tokens successfully", async function () {
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenIds = fullTokenId.slice(0, 3); // Take first 3 NFTs
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

            expect(await staking.balanceOf(user1.address)).to.equal(UNITS * 3n);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            const stakedTokenIds = stakedTokens[1]
            expect(stakedTokenIds.length).to.equal(3n);
            console.log("Successfully staked NFTs:", stakedTokenIds.map(id => id.toString()));

        });

        it("Should fail to stake already staked token", async function () {
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenId = fullTokenId[0];
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
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenId = fullTokenId[0];
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
            const [fullTokenIds, formatIds] = await numberGoUp.getOwnedERC721Data(user1.address);
            stakedTokenId = BigInt(fullTokenIds[0].toString());
            console.log("Setting up test by staking NFT ID:", stakedTokenId.toString());
            
            await numberGoUp.connect(user1).approve(await staking.getAddress(), UNITS);
            await staking.connect(user1).stake([stakedTokenId]);
        });

        it("Should unstake single token successfully", async function () {
            // Record balances before
            const balanceBefore = await numberGoUp.balanceOf(user1.address);
            console.log("Unstaking NFT ID:", stakedTokenId.toString());
            console.log("Balance before unstaking:", balanceBefore.toString());

            // Unstake
            await staking.connect(user1).unstake([stakedTokenId]);

            // Verify unstaking
            expect(await staking.getStakedOwner(stakedTokenId)).to.equal(ethers.ZeroAddress);
            expect(await staking.balanceOf(user1.address)).to.equal(0);

            const balanceAfter = await numberGoUp.balanceOf(user1.address);
            console.log("Balance after unstaking:", balanceAfter.toString());
            expect(balanceAfter).to.equal(balanceBefore + UNITS);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            const stakedTokenIds = stakedTokens[1];
            expect(stakedTokenIds.length).to.equal(0n);
            console.log("Successfully unstaked NFT ID:", stakedTokenId.toString());
        });

        it("Should fail to unstake non-staked token", async function () {
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const nonStakedToken = BigInt(fullTokenId[1].toString());
            await expect(
                staking.connect(user1).unstake([nonStakedToken])
            ).to.be.revertedWithCustomError(staking, "TokenNotStaked");
        });

        it("Should fail to unstake token getOwnedERC721Data by another user", async function () {
            await expect(
                staking.connect(user2).unstake([stakedTokenId])
            ).to.be.revertedWithCustomError(staking, "NotTokenOwner");
        });
    });

    describe("Batch Operations", function () {
        it("Should handle index updates correctly when unstaking from middle", async function () {
            // Stake 3 tokens
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenIds = fullTokenId.slice(3, 6).map(id => BigInt(id.toString()));
            const formattedIds = formatId.slice(3, 6);
            await staking.connect(user1).stake(tokenIds);

            // Unstake middle token
            await staking.connect(user1).unstake([tokenIds[1]]);

            // Verify indices were updated correctly
            expect(await staking.getStakedIndex(tokenIds[0])).to.equal(0);
            expect(await staking.getStakedIndex(tokenIds[2])).to.equal(1);
            
            const stakedTokens = await staking.getStakedERC721Tokens(user1.address);
            const stakedTokenIds = stakedTokens[1];
            expect(stakedTokenIds.length).to.equal(2n);
            expect(stakedTokenIds[0]).to.equal(4n);
            expect(stakedTokenIds[1]).to.equal(6n);
            
            expect(await staking.getStakedOwner(tokenIds[0])).to.equal(user1.address);
            expect(await staking.getStakedIndex(tokenIds[0])).to.equal(0);

            expect(await staking.getStakedOwner(tokenIds[2])).to.equal(user1.address);
            expect(await staking.getStakedIndex(tokenIds[2])).to.equal(1);

            // Unstake all tokens
            await staking.connect(user1).unstake([tokenIds[0], tokenIds[2]]);
            expect(await staking.balanceOf(user1.address)).to.equal(0);
            expect(await numberGoUp.balanceOf(user1.address)).to.equal(INITIAL_TOKENS);

            const postUnstakeIds = await numberGoUp.getOwnedERC721Data(user1.address);
            const postUnstakeFullIds = postUnstakeIds[0];
            expect(postUnstakeFullIds[0]).to.equal(tokenIds[2]);
            expect(postUnstakeFullIds[1]).to.equal(tokenIds[0]);
        });

        it("Should maintain correct queue order with non-exempt transfers and staking", async function () {
            // Setup: Get two non-exempt users with initial tokens
            const ne1 = user1;
            const ne2 = user2;
            
            // Transfer initial tokens to NE2
            await numberGoUp.connect(owner).transfer(ne2.address, INITIAL_TOKENS);

            // NE1 sends 3 tokens to NE2
            await numberGoUp.connect(ne1).transfer(ne2.address, UNITS * 3n);

            // NE1 stakes 2 non-consecutive tokens from the middle
            const [ne1AfterSendFull, ne1AfterSendFormat] = await numberGoUp.getOwnedERC721Data(ne1.address);
            const tokensToStake = [ne1AfterSendFull[2], ne1AfterSendFull[4]];
            await numberGoUp.connect(ne1).approve(await staking.getAddress(), UNITS * 2n);
            await staking.connect(ne1).stake(tokensToStake);

            // NE2 sends back 3 tokens to NE1
            await numberGoUp.connect(ne2).transfer(ne1.address, UNITS * 3n);

            // NE1 unstakes their tokens
            await staking.connect(ne1).unstake([tokensToStake[0], tokensToStake[1]]);

            // Verify final states after unstaking
            expect(await numberGoUp.balanceOf(ne1.address)).to.equal(INITIAL_TOKENS);
            expect(await numberGoUp.balanceOf(ne2.address)).to.equal(INITIAL_TOKENS);
            expect(await staking.balanceOf(ne1.address)).to.equal(0);
        });
    });

    describe("View Functions", function () {
        it("Should track total balance correctly", async function () {
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(user1.address);
            const tokenIds = fullTokenId.slice(0, 2).map(id => BigInt(id.toString()));
            
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