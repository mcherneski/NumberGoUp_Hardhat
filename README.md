# NumberGoUp Token & Staking Contract

## Overview
The NumberGoUp (NGU) token is a hybrid ERC20/ERC721 token (ERC404) that automatically converts between fungible tokens and NFTs based on the holder's status. The contract includes a staking mechanism that allows users to stake their NFTs while maintaining their ERC20 balance.

## Contract Architecture

### Core Components
1. **NGU505Base**: Base contract implementing hybrid ERC20/ERC721 functionality
2. **NumberGoUp**: Main token contract extending NGU505Base with ERC404 and Uniswap V3 integration
3. **NGUStaking**: Staking contract for NFT management
4. **ERC404UniswapV3Exempt**: Extension for Uniswap V3 compatibility

### Key Features
- Automatic NFT minting/burning based on transfers
- Transfer exemption system for designated addresses
- Series-based NFT ID system (1-15, using 4 bits)
- Queue-based NFT management
- Integrated staking mechanism
- Uniswap V3 integration
- 5 rarity tiers with deterministic distribution

## NFT System

### NFT ID Format
- Format: Series (4 bits) + Token ID (252 bits)
- Series range: 1-15 (using 4 bits)
- Token ID range: 1 to 10 billion per series
- Example: `0x1000000000000001` = Series 1, Token 1

### Rarity Tiers
The contract implements 5 rarity variants with the following distribution:
1. Rarity 1: 3% (Ultra Rare)
2. Rarity 2: 9.7% (Rare)
3. Rarity 3: 15.5% (Uncommon)
4. Rarity 4: 24.9% (Common)
5. Rarity 5: 46.9% (Basic)

### Series Progression
- Starts at Series 1 (0001)
- Increments when token ID reaches limit
- Maximum: 15 series total (4-bit allocation)

## Contract Functions

### Token Contract (NumberGoUp)
```typescript
// Read Functions
balanceOf(address account) returns (uint256)                    // Get ERC20 balance
erc721BalanceOf(address account) returns (uint256)             // Get NFT balance
getOwnedERC721Data(address owner) returns (uint256[], uint256[]) // Get full and formatted NFT IDs
erc721TransferExempt(address account) returns (bool)           // Check if address is transfer exempt
ownerOf(uint256 tokenId) returns (address)                     // Get NFT owner
currentTokenId() returns (uint256)                             // Get current token ID
erc20TotalSupply() returns (uint256)                          // Get total ERC20 supply
erc721TotalSupply() returns (uint256)                         // Get total NFT supply
tokenURI(uint256 id) returns (string)                         // Get token metadata URI

// Write Functions
transfer(address to, uint256 amount) returns (bool)            // Transfer tokens
approve(address spender, uint256 amount) returns (bool)        // Approve ERC20 spending
setERC721TransferExempt(address account, bool exempt)         // Set transfer exempt status
setURIBase(string newBase)                                    // Update base URI for metadata
```

### Staking Contract (NGUStaking)
```typescript
// Read Functions
balanceOf(address owner) returns (uint256)                     // Get staked balance
getStakedERC721Tokens(address owner) returns (uint256[], uint256[]) // Get staked NFT IDs
erc20TotalBalanceOf(address owner) returns (uint256)          // Get total balance (staked + unstaked)
getStakedOwner(uint256 tokenId) returns (address)             // Get staked token owner
getStakedIndex(uint256 tokenId) returns (uint256)             // Get token's position in stake queue

// Write Functions
stake(uint256[] calldata tokenIds)                            // Stake NFTs
unstake(uint256[] calldata tokenIds)                          // Unstake NFTs
```

## Event Emissions

### ERC20 Events
```typescript
event Transfer(address indexed from, address indexed to, uint256 value)
event Approval(address indexed owner, address indexed spender, uint256 value)
```

### ERC721 Events
```typescript
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)
event ApprovalForAll(address indexed owner, address indexed operator, bool approved)
event URIBaseUpdated(string newBase)
```

### Staking Events
```typescript
event Staked(address indexed owner, uint256 indexed tokenId)
event Unstaked(address indexed owner, uint256 indexed tokenId)
```

## Transfer Mechanics

### Transfer Types
1. **Exempt → Exempt**: Regular ERC20 transfer
2. **Exempt → Non-exempt**: Mints NFTs to recipient
3. **Non-exempt → Exempt**: Burns NFTs from sender
4. **Non-exempt → Non-exempt**: Transfers NFTs between queues

### Gas Usage & Limits
- Exempt → Non-exempt (Minting): ~71K gas/NFT, max 400 NFTs/tx
- Non-exempt → Exempt (Burning): ~14K gas/NFT, max 700 NFTs/tx
- Non-exempt → Non-exempt: ~57K gas/NFT, max 400 NFTs/tx
- Exempt → Exempt: ~52.5K gas flat rate

## Staking System

### Features
- 1:1 staking ratio (1 NFT = 1 token)
- FIFO queue for NFT management
- Maintains original token ownership
- Automatic queue position tracking

### Limits
- Maximum stake batch: 400 tokens
- Maximum unstake batch: 400 tokens
- Gas usage: ~50-60K per operation

## Security Considerations

### Best Practices
1. **Batch Operations**
   - Keep below 80% of maximum limits
   - Monitor gas usage
   - Split large operations into smaller batches

2. **Balance Management**
   - Verify total balance (staked + unstaked)
   - Check NFT ownership before operations
   - Monitor queue positions

3. **Transfer Safety**
   - Verify recipient status (exempt/non-exempt)
   - Check allowances for ERC20 transfers
   - Ensure sufficient gas for NFT operations

### Error Handling
Common errors to handle:
- `InvalidSender`: Invalid sending address
- `InvalidRecipient`: Invalid receiving address
- `SenderInsufficientBalance`: Not enough tokens
- `InvalidTokenId`: Token ID doesn't exist
- `Unauthorized`: Caller not authorized
- `MaxNFTsReached`: Series limit reached
- `QueueEmpty`: No NFTs in queue
- `UnsafeRecipient`: Recipient cannot handle NFTs
- `InvalidStakingExemption`: Invalid staking exemption status
- `InvalidStakingContract`: Invalid staking contract implementation
- `TokenAlreadyStaked`: Token is already staked
- `TokenNotStaked`: Token is not staked
- `StakerInsufficientBalance`: Insufficient balance for staking