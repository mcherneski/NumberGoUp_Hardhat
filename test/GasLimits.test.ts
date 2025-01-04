import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Gas Limits Analysis", function() {
    let ngu: NumberGoUp;
    let owner: SignerWithAddress;
    let exempt1: SignerWithAddress;
    let exempt2: SignerWithAddress;
    let nonExempt1: SignerWithAddress;
    let nonExempt2: SignerWithAddress;
    const UNITS = ethers.parseEther("1");

    async function deployFreshContract() {
        const NGU = await ethers.getContractFactory("NumberGoUp");
        const contract = await NGU.deploy(
            "NumberGoUp",
            "NGU",
            18,
            10000n,
            owner.address,
            owner.address,
            owner.address,
            owner.address
        );
        await contract.setERC721TransferExempt(exempt1.address, true);
        await contract.setERC721TransferExempt(exempt2.address, true);
        return contract;
    }

    beforeEach(async function() {
        [owner, exempt1, exempt2, nonExempt1, nonExempt2] = await ethers.getSigners();
        ngu = await deployFreshContract();
    });

    it("Should find maximum NFTs that can be minted in one transaction", async function() {
        console.log("\n=== Testing Maximum NFT Minting (Exempt to Non-Exempt Transfer) ===");
        let nftCount = 100n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                const freshContract = await deployFreshContract();
                const amount = UNITS * nftCount;
                
                // First give tokens to exempt1
                await freshContract.transfer(exempt1.address, amount);
                
                console.log(`\nTrying to mint ${nftCount} NFTs...`);
                const tx = await freshContract.connect(exempt1).transfer(nonExempt1.address, amount, {
                    gasLimit: 30000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = nftCount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                
                nftCount += 50n;
            } catch (error) {
                console.log(`\nMinting Limit Results:`);
                console.log(`Maximum NFTs minted in one tx: ${lastSuccessfulAmount}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                console.log(`Gas per NFT: ${Number(lastSuccessfulGas) / Number(lastSuccessfulAmount)}`);
                break;
            }
        }
    });

    it("Should find maximum NFTs that can be burned in one transaction", async function() {
        console.log("\n=== Testing Maximum NFT Burning (Non-Exempt to Exempt Transfer) ===");
        let nftCount = 100n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                const freshContract = await deployFreshContract();
                const amount = UNITS * nftCount;
                
                // Give non-exempt user tokens/NFTs
                await freshContract.transfer(nonExempt1.address, amount);

                console.log(`\nTrying to burn ${nftCount} NFTs...`);
                const tx = await freshContract.connect(nonExempt1).transfer(exempt1.address, amount, {
                    gasLimit: 30000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = nftCount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                
                nftCount += 50n;
            } catch (error) {
                console.log(`\nBurning Limit Results:`);
                console.log(`Maximum NFTs burned in one tx: ${lastSuccessfulAmount}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                console.log(`Gas per NFT: ${Number(lastSuccessfulGas) / Number(lastSuccessfulAmount)}`);
                break;
            }
        }
    });

    it("Should find maximum NFTs that can be transferred between non-exempt addresses", async function() {
        console.log("\n=== Testing Maximum NFT Transfer Between Non-Exempt Addresses ===");
        let nftCount = 100n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                const freshContract = await deployFreshContract();
                const amount = UNITS * nftCount;
                
                // Give first non-exempt user tokens/NFTs
                await freshContract.transfer(nonExempt1.address, amount);

                console.log(`\nTrying to transfer ${nftCount} NFTs between non-exempt addresses...`);
                const tx = await freshContract.connect(nonExempt1).transfer(nonExempt2.address, amount, {
                    gasLimit: 30000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = nftCount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                
                nftCount += 50n;
            } catch (error) {
                console.log(`\nNon-Exempt to Non-Exempt Transfer Limit Results:`);
                console.log(`Maximum NFTs transferred in one tx: ${lastSuccessfulAmount}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                console.log(`Gas per NFT: ${Number(lastSuccessfulGas) / Number(lastSuccessfulAmount)}`);
                break;
            }
        }
    });

    it("Should find maximum tokens that can be transferred between exempt addresses", async function() {
        console.log("\n=== Testing Maximum Transfer Between Exempt Addresses ===");
        let tokenCount = 1000n;
        let lastSuccessfulAmount = 0n;
        let lastSuccessfulGas = 0n;

        while (true) {
            try {
                const freshContract = await deployFreshContract();
                const amount = UNITS * tokenCount;
                
                // Give first exempt user tokens
                await freshContract.transfer(exempt1.address, amount);

                console.log(`\nTrying to transfer ${tokenCount} tokens between exempt addresses...`);
                const tx = await freshContract.connect(exempt1).transfer(exempt2.address, amount, {
                    gasLimit: 30000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = tokenCount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                
                tokenCount += 1000n;
            } catch (error) {
                console.log(`\nExempt to Exempt Transfer Limit Results:`);
                console.log(`Maximum tokens transferred in one tx: ${lastSuccessfulAmount}`);
                console.log(`Gas used: ${lastSuccessfulGas}`);
                console.log(`Gas per token: ${Number(lastSuccessfulGas) / Number(lastSuccessfulAmount)}`);
                break;
            }
        }
    });
}); 