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
    /// @param tokenIds Array of staked NFT IDs
    event Staked(address indexed staker, uint256[] tokenIds);

    /// @notice Emitted when NFTs are unstaked
    /// @param staker The address that unstaked the NFTs
    /// @param tokenIds Array of unstaked NFT IDs
    event Unstaked(address indexed staker, uint256[] tokenIds);

    // Errors
    /// @notice Thrown when attempting to stake/unstake an empty array of tokens
    error EmptyStakingArray();

    /// @notice Thrown when attempting to stake/unstake more than the maximum batch size
    error BatchSizeExceeded();
    
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

    /// @notice Thrown when trying to transfer staked tokens
    /// @param required The amount trying to transfer
    /// @param available The available unstaked balance
    error InsufficientUnstakedBalance(uint256 required, uint256 available);

    /// @notice Thrown when a token is staked and cannot be transferred
    /// @param tokenId The ID of the staked token
    error TokenStaked(uint256 tokenId);

    // View Functions
    /// @notice Get the staked ERC20 balance for an address
    /// @param owner_ The address to check
    /// @return The total amount of staked ERC20 tokens
    function getStakedERC20Balance(address owner_) external view returns (uint256);

    /// @notice Get all staked tokens for an address
    /// @param owner_ The address to check
    /// @return Array of token IDs staked by the owner
    function getStakedERC721Tokens(address owner_) external view returns (uint256[] memory);

    /// @notice Get the total ERC20 balance of an address including staked tokens
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function erc20TotalBalanceOf(address owner_) external view returns (uint256);

    /// @notice Get the NFT ID format for a given token ID
    /// @param tokenId_ The token ID to format
    /// @return The formatted NFT ID
    /// @dev Combines the current series with the token ID
    function getNFTId(uint256 tokenId_) external view returns (uint256);

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