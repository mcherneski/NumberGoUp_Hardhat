// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title INGU505Staking Interface
/// @notice Interface for NGU505 staking functionality
/// @dev Handles staking and unstaking of NFTs with associated ERC20 tokens
interface INGU505Staking is IERC165 {
    // Events
    /// @notice Emitted when NFTs are staked
    /// @param staker The address that staked the NFTs
    /// @param tokenId Array of staked NFT IDs
    event Staked(address indexed staker, uint256 tokenId);

    /// @notice Emitted when NFTs are unstaked
    /// @param staker The address that unstaked the NFTs
    /// @param tokenId Array of unstaked NFT IDs
    event Unstaked(address indexed staker, uint256 tokenId);

    // Errors

    /// @notice Thrown when attempting to unstake a token that is not staked
    /// @param tokenId The ID of the token that is not staked
    error TokenNotStaked(uint256 tokenId);

    /// @notice Thrown when attempting to stake/unstake an empty array of tokens
    error EmptyStakingArray();
    
    /// @notice Thrown when an exempt address attempts to stake
    error InvalidStakingExemption();

    /// @notice Thrown when trying to stake with insufficient balance
    /// @param required The required balance
    /// @param available The available balance
    error StakerInsufficientBalance(uint256 required, uint256 available);

    /// @notice Thrown when attempting to stake an already staked token
    /// @param tokenId The ID of the token that is already staked
    error TokenAlreadyStaked(uint256 tokenId);

    /// @notice Thrown when non-owner attempts to stake/unstake
    error NotTokenOwner();

    /// @notice Thrown when staked token index exceeds maximum value
    error IndexOverflow();

    // View Functions
    /// @notice Get the staked ERC20 balance for an address
    /// @param owner_ The address to check
    /// @return The total amount of staked ERC20 tokens
    function balanceOf(address owner_) external view returns (uint256);

    /// @notice Get all staked tokens for an address
    /// @param owner_ The address to check
    /// @return fullTokenId Array of complete NFT IDs (including series)
    /// @return formatId Array of formatted/display IDs
    function getStakedERC721Tokens(address owner_) external view returns (uint256[] memory fullTokenId, uint256[] memory formatId);

    /// @notice Get the total ERC20 balance of an address including staked tokens
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function erc20TotalBalanceOf(address owner_) external view returns (uint256);

    /// @notice Get the NFT ID format for a given token ID
    /// @param tokenId_ The token ID to format
    /// @return The formatted NFT ID
    /// @dev Combines the current series with the token ID
    function getNFTId(uint256 tokenId_) external view returns (uint256);

    /// @notice Get the staked owner of a token
    /// @param tokenId_ The token ID to check
    /// @return owner_ The address of the staker
    function getStakedOwner(uint256 tokenId_) external view returns (address owner_);

    /// @notice Get the index of a staked token in the owner's array
    /// @param tokenId_ The token ID to check
    /// @return index_ The index in the staked tokens array
    function getStakedIndex(uint256 tokenId_) external view returns (uint256 index_);

    // State-Changing Functions
    /// @notice Stake NFTs
    /// @param ids_ Array of token IDs to stake
    /// @return Success of the staking operation
    /// @dev Will revert if any token is already staked or sender is exempt
    function stake(uint256[] calldata ids_) external returns (bool);

    /// @notice Unstake NFTs
    /// @param ids_ Array of token IDs to unstake
    /// @return Success of the unstaking operation
    /// @dev Will revert if any token is not staked by sender
    function unstake(uint256[] calldata ids_) external returns (bool);
} 