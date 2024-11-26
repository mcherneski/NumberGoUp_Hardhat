// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INGU505TokenManager {
    // Events
    event NFTStaked(address indexed owner, uint256 indexed tokenId);
    event NFTUnstaked(address indexed owner, uint256 indexed tokenId);
    event BatchNFTStaked(address indexed owner, uint256[] tokenIds);
    event BatchNFTUnstaked(address indexed owner, uint256[] tokenIds);

    // Errors
    error QueueEmpty();
    error InsufficientBalance();
    error NotTokenOwner();
    error EmptyStakingArray();
    error InvalidStakingExemption();
    error StakingDisabled();

    // Queue Management Functions
    function getERC721TokensInQueue(address owner_, uint256 count_) external view returns (uint256[] memory);
    function getIdAtQueueIndex(address owner_, uint128 index_) external view returns (uint256);
    function getNextQueueId(address owner_) external view returns (uint256);
    function getQueueLength(address owner_) external view returns (uint256);

    // Staking Functions
    function getStakedERC20Balance(address owner_) external view returns (uint256);
    function getStakedTokens(address owner_) external view returns (uint256[] memory);
    function stakeNFT(uint256 id_) external returns (bool);
    function unstakeNFT(uint256 id_) external returns (bool);
    function stakeMultipleNFTs(uint256[] calldata ids_) external returns (bool);
} 