import { ethers } from "hardhat";
import { expect } from "chai";
import { parseUnits, formatUnits, BigNumberish } from "ethers";
import { NumberGoUp, NGUStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NumberGoUp Tests", function () {
    let numberGoUp: NumberGoUp;
    let staking: NGUStaking;
    let owner: SignerWithAddress;
    let initialMintRecipient: SignerWithAddress;
    let addrs: SignerWithAddress[];
    let exempt1: SignerWithAddress;
    let exempt2: SignerWithAddress;
    let nonExempt1: SignerWithAddress;
    let nonExempt2: SignerWithAddress;
    
    const NAME = "NumberGoUp";
    const SYMBOL = "NGU";
    const DECIMALS = 18;
    const MAX_SUPPLY = 10000n;

    beforeEach(async function () {


        [owner, initialMintRecipient, exempt1, exempt2, nonExempt1, nonExempt2, ...addrs] = await ethers.getSigners();

        // Deploy NumberGoUp
        const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
        numberGoUp = await NumberGoUp.deploy(
            NAME,
            SYMBOL,
            DECIMALS,
            MAX_SUPPLY,
            owner.address,
            owner.address,
            addrs[0].address, // SwapRouter
            addrs[1].address  // PositionManager
        );
        await numberGoUp.waitForDeployment();

        // Deploy NGUStaking
        const NGUStaking = await ethers.getContractFactory("NGUStaking");
        staking = await NGUStaking.deploy(
            await numberGoUp.getAddress(),
            owner.address  // initialOwner
        );
        await staking.waitForDeployment();

        
        // Set up exempt status
        await numberGoUp.connect(owner).setERC721TransferExempt(exempt1.address, true);
        await numberGoUp.connect(owner).setERC721TransferExempt(exempt2.address, true);
        
        expect(await numberGoUp.balanceOf(owner.address), "Owner Balance Equals max supply times 10^18").to.equal(MAX_SUPPLY * BigInt(10 ** DECIMALS));
        // Initial token distribution - increased amounts for testing
        await numberGoUp.connect(owner).transfer(nonExempt1.address, parseUnits("5"));
        await numberGoUp.connect(owner).transfer(nonExempt2.address, parseUnits("5"));
        await numberGoUp.connect(owner).transfer(exempt1.address, parseUnits("5"));
        await numberGoUp.connect(owner).transfer(exempt2.address, parseUnits("5"));
        
        expect(await numberGoUp.balanceOf(nonExempt1.address), "NonExempt1 Balance Equals 5").to.equal(parseUnits("5"));
        expect(await numberGoUp.balanceOf(nonExempt2.address), "NonExempt2 Balance Equals 5").to.equal(parseUnits("5"));
        expect(await numberGoUp.balanceOf(exempt1.address), "Exempt1 Balance Equals 5").to.equal(parseUnits("5"));
        expect(await numberGoUp.balanceOf(exempt2.address), "Exempt2 Balance Equals 5").to.equal(parseUnits("5"));
        
        return [exempt1, exempt2, nonExempt1, nonExempt2, numberGoUp, NGUStaking];
    });

    describe("NumberGoUp - Initial State", function () {
        describe("Basic Token Information", function () {
            it("Should have correct name", async function () {
                expect(await numberGoUp.name()).to.equal(NAME);
            });

            it("Should have correct symbol", async function () {
                expect(await numberGoUp.symbol()).to.equal(SYMBOL);
            });

            it("Should have correct decimals", async function () {
                expect(await numberGoUp.decimals()).to.equal(DECIMALS);
            });

            it("Should have correct units", async function () {
                expect(await numberGoUp.units()).to.equal(parseUnits("1"));
            });
        });

        describe("Initial Supply and Balances", function () {
            it("Should have correct total supply", async function () {
                const totalSupply = await numberGoUp.totalSupply();
                console.log("Total supply:", totalSupply);
                console.log("MAX_SUPPLY:", MAX_SUPPLY);
                console.log("DECIMALS:", DECIMALS);
                console.log("MAX_SUPPLY * BigInt(10 ** DECIMALS):", MAX_SUPPLY * BigInt(10 ** DECIMALS));
                
                expect(totalSupply).to.equal(MAX_SUPPLY * BigInt(10 ** DECIMALS));
            });

            it("Should have correct initial balances for other accounts", async function () {
                // Check that addresses beyond our initial distribution have zero balance
                const [, , , , , , extraAddr] = await ethers.getSigners();
                expect(await numberGoUp.balanceOf(extraAddr.address)).to.equal(0);
            });
        });

        describe("Initial NFT State", function () {
            it("Should have correct initial NFT count for recipient", async function () {
                const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(owner.address);
                console.log("Initial NFTs:", formatId.map(n => n.toString()));
                expect(fullTokenId.length).to.equal(0);
            });

            it("Should have correct initial minted count", async function () {
                const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(owner.address);
                console.log("Initial minted NFTs:", formatId.map(n => n.toString()));
                expect(fullTokenId.length).to.equal(0);
            });
        });

        describe("Initial Permissions", function () {
            it("Should set initial recipient as ERC721 transfer exempt", async function () {
                expect(await numberGoUp.erc721TransferExempt(owner.address)).to.be.true;
            });

            it("Should set owner as exemption manager", async function () {
                expect(await numberGoUp.hasRole(await numberGoUp.EXEMPTION_MANAGER_ROLE(), owner.address)).to.be.true;
            });

            it("Should set owner as default admin", async function () {
                expect(await numberGoUp.hasRole(await numberGoUp.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            });
        });
    });

    describe("Non-Exempt to Exempt Transfers", function () {
        it("Should transfer single token ", async function () {
            // Initial state
            console.log("\nSingle Token Transfer (Non-Exempt → Exempt): 1 ERC20");
            // Transfer
            const tx = await numberGoUp.connect(nonExempt1).transfer(exempt2.address, parseUnits("1"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            console.log("\nFinal State: nonExempt1 transferred 1 token to exempt2");
            const [finalFullTokenId, finalFormatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            console.log(`TokenURI Example: ${await numberGoUp.tokenURI(finalFullTokenId[0])}`)
            const [finalReceiverFullTokenId, finalReceiverFormatId] = await numberGoUp.getOwnedERC721Data(exempt2.address);
            console.log("Sender (nonExempt1) getOwnedERC721Data tokens:", finalFormatId.map(id => id.toString()));
            console.log("Receiver (exempt2) getOwnedERC721Data tokens:", finalReceiverFormatId.map(id => id.toString()));
            console.log("Sender (nonExempt1) balance:", formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));
        });

        it("Should transfer multiple tokens ", async function () {
            // Initial state
            console.log("\nMultiple Token Transfer (Non-Exempt → Exempt): 5 ERC20s\n");
            console.log("Initial State:");
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [receiverFullTokenId, receiverFormatId] = await numberGoUp.getOwnedERC721Data(exempt2.address);
            console.log("Sender (nonExempt1) getOwnedERC721Data tokens:", formatId);
            console.log("Receiver (exempt2) getOwnedERC721Data tokens:", receiverFormatId);
            console.log("Sender (nonExempt1) balance:", formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));

            // Transfer
            const tx = await numberGoUp.connect(nonExempt1).transfer(exempt2.address, parseUnits("5"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            console.log("\nFinal State:");
            const [finalFullTokenId, finalFormatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [finalReceiverFullTokenId, finalReceiverFormatId] = await numberGoUp.getOwnedERC721Data(exempt2.address);
            console.log("Sender (nonExempt1) getOwnedERC721Data tokens:", finalFormatId);
            console.log("Receiver (exempt2) getOwnedERC721Data tokens:", finalReceiverFormatId);
            console.log("Sender (nonExempt1) balance:", formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));
        });
    });
    describe("Exempt to Non-Exempt Transfers", function () {
        it("Should transfer single token", async function () {

            console.log("\nSingle Token Transfer (Exempt → Non-Exempt): 1 ERC20");
            // Initial state
            console.log("Initial State:");
            const initialBalance = await numberGoUp.balanceOf(nonExempt1.address);
            console.log("Receiver (nonExempt1) initial balance:", formatUnits(initialBalance));
            console.log('Receiver (NE) NFTS: ', await numberGoUp.erc721BalanceOf(nonExempt1.address));
            // Transfer
            const tx = await numberGoUp.connect(exempt1).transfer(nonExempt1.address, parseUnits("1"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            const [finalTokenId, finalFormatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            console.log("\nFinal State:");
            console.log("Receiver balance:", formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            
            // Verify NFT was minted to receiver
            console.log("Final nonExempt1 ERC20s: ", await numberGoUp.balanceOf(nonExempt1.address));
            const finalNFTCount = await numberGoUp.erc721BalanceOf(nonExempt1.address);
            expect(finalNFTCount).to.equal(6n);
        });

        it("Should transfer multiple tokens", async function () {
            console.log("\nMultiple Token Transfer (Exempt → Non-Exempt): 5 ERC20s");
            // Initial state
            console.log("Initial State:");
            const initialBalance = await numberGoUp.balanceOf(nonExempt1.address);
            console.log("Receiver (nonExempt1) initial balance:", formatUnits(initialBalance));

            // Transfer
            const tx = await numberGoUp.connect(exempt1).transfer(nonExempt1.address, parseUnits("5"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            const [finalTokenId, finalFormatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            console.log("\nFinal State:");
            console.log("Receiver balance:", formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            
            // Verify correct number of NFTs were minted
            expect(finalTokenId.length).to.equal(Math.floor(Number(formatUnits(await numberGoUp.balanceOf(nonExempt1.address)))));
        });
    });

    describe("Non-Exempt to Non-Exempt Transfers", function () {
        it("Should transfer single token", async function () {


            console.log("\nSingle Token Transfer (Non-Exempt → Non-Exempt): 1 ERC20");
            // Initial state
            const [initialTokenId1, initialFormatId1] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [initialTokenId2, initialFormatId2] = await numberGoUp.getOwnedERC721Data(nonExempt2.address);
            console.log("Initial State:");
            console.log("Sender (nonExempt1) NFTs:", initialFormatId1.map(id => id.toString()));
            console.log("Receiver (nonExempt2) NFTs:", initialFormatId2.map(id => id.toString()));

            // Transfer
            const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, parseUnits("1"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            const [finalTokenId1, finalFormatId1] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [finalTokenId2, finalFormatId2] = await numberGoUp.getOwnedERC721Data(nonExempt2.address);
            console.log("\nFinal State:");
            console.log("Sender (nonExempt1) NFTs:", finalFormatId1.map(id => id.toString()));
            console.log("Receiver (nonExempt2) NFTs:", finalFormatId2.map(id => id.toString()));
            
            // Verify NFT transfer
            expect(finalTokenId1.length).to.equal(initialTokenId1.length - 1);
            expect(finalTokenId2.length).to.equal(initialTokenId2.length + 1);
        });

        it("Should transfer multiple tokens", async function () {


            console.log("\nMultiple Token Transfer (Non-Exempt → Non-Exempt): 5 ERC20s");
            // Initial state
            const [initialTokenId1, initialFormatId1] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [initialTokenId2, initialFormatId2] = await numberGoUp.getOwnedERC721Data(nonExempt2.address);
            console.log("Initial State:");
            console.log("Sender (nonExempt1) NFTs:", initialFormatId1.map(id => id.toString()));
            console.log("Receiver (nonExempt2) NFTs:", initialFormatId2.map(id => id.toString()));

            // Transfer
            const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, parseUnits("5"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            const [finalTokenId1, finalFormatId1] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            const [finalTokenId2, finalFormatId2] = await numberGoUp.getOwnedERC721Data(nonExempt2.address);
            console.log("\nFinal State:");
            console.log("Sender (nonExempt1) NFTs:", finalFormatId1.map(id => id.toString()));
            console.log("Receiver (nonExempt2) NFTs:", finalFormatId2.map(id => id.toString()));
            
            // Verify NFT transfer
            expect(finalTokenId1.length).to.equal(0);
            expect(finalTokenId2.length).to.equal(initialTokenId2.length + 5);
        });
    });

    describe("Exempt to Exempt Transfers", function () {
        it("Should transfer single token", async function () {


            console.log("\nSingle Token Transfer (Exempt → Exempt): 1 ERC20");
            // Initial state
            console.log("Initial State:");
            console.log("Sender (exempt1) balance:", formatUnits(await numberGoUp.balanceOf(exempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));

            // Transfer
            const tx = await numberGoUp.connect(exempt1).transfer(exempt2.address, parseUnits("1"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            console.log("\nFinal State:");
            console.log("Sender (exempt1) balance:", formatUnits(await numberGoUp.balanceOf(exempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));
            
            // Verify no NFTs were involved
            const [senderTokens, senderFormatIds] = await numberGoUp.getOwnedERC721Data(exempt1.address);
            const [receiverTokens, receiverFormatIds] = await numberGoUp.getOwnedERC721Data(exempt2.address);
            expect(senderTokens.length).to.equal(0);
            expect(receiverTokens.length).to.equal(0);
        });

        it("Should transfer multiple tokens", async function () {


            console.log("\nMultiple Token Transfer (Exempt → Exempt): 5 ERC20s");
            // Initial state
            console.log("Initial State:");
            console.log("Sender (exempt1) balance:", formatUnits(await numberGoUp.balanceOf(exempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));

            // Transfer
            const tx = await numberGoUp.connect(exempt1).transfer(exempt2.address, parseUnits("5"));
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Final state
            console.log("\nFinal State:");
            console.log("Sender (exempt1) balance:", formatUnits(await numberGoUp.balanceOf(exempt1.address)));
            console.log("Receiver (exempt2) balance:", formatUnits(await numberGoUp.balanceOf(exempt2.address)));
            
            // Verify no NFTs were involved
            const [senderTokens, senderFormatIds] = await numberGoUp.getOwnedERC721Data(exempt1.address);
            const [receiverTokens, receiverFormatIds] = await numberGoUp.getOwnedERC721Data(exempt2.address);
            expect(senderTokens.length).to.equal(0);
            expect(receiverTokens.length).to.equal(0);
        });
    });

    describe("Exemption Status Changes", function () {
        it("Should correctly mint ERC721s when exempt user loses exempt status", async function () {
            // Give exempt1 a significant balance
            await numberGoUp.connect(owner).transfer(exempt1.address, parseUnits("100"));
            
            // Verify initial state
            expect(await numberGoUp.erc721TransferExempt(exempt1.address)).to.be.true;
            expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(parseUnits("105"));
            expect(await numberGoUp.erc721BalanceOf(exempt1.address)).to.equal(0);

            // Remove exempt status
            await numberGoUp.connect(owner).setERC721TransferExempt(exempt1.address, false);

            // Verify ERC721s were minted correctly
            expect(await numberGoUp.erc721TransferExempt(exempt1.address)).to.be.false;
            expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(parseUnits("105"));
            expect(await numberGoUp.erc721BalanceOf(exempt1.address)).to.equal(105n);

            // Verify NFT ownership
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(exempt1.address);
            console.log("Minted NFTs after losing exempt status:", formatId.map(id => id.toString()));
            expect(fullTokenId.length).to.equal(105);
        });

        it("Should correctly burn ERC721s when non-exempt user gains exempt status", async function () {
            // Give nonExempt1 additional tokens
            await numberGoUp.connect(owner).transfer(nonExempt1.address, parseUnits("15"));
            
            // Verify initial state
            expect(await numberGoUp.erc721TransferExempt(nonExempt1.address)).to.be.false;
            const initialBalance = await numberGoUp.balanceOf(nonExempt1.address);
            const initialNFTBalance = await numberGoUp.erc721BalanceOf(nonExempt1.address);
            console.log("Initial NFT balance:", initialNFTBalance.toString());

            // Set to exempt
            await numberGoUp.connect(owner).setERC721TransferExempt(nonExempt1.address, true);

            // Verify ERC721s were burned correctly
            expect(await numberGoUp.erc721TransferExempt(nonExempt1.address)).to.be.true;
            expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(initialBalance);
            expect(await numberGoUp.erc721BalanceOf(nonExempt1.address)).to.equal(0);

            // Verify no NFTs remain
            const [fullTokenId, formatId] = await numberGoUp.getOwnedERC721Data(nonExempt1.address);
            expect(fullTokenId.length).to.equal(0);
        });
    });

    describe("Batch Minting and Pending NFT Claims", function () {
        it("Should handle large NFT mints in batches when removing exempt status", async function () {
            // Give exempt1 a large balance
            await numberGoUp.connect(owner).transfer(exempt1.address, parseUnits("2000"));
            
            // Verify initial state
            expect(await numberGoUp.erc721TransferExempt(exempt1.address)).to.be.true;
            expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(parseUnits("2005")); // Including initial 5
            expect(await numberGoUp.erc721BalanceOf(exempt1.address)).to.equal(0);
            expect(await numberGoUp.pendingNFTs(exempt1.address)).to.equal(0);

            // Remove exempt status - should trigger batch minting
            await numberGoUp.connect(owner).setERC721TransferExempt(exempt1.address, false);

            // Check state after initial batch mint
            const initialMinted = await numberGoUp.erc721BalanceOf(exempt1.address);
            const initialPending = await numberGoUp.pendingNFTs(exempt1.address);
            console.log("Initially minted NFTs:", initialMinted.toString());
            console.log("Initially pending NFTs:", initialPending.toString());
            expect(initialMinted + initialPending).to.equal(2005n);
            
            // Initial minting should be 1400 (2 batches of 700)
            expect(initialMinted).to.equal(700n);

            // Claim pending NFTs
            if (initialPending > 0) {
                await numberGoUp.connect(exempt1).mintPendingNFTs();
                
                // Verify final state after claiming
                const batchTwoMinted = await numberGoUp.erc721BalanceOf(exempt1.address);
                const batchTwoPending = await numberGoUp.pendingNFTs(exempt1.address);
                console.log("Final minted NFTs:", batchTwoMinted.toString());
                console.log("Final pending NFTs:", batchTwoPending.toString());
                

                // Total NFTs should match ERC20 balance after claiming
                expect(batchTwoMinted).to.equal(1400n);
                expect(batchTwoPending).to.equal(605n);

                if (batchTwoPending > 0) {
                    await numberGoUp.connect(exempt1).mintPendingNFTs();

                    const finalMinted = await numberGoUp.erc721BalanceOf(exempt1.address);
                    const finalPending = await numberGoUp.pendingNFTs(exempt1.address);
                    console.log("Final minted NFTs:", finalMinted.toString());
                    console.log("Final pending NFTs:", finalPending.toString());

                    expect(finalMinted).to.equal(2005n);
                    expect(finalPending).to.equal(0n);
                }

            }
        });

        it("Should handle pending NFTs correctly during transfers", async function () {
            // Give exempt1 a large balance
            await numberGoUp.connect(owner).transfer(exempt1.address, parseUnits("1500"));
            
            // Transfer large amount to non-exempt user
            await numberGoUp.connect(exempt1).transfer(nonExempt1.address, parseUnits("1000"));
            
            // Check initial minting state
            const initialMinted = await numberGoUp.erc721BalanceOf(nonExempt1.address);
            const initialPending = await numberGoUp.pendingNFTs(nonExempt1.address);
            console.log("\nAfter transfer:");
            console.log("Initially minted NFTs:", initialMinted.toString());
            console.log("Initially pending NFTs:", initialPending.toString());
            
            // Total of minted + pending should match ERC20 balance
            const balance = Number(formatUnits(await numberGoUp.balanceOf(nonExempt1.address)));
            expect(initialMinted + initialPending).to.equal(BigInt(Math.floor(balance)));

            // Claim pending NFTs if any exist
            if (initialPending > 0) {
                await numberGoUp.connect(nonExempt1).mintPendingNFTs();
                
                // Verify final state
                const finalMinted = await numberGoUp.erc721BalanceOf(nonExempt1.address);
                const finalPending = await numberGoUp.pendingNFTs(nonExempt1.address);
                console.log("\nAfter claiming:");
                console.log("Final minted NFTs:", finalMinted.toString());
                console.log("Final pending NFTs:", finalPending.toString());
                
                // All NFTs should be minted
                expect(finalMinted).to.equal(BigInt(Math.floor(balance)));
                expect(finalPending).to.equal(0);
            }
        });
    });
});
