# NGU505 Staking Contract

## Contract ABIs
- [NGU505Base ABI](./artifacts/contracts/NGU505Base.sol/NGU505Base.json)
- [NGUStaking ABI](./artifacts/contracts/NGUStaking.sol/NGUStaking.json)
- [NumberGoUp ABI](./artifacts/contracts/NumberGoUp.sol/NumberGoUp.json)

## Overview
This contract is designed to handle staking of ERC721 tokens. It allows users to stake their NFTs and receive ERC20 tokens in return. The staked NFTs are locked and cannot be transferred, but the ERC20 tokens can be used normally.

## Frontend Developer Guide

### Key Contract Functions

#### NumberGoUp Contract
```solidity
// Read functions
balanceOf(address account) returns (uint256)           // Get ERC20 balance
ownerOf(uint256 tokenId) returns (address)            // Get NFT owner
owneds(address account) returns (uint256[])     // Get all NFTs owned by an address
erc721TransferExempt(address account) returns (bool)  // Check if address is transfer exempt
units() returns (uint256)                             // Get the base unit value (1e18)
decimals() returns (uint8)                            // Get token decimals (18)
name() returns (string)                               // Get token name
symbol() returns (string)                             // Get token symbol

// Write functions
transfer(address to, uint256 amount)                  // Transfer tokens
approve(address spender, uint256 amount)              // Approve spender (for ERC20 transfers)
setERC721TransferExempt(address account, bool exempt) // Set transfer exempt status (admin only)
```

#### NGUStaking Contract
```solidity
// Read functions
stakedERC20TokenBank(address account) returns (uint256) // Get staked balance
erc20TotalBalanceOf(address account) returns (uint256)  // Get total balance (staked + unstaked)
formatNFTId(uint256 tokenId) returns (string)          // Get human-readable NFT ID
owneds(address account) returns (uint256[])      // Get all NFTs owned by an address

// Write functions
stake(uint256[] calldata tokenIds)                     // Stake multiple NFTs
unstake(uint256[] calldata tokenIds)                   // Unstake multiple NFTs
```

### Gas Usage Guidelines
1. **Transfer Operations**
   - Non-exempt → Exempt: ~40K gas per transfer
   - Non-exempt → Non-exempt: ~40-50K gas per transfer
   - Recommend staying under 80% of limits for safety

2. **Staking Operations**
   - Maximum batch size: 1000 tokens per transaction
   - Stake: ~40-50K gas per operation
   - Unstake: ~40-50K gas per operation

### Common Integration Patterns

1. **Display NFT IDs**
```javascript
// Get human-readable NFT ID
const formattedId = await stakingContract.formatNFTId(tokenId);
// Returns format like "1#1" for series 1, token 1
```

2. **Check Balances**
```javascript
// Get total balance (staked + unstaked)
const totalBalance = await stakingContract.erc20TotalBalanceOf(userAddress);
// Get staked balance
const stakedBalance = await stakingContract.stakedERC20TokenBank(userAddress);
// Get unstaked balance
const unstakedBalance = await ngu505Contract.balanceOf(userAddress);
```

3. **Batch Operations**
```javascript
// Batch stake (recommended max 200 tokens per tx)
const tokenIds = [1, 2, 3, ...];  // Up to 200 tokens
await stakingContract.stake(tokenIds);

// Batch unstake (recommended max 200 tokens per tx)
await stakingContract.unstake(tokenIds);
```

### Error Handling
Common errors to handle:
- `NotFound`: Token ID doesn't exist
- `QueueEmpty`: Attempt to dequeue from empty queue
- `QueueFull`: Queue is at maximum capacity
- `AccessControlError`: User not authorized for admin operation
- `InsufficientBalance`: Not enough tokens for operation
- `InvalidTokenId`: Token ID is not valid
- `TransferFailed`: Token transfer failed

## Contract Limitations

1. **Technical Limitations**
   - Block gas limit: 50M gas
   - Gas per transfer: ~40-50K
   - Maximum batch sizes:
     - Transfers: Up to 1000 tokens per tx (based on gas limit)
     - Staking: Up to 1000 tokens per tx
     - Unstaking: Up to 1000 tokens per tx
     - Recommended batch size: 100-200 tokens for optimal gas usage

2. **NFT Series Limitations**
   - 15 series available (1-9, A-F)
   - Each series: 10 billion NFTs
   - Total capacity: 150 billion NFTs

3. **Transfer Restrictions**
   - NFTs cannot be directly transferred
   - All transfers must use the queue system
   - Staked NFTs are locked until unstaked

4. **Staking Constraints**
   - 1:1 ratio of NFTs to whole tokens
   - No partial token staking
   - FIFO queue for NFT transfers

## Security Considerations

1. **Gas Optimization**
   - Keep batch sizes well below limits
   - Include sufficient gas margin
   - Monitor network conditions

2. **Queue Management**
   - Queue operations are FIFO
   - Cannot skip queue positions
   - Queue state affects transfer availability

3. **Balance Tracking**
   - Always verify total balance
   - Check both staked and unstaked amounts
   - Monitor NFT ownership changes

## NFT Details 
Overview: The NFTs are stored in a series-based format. The series is represented by a hex prefix (0-F). The series increments with each new mint past uint256.max(), the ID increments with each new mint. The NFT ID is a combination of the series prefix and a token ID.

The total number of available NFTs is (15 * 2^256), which should be enough for a long time.

### NFT ID Format
- Format: `{series}#{id}`
- Example: `1#1234` (Series 1, ID 1234)
- Series range: 1-9, A-F
- ID range: 1 to 10 billion per series

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