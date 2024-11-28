// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title INGU505TokenManager Interface
/// @notice Interface for NGU505 token management functionality
/// @dev Handles staking and queue management for NFTs
interface INGU505TokenManager is IERC165 {
    // Events
    event NFTStaked(address indexed owner, uint256 indexed tokenId);
    event NFTUnstaked(address indexed owner, uint256 indexed tokenId);
    event BatchNFTStaked(address indexed owner, uint256[] tokenIds);
    event BatchNFTUnstaked(address indexed owner, uint256[] tokenIds);

    // Errors
    error QueueEmpty();
    error ManagerInsufficientBalance();
    error NotTokenOwner();
    error EmptyStakingArray();
    error InvalidStakingExemption();
    error StakingDisabled();

    /// @notice Get the staked ERC20 balance for an address
    /// @param owner_ The address to check
    /// @return The staked balance
    function getStakedERC20Balance(address owner_) external view returns (uint256);

    /// @notice Get all staked tokens for an address
    /// @param owner_ The address to check
    /// @return Array of staked token IDs
    function getStakedTokens(address owner_) external view returns (uint256[] memory);

    /// @notice Stake a single NFT
    /// @param id_ The token ID to stake
    /// @return Success of the staking operation
    function stakeNFT(uint256 id_) external returns (bool);

    /// @notice Unstake a single NFT
    /// @param id_ The token ID to unstake
    /// @return Success of the unstaking operation
    function unstakeNFT(uint256 id_) external returns (bool);

    /// @notice Stake multiple NFTs at once
    /// @param ids_ Array of token IDs to stake
    /// @return Success of the batch staking operation
    function stakeMultipleNFTs(uint256[] calldata ids_) external returns (bool);

    /// @notice Get the length of the selling queue for an address
    /// @param owner_ The address to check
    /// @return The queue length
    function getQueueLength(address owner_) external view returns (uint256);

    /// @notice Get the next token ID in the queue
    /// @param owner_ The address to check
    /// @return The next token ID
    function getNextQueueId(address owner_) external view returns (uint256);

    /// @notice Get tokens in the selling queue
    /// @param owner_ The address to check
    /// @param count_ Number of tokens to return
    /// @return Array of token IDs in queue
    function getERC721TokensInQueue(
        address owner_,
        uint256 count_
    ) external view returns (uint256[] memory);

    /// @notice Get token ID at specific queue index
    /// @param owner_ The address to check
    /// @param index_ The index in the queue
    /// @return The token ID at the index
    function getIdAtQueueIndex(
        address owner_,
        uint128 index_
    ) external view returns (uint256);
} 