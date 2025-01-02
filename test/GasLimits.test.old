import { expect } from "chai";
import { ethers } from "hardhat";
import { NumberGoUp } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Gas Limits - Transfer Tests", function () {
    let numberGoUp: NumberGoUp;
    let owner: SignerWithAddress;
    let nonExempt1: SignerWithAddress;
    let nonExempt2: SignerWithAddress;
    let addrs: SignerWithAddress[];

    const NAME = "Number Go Up";
    const SYMBOL = "NGU";
    const DECIMALS = 18n;
    const MAX_SUPPLY = 10_000n;
    const UNITS = 10n ** DECIMALS;

    beforeEach(async function () {
        [owner, nonExempt1, nonExempt2, ...addrs] = await ethers.getSigners();

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
                console.log(`\nTrying exempt->non-exempt transfer of ${ethers.formatEther(amount)} tokens...`);
                const tx = await numberGoUp.connect(owner).transfer(nonExempt1.address, amount, {
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
                console.log(`\nTrying non-exempt->non-exempt transfer of ${ethers.formatEther(amount)} tokens...`);
                const tx = await numberGoUp.connect(nonExempt1).transfer(nonExempt2.address, amount, {
                    gasLimit: 50000000
                });
                const receipt = await tx.wait();
                lastSuccessfulAmount = amount;
                lastSuccessfulGas = receipt?.gasUsed || 0n;
                console.log(`Success! Gas used: ${lastSuccessfulGas}`);
                amount += UNITS * 10n;
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
}); 