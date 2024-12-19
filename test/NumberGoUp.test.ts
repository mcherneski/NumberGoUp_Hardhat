import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NumberGoUp - Initial State", function () {
    let numberGoUp: NumberGoUp;
    let owner: SignerWithAddress;
    let initialMintRecipient: SignerWithAddress;
    let addrs: SignerWithAddress[];

    const NAME = "Number Go Up";
    const SYMBOL = "NGU";
    const DECIMALS = 18n;
    const MAX_SUPPLY = 10_000n;
    const UNITS = 10n ** DECIMALS;
    const TOTAL_SUPPLY = MAX_SUPPLY * UNITS;

    beforeEach(async function () {
        [owner, initialMintRecipient, ...addrs] = await ethers.getSigners();

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
    });

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
            expect(await numberGoUp.units()).to.equal(UNITS);
        });
    });

    describe("Initial Supply and Balances", function () {
        it("Should have correct total supply", async function () {
            expect(await numberGoUp.totalSupply()).to.equal(TOTAL_SUPPLY);
        });

        it("Should allocate entire supply to initial recipient", async function () {
            expect(await numberGoUp.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
        });

        it("Should have zero balance for other accounts", async function () {
            expect(await numberGoUp.balanceOf(addrs[2].address)).to.equal(0);
        });
    });

    describe("Initial NFT State", function () {
        it("Should have correct initial NFT count for recipient", async function () {
            const address = owner.address;
            const ownedTokens = await numberGoUp.erc20BalanceOf(address);
            const ownedNFTs = await numberGoUp.erc721BalanceOf(address);
            expect(ownedTokens).to.equal(TOTAL_SUPPLY);
            expect(ownedNFTs).to.equal(0n);
        });

        it("Should have correct initial minted count", async function () {
            expect(await numberGoUp.minted()).to.equal(0);
        });
    });

    describe("Initial Permissions", function () {
        it("Should set initial recipient as ERC721 transfer exempt", async function () {
            expect(await numberGoUp.erc721TransferExempt(owner.address)).to.be.true;
        });

        it("Should set owner as exemption manager", async function () {
            const EXEMPTION_MANAGER_ROLE = await numberGoUp.EXEMPTION_MANAGER_ROLE();
            expect(await numberGoUp.hasRole(EXEMPTION_MANAGER_ROLE, owner.address)).to.be.true;
        });

        it("Should set owner as default admin", async function () {
            const DEFAULT_ADMIN_ROLE = await numberGoUp.DEFAULT_ADMIN_ROLE();
            expect(await numberGoUp.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Transfer Testing", function () {
        let exempt1: SignerWithAddress;      // owner
        let exempt2: SignerWithAddress;      // another exempt
        let nonExempt1: SignerWithAddress;   // regular user
        let nonExempt2: SignerWithAddress;   // another regular user

        const SINGLE_TOKEN = UNITS;          // 1 token
        const MULTIPLE_TOKENS = UNITS * 5n;  // 5 tokens

        beforeEach(async function () {
            exempt1 = owner;  // owner is already exempt
            [exempt2, nonExempt1, nonExempt2] = [addrs[3], addrs[4], addrs[5]];

            // Set up exempt2 as exempt
            await numberGoUp.connect(owner).setERC721TransferExempt(exempt2.address, true);

            // Transfer initial tokens to test accounts
            await numberGoUp.connect(owner).transfer(exempt2.address, MULTIPLE_TOKENS);
            await numberGoUp.connect(owner).transfer(nonExempt1.address, MULTIPLE_TOKENS);
            await numberGoUp.connect(owner).transfer(nonExempt2.address, MULTIPLE_TOKENS);
        });

        describe("1. Non-Exempt to Non-Exempt Transfers", function () {
            it("1.1 Should transfer single token and measure gas", async function () {
                console.log("\nTest 1.1: Single Token Transfer (Non-Exempt → Non-Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

                const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, SINGLE_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", SINGLE_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

                // Verify balance
                expect(await numberGoUp.balanceOf(nonExempt2.address))
                    .to.equal(MULTIPLE_TOKENS + SINGLE_TOKEN);
            });

            it("1.2 Should transfer multiple tokens and measure gas", async function () {
                console.log("\nTest 1.2: Multiple Token Transfer (Non-Exempt → Non-Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

                const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, MULTIPLE_TOKENS);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", MULTIPLE_TOKENS, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

                // Verify balance
                expect(await numberGoUp.balanceOf(nonExempt2.address))
                    .to.equal(MULTIPLE_TOKENS * 2n);
            });
        });

        describe("2. Exempt to Non-Exempt Transfers", function () {
            it("2.1 Should transfer single token and measure gas", async function () {
                console.log("\nTest 2.1: Single Token Transfer (Exempt → Non-Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(nonExempt1.address, SINGLE_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", SINGLE_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                expect(await numberGoUp.balanceOf(nonExempt1.address))
                    .to.equal(MULTIPLE_TOKENS + SINGLE_TOKEN);
            });

            it("2.2 Should transfer multiple tokens and measure gas", async function () {
                console.log("\nTest 2.2: Multiple Token Transfer (Exempt → Non-Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(nonExempt1.address, MULTIPLE_TOKENS);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", MULTIPLE_TOKENS, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                expect(await numberGoUp.balanceOf(nonExempt1.address))
                    .to.equal(MULTIPLE_TOKENS * 2n);
            });
        });

        describe("3. Exempt to Exempt Transfers", function () {
            it("3.1 Should transfer single token and measure gas", async function () {
                console.log("\nTest 3.1: Single Token Transfer (Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(exempt2.address, SINGLE_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));

                expect(await numberGoUp.balanceOf(exempt2.address))
                    .to.equal(MULTIPLE_TOKENS + SINGLE_TOKEN);
            });

            it("3.2 Should transfer multiple tokens and measure gas", async function () {
                console.log("\nTest 3.2: Multiple Token Transfer (Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(exempt2.address, MULTIPLE_TOKENS);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));

                expect(await numberGoUp.balanceOf(exempt2.address))
                    .to.equal(MULTIPLE_TOKENS * 2n);
            });
        });

        describe("4. Non-Exempt to Exempt Transfers", function () {
            it("4.1 Should transfer single token and measure gas", async function () {
                console.log("\nTest 4.1: Single Token Transfer (Non-Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                const initialBalance = await numberGoUp.balanceOf(exempt1.address);
                const tx = await numberGoUp.connect(nonExempt1).transfer(exempt1.address, SINGLE_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                expect(await numberGoUp.balanceOf(exempt1.address))
                    .to.equal(initialBalance + SINGLE_TOKEN);
            });

            it("4.2 Should transfer multiple tokens and measure gas", async function () {
                console.log("\nTest 4.2: Multiple Token Transfer (Non-Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                const initialBalance = await numberGoUp.balanceOf(exempt1.address);
                const tx = await numberGoUp.connect(nonExempt1).transfer(exempt1.address, MULTIPLE_TOKENS);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                expect(await numberGoUp.balanceOf(exempt1.address))
                    .to.equal(initialBalance + MULTIPLE_TOKENS);
            });
        });

        describe("5. Final State Check", function() {
            it("5.1 Should log final owned arrays for all users", async function() {
                console.log("\nTest 5.1: Final _owned arrays state:");
                
                // Log exempt users
                const exempt1Owned = await numberGoUp.getOwnedNFTs(exempt1.address);
                const exempt2Owned = await numberGoUp.getOwnedNFTs(exempt2.address);
                console.log("Exempt1 (owner) owned tokens:", exempt1Owned.map(n => Number(n)));
                console.log("Exempt2 owned tokens:", exempt2Owned.map(n => Number(n)));
                
                // Log non-exempt users
                const nonExempt1Owned = await numberGoUp.getOwnedNFTs(nonExempt1.address);
                const nonExempt2Owned = await numberGoUp.getOwnedNFTs(nonExempt2.address);
                console.log("NonExempt1 owned tokens:", nonExempt1Owned.map(n => Number(n)));
                console.log("NonExempt2 owned tokens:", nonExempt2Owned.map(n => Number(n)));
                
                // Log balances for comparison
                console.log("\nFinal balances:");
                console.log("Exempt1 (owner):", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)), "tokens");
                console.log("Exempt2:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)), "tokens");
                console.log("NonExempt1:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)), "tokens");
                console.log("NonExempt2:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)), "tokens");
            });
        });
    });

    describe("6. Fractional Transfer Testing", function () {
        let exempt1: SignerWithAddress;      // owner
        let exempt2: SignerWithAddress;      // another exempt
        let nonExempt1: SignerWithAddress;   // regular user
        let nonExempt2: SignerWithAddress;   // another regular user

        const HALF_TOKEN = UNITS / 2n;       // 0.5 tokens
        const QUARTER_TOKEN = UNITS / 4n;    // 0.25 tokens

        beforeEach(async function () {
            exempt1 = owner;  // owner is already exempt
            [exempt2, nonExempt1, nonExempt2] = [addrs[3], addrs[4], addrs[5]];

            // Set up exempt2 as exempt
            await numberGoUp.connect(owner).setERC721TransferExempt(exempt2.address, true);

            // Transfer initial tokens to test accounts
            await numberGoUp.connect(owner).transfer(exempt2.address, 2n * UNITS);      // 2 tokens
            await numberGoUp.connect(owner).transfer(nonExempt1.address, 2n * UNITS);   // 2 tokens
            await numberGoUp.connect(owner).transfer(nonExempt2.address, 2n * UNITS);   // 2 tokens
        });

        describe("6.1 Non-Exempt to Non-Exempt Fractional Transfers", function () {
            it("6.1.1 Should transfer half token and measure gas", async function () {
                console.log("\nTest 6.1.1: Half Token Transfer (Non-Exempt → Non-Exempt):");
                // Each starts with 2 tokens
                // Log initial state
                console.log("\nInitial State:");
                console.log('Half token amount:', HALF_TOKEN);
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));



                const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, HALF_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", HALF_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

                
                expect((await numberGoUp.getOwnedNFTs(nonExempt1.address)).length).to.equal(1);
                expect((await numberGoUp.getOwnedNFTs(nonExempt2.address)).length).to.equal(2);
                expect(await numberGoUp.balanceOf(nonExempt2.address)).to.equal((UNITS * 2n) + HALF_TOKEN);
                expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(UNITS + HALF_TOKEN);
            });
        });

        describe("6.2 Exempt to Non-Exempt Fractional Transfers", function () {
            it("6.2.1 Should transfer half token and measure gas", async function () {
                console.log("\nTest 6.2.1: Half Token Transfer (Exempt → Non-Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(nonExempt1.address, HALF_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", HALF_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));

                // Verify NFT ownership hasn't changed
                expect((await numberGoUp.getOwnedNFTs(nonExempt1.address)).length).to.equal(2);
            });
        });

        describe("6.3 Exempt to Exempt Fractional Transfers", function () {
            it("6.3.1 Should transfer half token and measure gas", async function () {
                console.log("\nTest 6.3.1: Half Token Transfer (Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));

                const tx = await numberGoUp.connect(exempt1).transfer(exempt2.address, HALF_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", HALF_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt2.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt2.address)));
            });
        });

        describe("6.4 Non-Exempt to Exempt Fractional Transfers", function () {
            it("6.4.1 Should transfer half token and measure gas", async function () {
                console.log("\nTest 6.4.1: Half Token Transfer (Non-Exempt → Exempt):");
                
                // Log initial state
                console.log("\nInitial State:");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                const initialBalance = await numberGoUp.balanceOf(exempt1.address);
                const tx = await numberGoUp.connect(nonExempt1).transfer(exempt1.address, HALF_TOKEN);
                const receipt = await tx.wait();
                console.log("\nGas used:", receipt?.gasUsed);

                // Log final state
                console.log("\nFinal State after transfering:", HALF_TOKEN, "tokens");
                console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
                console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(exempt1.address)).map(n => Number(n)));
                console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
                console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(exempt1.address)));

                // Verify NFT ownership hasn't changed
                expect((await numberGoUp.getOwnedNFTs(nonExempt1.address)).length).to.equal(1);
                expect((await numberGoUp.getOwnedNFTs(exempt1.address)).length).to.equal(0);
                expect(await numberGoUp.balanceOf(exempt1.address)).to.equal(initialBalance + HALF_TOKEN);
            });
        });
    });

    describe("7. Mixed Whole and Fractional Transfers (Non-Exempt to Non-Exempt)", function () {
        let exempt1: SignerWithAddress;      // owner
        let exempt2: SignerWithAddress;      // another exempt
        let nonExempt1: SignerWithAddress;   // regular user
        let nonExempt2: SignerWithAddress;   // another regular user
        beforeEach(async function () {
            // Reset test accounts
            exempt1 = owner;
            [exempt2, nonExempt1, nonExempt2] = [addrs[3], addrs[4], addrs[5]];

            // Set up exempt2 as exempt
            await numberGoUp.connect(owner).setERC721TransferExempt(exempt2.address, true);

            // Clear previous balances by transferring to owner
            const nonExempt1Balance = await numberGoUp.balanceOf(nonExempt1.address);
            const nonExempt2Balance = await numberGoUp.balanceOf(nonExempt2.address);
            if (nonExempt1Balance > 0) {
                await numberGoUp.connect(nonExempt1).transfer(owner.address, nonExempt1Balance);
            }
            if (nonExempt2Balance > 0) {
                await numberGoUp.connect(nonExempt2).transfer(owner.address, nonExempt2Balance);
            }

            // Give nonExempt1 10 fresh tokens to work with
            await numberGoUp.connect(owner).transfer(nonExempt1.address, UNITS * 10n);
        });

        it("7.1 Should transfer 2.5 tokens correctly", async function () {
            console.log("\nTest 7.1: 2.5 Token Transfer (Non-Exempt → Non-Exempt):");
            
            // Log initial state
            console.log("\nInitial State:");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

            const amount = ethers.parseEther('2.5');
            const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, amount);
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Log final state
            console.log("\nFinal State after transfering:", amount, "tokens");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));
            console.log('Receiver Balance: ', await numberGoUp.balanceOf(nonExempt1.address));
            // Verify balances
            expect(await numberGoUp.balanceOf(nonExempt2.address)).to.equal(amount);
            expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(UNITS * 75n / 10n); // 7.5 tokens left

            // Verify NFT counts (should transfer 2 NFTs)
            const senderNFTs = await numberGoUp.getOwnedNFTs(nonExempt1.address);
            const receiverNFTs = await numberGoUp.getOwnedNFTs(nonExempt2.address);
            expect(senderNFTs.length).to.equal(7); // 10 - 2.5 = 7.5. Floor 7.5 = 7 NFTs
            expect(receiverNFTs.length).to.equal(2); // Received 2.5. Floor 2.5 = 2 NFTs
        });

        it("7.2 Should transfer 1.3 tokens correctly", async function () {
            console.log("\nTest 7.2: 1.3 Token Transfer (Non-Exempt → Non-Exempt):");
            
            // Log initial state
            console.log("\nInitial State:");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

            const amount = ethers.parseEther('1.3');
            const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, amount);
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);

            // Log final state
            console.log("\nFinal State after transfering:", amount, "tokens");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

            // Verify balances
            expect(await numberGoUp.balanceOf(nonExempt2.address)).to.equal(amount);
            expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(ethers.parseEther('8.7')); // 8.7 tokens left

            // Verify NFT counts (should transfer 1 NFT since number is 1.3)
            const senderNFTs = await numberGoUp.getOwnedNFTs(nonExempt1.address);
            const receiverNFTs = await numberGoUp.getOwnedNFTs(nonExempt2.address);
            expect(senderNFTs.length).to.equal(8); // 10 - 1.3 = 8.7. Floor 8.7 = 8 NFTs
            expect(receiverNFTs.length).to.equal(1); // Received 1.3. Floor 1.3 = 1 NFT
        });

        it("7.3 Should transfer 8.6 tokens correctly", async function () {
            console.log("\nTest 7.3: 8.6 Token Transfer (Non-Exempt → Non-Exempt):");
            
            // Log initial state
            console.log("\nInitial State:");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

            const amount = ethers.parseEther('8.6');
            const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, amount);
            const receipt = await tx.wait();
            console.log("\nGas used:", receipt?.gasUsed);
            // nonExempt1 should have 1.4 tokens left

            // Log final state
            console.log("\nFinal State after transfering:", amount, "tokens");
            console.log("Sender owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt1.address)).map(n => Number(n)));
            console.log("Receiver owned tokens:", (await numberGoUp.getOwnedNFTs(nonExempt2.address)).map(n => Number(n)));
            console.log("Sender balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt1.address)));
            console.log("Receiver balance:", ethers.formatEther(await numberGoUp.balanceOf(nonExempt2.address)));

            // Verify balances
            expect(await numberGoUp.balanceOf(nonExempt2.address)).to.equal(amount);
            expect(await numberGoUp.balanceOf(nonExempt1.address)).to.equal(ethers.parseEther('1.4')); // 1.4 tokens left

            // Verify NFT counts (should transfer 8 NFTs)
            const senderNFTs = await numberGoUp.getOwnedNFTs(nonExempt1.address);
            const receiverNFTs = await numberGoUp.getOwnedNFTs(nonExempt2.address);
            expect(senderNFTs.length).to.equal(1); // 10 - 8.6 = 1.4. Floor 1.4 = 1 NFTs
            expect(receiverNFTs.length).to.equal(8); // Received 8.6. Floor 8.6 = 8 NFTs
        });
    });
});
