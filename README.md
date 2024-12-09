# NGU505 Staking Contract

## Overview
This contract is designed to handle staking of ERC721 tokens. It allows users to stake their NFTs and receive ERC20 tokens in return. The staked NFTs are locked and cannot be transferred, but the ERC20 tokens can be used normally.

## NFT Details 
Overview: The NFTs are stored in a series-based format. The series is represented by a hex prefix (0-F). The series increments with each new mint past uint256.max(), the ID increments with each new mint. The NFT ID is a combination of the series prefix and a token ID.

The total number of available NFTs is (15 * 2^256), which should be enough for a long time.

### NFT ID Helpers
Add helper functions for working with the hex series-based NFT IDs:
- `formatNFTID(uint256 id) returns (string)`: Convert NFT ID to format like "0x1..." for series 1
- `getSeriesPrefix(uint256 id) returns (uint8)`: Extract just the hex prefix (0-F)
- `isSeriesComplete(uint8 series) returns (bool)`: Check if a series is full
- `getCurrentSeries() returns (uint8)`: Get current minting series
- `getNextSeries() returns (uint8)`: Preview next series (e.g., 9->A)
- Consider adding events for series changes
- Add documentation explaining the hex series system

Purpose: Make it easier to:
- Display NFT IDs in a human-readable format
- Track and monitor series progression
- Help users understand which series their NFTs belong to
- Provide clear UI/UX for series-based NFT system

### NFT Transfer Design
- NFTs cannot be directly transferred between addresses
- NFTs only move in two ways:
  1. Through ERC20 transfers (using selling queue)
  2. Through staking/unstaking operations
- No safeTransferFrom needed since we don't support direct NFT transfers
- NFTs are always tied to ERC20 balance (1 NFT per whole token)
- Selling queue ensures FIFO order for NFT transfers
- This design:
  - Simplifies token management
  - Reduces attack vectors
  - Ensures NFTs always match ERC20 balances
  - Makes token behavior more predictable

## Staking Design
The staking design is based on the ERC404 contract, but with some modifications to handle ERC721 tokens instead of ERC404's ERC20 tokens. The staking and unstaking processes are handled in the `NGU505Staking` contract, while the `INGU505Staking` interface is used to interact with it.

### Staking Details
The staking system is designed to work seamlessly with the base contract's queue mechanism:

1. Queue-Based Security:
   - NFTs can only be transferred if they're in the selling queue
   - Staked NFTs are removed from queue, making them untransferable
   - No need for additional transfer checks in staking contract

2. Balance Management:
   - Regular balance tracked in base contract's balanceOf
   - Staked balance tracked in stakedERC20TokenBank
   - Base contract's balance checks prevent transferring staked tokens
   - Total balance available through erc20TotalBalanceOf

3. NFT Movement:
   - Staking: NFT moves from queue to _staked mapping
   - Unstaking: NFT moves from _staked back to queue
   - Transfers only possible with NFTs in queue

4. Design Benefits:
   - Physical separation of staked/unstaked NFTs
   - Relies on existing queue security
   - Clean separation of concerns
   - No redundant checks needed

## Batch Operation Limits
The contract has been tested and optimized for batch operations, with the following maximum limits:

1. Transfer Limits:
   - Exempt to non-exempt: 323 tokens
   - Non-exempt to non-exempt: 76 tokens
   - Non-exempt to exempt: 250 tokens
   - These limits are due to gas constraints and queue operations

2. Staking Limits:
   - Maximum batch stake: 46 tokens
   - Maximum batch unstake: 46 tokens (same as staking)
   - Limits are based on gas usage for queue management

3. Gas Considerations:
   - Limits are based on a block gas limit of 30M gas
   - Actual limits may vary slightly based on network conditions
   - Operations near the limits should include sufficient gas margin

4. Best Practices:
   - Keep batch sizes well below limits for safety
   - Consider breaking large operations into multiple smaller batches
   - Monitor gas usage when approaching limits
   - Include appropriate gas limits in client applications