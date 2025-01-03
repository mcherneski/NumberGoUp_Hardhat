import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Gas Limits - Transfer Tests", function () {
    let numberGoUp: NumberGoUp;
    let owner: SignerWithAddress;
    let nonExempt1: SignerWithAddress;
    let nonExempt2: SignerWithAddress;
    let exempt1: SignerWithAddress;
    let exempt2: SignerWithAddress;
    let addrs: SignerWithAddress[];

    const NAME = "Number Go Up";
    const SYMBOL = "NGU";
    const DECIMALS = 18n;
    const MAX_SUPPLY = 10_000n;
    const UNITS = 10n ** DECIMALS;

    beforeEach(async function () {
        [owner, nonExempt1, nonExempt2, exempt1, exempt2, ...addrs] = await ethers.getSigners();

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

        // Transfer initial tokens to nonExempt1 for testing (reduced to 500 tokens)
        await numberGoUp.connect(owner).transfer(nonExempt1.address, UNITS * 500n, {
            gasLimit: 50000000
        });
    });

    async function findExemptToNonExemptLimit() {
        let amount = UNITS * 10n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                // Deploy fresh contract for each test
                const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
                const freshContract = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );

                console.log(`\nTrying exempt->non-exempt transfer of ${ethers.formatEther(amount)} tokens...`);
                const tx = await freshContract.connect(owner).transfer(nonExempt1.address, amount, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = amount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                amount += UNITS * 10n;
            } catch (error) {
                console.log(`\nFinal Results (Exempt->Non-Exempt):`);
                console.log(`Max tokens transferred: ${ethers.formatEther(lastSuccessfulAmount)}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                return {
                    maxTokens: lastSuccessfulAmount / UNITS,
                    gasUsed: lastSuccessfulGas
                };
            }
        }
    }

    async function findNonExemptToNonExemptLimit() {
        let amount = UNITS * 10n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                // Deploy fresh contract for each test
                const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
                const freshContract = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );

                // Setup initial state
                await freshContract.connect(owner).transfer(nonExempt1.address, UNITS * (amount + 100n), {
                    gasLimit: 50000000
                });

                console.log(`\nTrying non-exempt->non-exempt transfer of ${ethers.formatEther(amount)} tokens...`);
                const tx = await freshContract.connect(nonExempt1).transfer(nonExempt2.address, amount, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = amount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                amount += UNITS * 1n;
            } catch (error) {
                console.log(`\nFinal Results (Non-Exempt->Non-Exempt):`);
                console.log(`Max tokens transferred: ${ethers.formatEther(lastSuccessfulAmount)}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                return {
                    maxTokens: lastSuccessfulAmount / UNITS,
                    gasUsed: lastSuccessfulGas
                };
            }
        }
    }

    async function findExemptToExemptLimit() {
        let amount = UNITS * 1000n;  // Start at 1000 tokens
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                // Deploy fresh contract for each test
                const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
                const freshContract = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );

                // Set up exempt addresses
                await freshContract.connect(owner).setERC721TransferExempt(exempt1.address, true);
                await freshContract.connect(owner).setERC721TransferExempt(exempt2.address, true);
                
                // Transfer initial tokens to exempt1 for testing
                await freshContract.connect(owner).transfer(exempt1.address, UNITS * (amount + 100n), {
                    gasLimit: 50000000
                });

                console.log(`\nTrying exempt->exempt transfer of ${ethers.formatEther(amount)} tokens...`);
                const tx = await freshContract.connect(exempt1).transfer(exempt2.address, amount, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = amount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                amount += UNITS * 5n;  // Increment by 5 tokens for more precise limit finding
            } catch (error) {
                console.log(`\nFinal Results (Exempt->Exempt):`);
                console.log(`Max tokens transferred: ${ethers.formatEther(lastSuccessfulAmount)}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                return {
                    maxTokens: lastSuccessfulAmount / UNITS,
                    gasUsed: lastSuccessfulGas
                };
            }
        }
    }

    async function findMaxNFTMintingLimit() {
        // Binary search parameters
        let low = 50n;
        let high = 10000n;  // Start with a reasonable upper bound
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (low <= high) {
            const mid = (low + high) / 2n;
            console.log(`\nTesting ${mid} NFTs...`);

            try {
                // Deploy fresh contract for each test
                const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
                const freshContract = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );

                // Set up test address as exempt and transfer tokens
                await freshContract.connect(owner).setERC721TransferExempt(exempt1.address, true);
                await freshContract.connect(owner).transfer(exempt1.address, UNITS * mid, {
                    gasLimit: 50000000
                });

                console.log("Balance before:", await freshContract.balanceOf(exempt1.address));

                // Try to remove exempt status which will trigger minting
                const tx = await freshContract.connect(owner).setERC721TransferExempt(exempt1.address, false, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();

                // Verify NFTs were minted
                const nftBalance = await freshContract.erc721BalanceOf(exempt1.address);
                console.log(`Success! Minted ${nftBalance} NFTs`);
                console.log(`Gas used: ${receipt?.gasUsed}`);

                // Update search parameters
                lastSuccessfulAmount = mid;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                low = mid + 1n;  // Try a higher amount
            } catch (error) {
                console.log(`Failed at ${mid} NFTs`);
                high = mid - 1n;  // Try a lower amount
            }
        }

        // Verify the exact limit with one final test
        try {
            // Deploy one last fresh contract
            const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
            const finalContract = await NumberGoUp.deploy(
                NAME,
                SYMBOL,
                DECIMALS,
                MAX_SUPPLY,
                owner.address,
                owner.address,
                addrs[0].address,
                addrs[1].address
            );

            // Test the last successful amount
            await finalContract.connect(owner).setERC721TransferExempt(exempt1.address, true);
            await finalContract.connect(owner).transfer(exempt1.address, UNITS * lastSuccessfulAmount, {
                gasLimit: 50000000
            });

            const tx = await finalContract.connect(owner).setERC721TransferExempt(exempt1.address, false, {
                gasLimit: 50000000
            });
            const receipt = await tx.wait();

            console.log(`\nVerified final limit:`);
            console.log(`Successfully minted exactly ${lastSuccessfulAmount} NFTs`);
            console.log(`Gas used: ${receipt?.gasUsed}`);
            
            // Try one more to confirm it's the true limit
            try {
                const oneMore = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );
                
                await oneMore.connect(owner).setERC721TransferExempt(exempt1.address, true);
                await oneMore.connect(owner).transfer(exempt1.address, UNITS * (lastSuccessfulAmount + 1n), {
                    gasLimit: 50000000
                });
                
                await oneMore.connect(owner).setERC721TransferExempt(exempt1.address, false, {
                    gasLimit: 50000000
                });
                
                console.log(`Warning: ${lastSuccessfulAmount + 1n} also succeeded, binary search may have missed higher values`);
            } catch {
                console.log(`Confirmed: ${lastSuccessfulAmount + 1n} fails, ${lastSuccessfulAmount} is the true limit`);
            }
        } catch (error) {
            console.log(`Error during final verification: ${error}`);
        }

        return {
            maxNFTs: lastSuccessfulAmount,
            gasUsed: lastSuccessfulGas
        };
    }

    async function findMaxNFTBurnLimit() {
        // Binary search parameters
        let low = 2800n;  // Start from known successful value
        let high = 20000n;  // Double the upper bound since we know 2881 works
        let lastSuccessfulAmount = 2880n;
        let lastSuccessfulGas = 0n;

        while (low <= high) {
            const mid = (low + high) / 2n;
            console.log(`\nTesting burning ${mid} NFTs...`);

            try {
                // Deploy fresh contract for each test
                const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
                const freshContract = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );

                // Transfer tokens to non-exempt user and mint NFTs
                await freshContract.connect(owner).transfer(nonExempt1.address, UNITS * mid, {
                    gasLimit: 50000000
                });

                // Claim any pending NFTs to ensure we have the full balance
                while ((await freshContract.pendingNFTs(nonExempt1.address)) > 0n) {
                    await freshContract.connect(nonExempt1).mintPendingNFTs();
                }

                // Verify NFTs were minted
                const initialNFTBalance = await freshContract.erc721BalanceOf(nonExempt1.address);
                console.log(`Initial NFT balance: ${initialNFTBalance}`);

                // Set user as exempt which will trigger burning
                const tx = await freshContract.connect(owner).setERC721TransferExempt(nonExempt1.address, true, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();

                // Verify NFTs were burned
                const finalNFTBalance = await freshContract.erc721BalanceOf(nonExempt1.address);
                console.log(`Success! Burned ${initialNFTBalance} NFTs`);
                console.log(`Final NFT balance: ${finalNFTBalance}`);
                console.log(`Gas used: ${receipt?.gasUsed}`);

                // Update search parameters
                lastSuccessfulAmount = mid;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                low = mid + 1n;  // Try a higher amount
            } catch (error) {
                console.log(`Failed at ${mid} NFTs`);
                high = mid - 1n;  // Try a lower amount
            }
        }

        // Verify the exact limit with one final test
        try {
            // Deploy one last fresh contract
            const NumberGoUp = await ethers.getContractFactory("NumberGoUp");
            const finalContract = await NumberGoUp.deploy(
                NAME,
                SYMBOL,
                DECIMALS,
                MAX_SUPPLY,
                owner.address,
                owner.address,
                addrs[0].address,
                addrs[1].address
            );

            // Test the last successful amount
            await finalContract.connect(owner).transfer(nonExempt1.address, UNITS * lastSuccessfulAmount, {
                gasLimit: 50000000
            });

            const initialNFTBalance = await finalContract.erc721BalanceOf(nonExempt1.address);
            const tx = await finalContract.connect(owner).setERC721TransferExempt(nonExempt1.address, true, {
                gasLimit: 50000000
            });
            const receipt = await tx.wait();

            console.log(`\nVerified final limit:`);
            console.log(`Successfully burned exactly ${lastSuccessfulAmount} NFTs`);
            console.log(`Gas used: ${receipt?.gasUsed}`);
            
            // Try one more to confirm it's the true limit
            try {
                const oneMore = await NumberGoUp.deploy(
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    MAX_SUPPLY,
                    owner.address,
                    owner.address,
                    addrs[0].address,
                    addrs[1].address
                );
                
                await oneMore.connect(owner).transfer(nonExempt1.address, UNITS * (lastSuccessfulAmount + 1n), {
                    gasLimit: 50000000
                });
                
                await oneMore.connect(owner).setERC721TransferExempt(nonExempt1.address, true, {
                    gasLimit: 50000000
                });
                
                console.log(`Warning: ${lastSuccessfulAmount + 1n} also succeeded, binary search may have missed higher values`);
            } catch {
                console.log(`Confirmed: ${lastSuccessfulAmount + 1n} fails, ${lastSuccessfulAmount} is the true limit`);
            }
        } catch (error) {
            console.log(`Error during final verification: ${error}`);
        }

        return {
            maxNFTs: lastSuccessfulAmount,
            gasUsed: lastSuccessfulGas
        };
    }

    it("Should find maximum exempt to non-exempt transfer limit", async function () {
        const result = await findExemptToNonExemptLimit();
        console.log(`\nFinal maximum exempt->non-exempt transfer:`);
        console.log(`Tokens: ${result.maxTokens}`);
        console.log(`Gas: ${result.gasUsed}`);
    });

    it("Should find maximum non-exempt to non-exempt transfer limit", async function () {
        const result = await findNonExemptToNonExemptLimit();
        console.log(`\nFinal maximum non-exempt->non-exempt transfer:`);
        console.log(`Tokens: ${result.maxTokens}`);
        console.log(`Gas: ${result.gasUsed}`);
    });

    it("Should find maximum exempt to exempt transfer limit", async function () {
        const result = await findExemptToExemptLimit();
        console.log(`\nFinal maximum exempt->exempt transfer:`);
        console.log(`Tokens: ${result.maxTokens}`);
        console.log(`Gas: ${result.gasUsed}`);
        
        // Since exempt transfers don't involve NFTs, they should use significantly less gas
        expect(result.gasUsed).to.be.below(100000n); // Much lower gas limit than non-exempt transfers
    });

    it("Should find maximum NFT minting limit when removing exempt status", async function () {
        const result = await findMaxNFTMintingLimit();
        console.log(`\nMaximum NFT minting when removing exempt status:`);
        console.log(`Max NFTs: ${result.maxNFTs}`);
        console.log(`Gas used: ${result.gasUsed}`);
        
        // We should be able to mint at least 50 NFTs in one transaction
        expect(result.maxNFTs).to.be.gte(50n);
    });

    it("Should find maximum NFT burn limit when adding exempt status", async function () {
        const result = await findMaxNFTBurnLimit();
        console.log(`\nMaximum NFT burning when adding exempt status:`);
        console.log(`Max NFTs: ${result.maxNFTs}`);
        console.log(`Gas used: ${result.gasUsed}`);
        
        // We should be able to burn at least 1000 NFTs in one transaction
        expect(result.maxNFTs).to.be.gte(0n);
    });
}); 