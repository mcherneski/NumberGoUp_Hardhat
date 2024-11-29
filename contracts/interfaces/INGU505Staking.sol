// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title INGU505Staking Interface
/// @notice Interface for NGU505 staking functionality
/// @dev Handles staking 
interface INGU505Staking is IERC165 {
    // Events
    event NFTStaked(address indexed owner, uint256 indexed tokenId);
    event NFTUnstaked(address indexed owner, uint256 indexed tokenId);
    event BatchNFTStaked(address indexed owner, uint256[] tokenIds);
    event BatchNFTUnstaked(address indexed owner, uint256[] tokenIds);

    // Errors
    error EmptyStakingArray();
    error InvalidStakingExemption();
    error StakingDisabled();
    error StakerInsufficientBalance(uint256 required, uint256 available);
    error TokenAlreadyStaked(uint256 tokenId);
    error NotTokenOwner();
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
} 