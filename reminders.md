# Project Reminders

## Potential Improvements

### Other Items
(Add more reminders here as they come up) 

### Transfer Intention
The transfer system is designed to handle ERC20 transfers while automatically managing NFT ownership:

1. ERC20 Transfer Rules:
   - Users can transfer any amount of ERC20 tokens (including fractional)
   - Transfers affect both sender's and receiver's ERC20 balances
   - Must respect allowances and balance checks

2. NFT Ownership Rules:
   - Each whole ERC20 token (1.0) must be represented by exactly one NFT
   - NFTs cannot be transferred directly, only through ERC20 transfers
   - NFTs move from sender to receiver based on selling queue (FIFO)
   - When balance drops below a whole number, last NFT is burned or sent to the recipient
   - When balance reaches a new whole number, new NFT is minted or transferred from sender to recipient.

3. Staking Interaction:
   - Staked NFTs are locked and cannot be transferred
   - Staked ERC20 balance is tracked separately
   - Total ERC20 balance is sum of staked and unstaked balances, stored in ERC20TotalBalanceOf[address]
   - Cannot transfer ERC20s that are staked (must unstake first)
   - Staking/unstaking moves NFTs between active and staked state

4. Queue Management:
   - Each address has a selling queue of NFTs
   - When sending tokens, NFTs are taken from the back of queue
   - When receiving tokens, NFTs are added to back of queue
   - Queue order must be maintained for predictable NFT transfers

5. Exemption Handling:
   - Exempt addresses (like DEX pairs) don't receive/hold NFTs
   - When transferring to exempt address, NFTs are burned
   - When receiving from exempt address, new NFTs are minted
   - Exemption status can only be changed by authorized roles

Example Flow:
1. User A has 5.5 tokens (5 NFTs)
2. User A sends 2.3 tokens to User B
3. 2 NFTs move from A's queue to B's queue
4. A is left with 3.2 tokens (3 NFTs)
5. B now has 2.3 tokens (2 NFTs)

This system ensures:
- NFT ownership always matches whole token balances
- Predictable NFT movement through queues
- No direct NFT transfers possible
- Clean interaction with staking system
- Proper handling of fractional transfers

# Future Investigations
- Investigate Doubly-Linked List implementation for DoubleEndedQueue.sol
  - Could provide O(1) removal without shifting
  - Would require more storage but might be more gas efficient for large queues
  - Consider trade-offs between storage costs and operation costs