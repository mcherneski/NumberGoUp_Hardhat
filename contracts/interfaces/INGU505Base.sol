// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title INGU505Base Interface
/// @notice Interface for the NGU505 base functionality
/// @dev Combines ERC20 and ERC721 functionality with additional features
interface INGU505Base is IERC165 {
    // Events
    /// @notice Emitted when ERC20 tokens are transferred
    /// @param from The sender address
    /// @param to The recipient address
    /// @param value The amount of tokens transferred
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    /// @notice Emitted when an NFT is transferred
    /// @param from The sender address
    /// @param to The recipient address
    /// @param id The NFT token ID
    event ERC721Transfer(address indexed from, address indexed to, uint256 indexed id);
    
    /// @notice Emitted when approval is granted for token spending
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Additional Events
    /// @notice Emitted when multiple token operations occur
    /// @param from The sender address
    /// @param to The recipient address
    /// @param erc20Amount The amount of ERC20 tokens
    /// @param nftId The NFT ID (if applicable)
    /// @param operationType The type of operation (1=transfer, 2=stake, 3=unstake)
    event TokenOperations(
        address indexed from,
        address indexed to,
        uint256 erc20Amount,
        uint256 nftId,
        uint8 operationType
    );

    // Errors
    /// @notice Thrown when a requested item is not found
    error NotFound();
    /// @notice Thrown when balance is insufficient for operation
    /// @param required The required amount
    /// @param available The available balance
    error SenderInsufficientBalance(uint256 required, uint256 available);
    /// @notice Thrown when allowance is insufficient for operation
    /// @param requested The requested amount
    /// @param available The available allowance
    error InsufficientAllowance(uint256 requested, uint256 available);
    error InvalidRecipient();
    error InvalidSender();
    error InvalidSpender();
    error InvalidApproval();
    error MintLimitReached();
    error InvalidExemption();
    error OwnedIndexOverflow();
    error PermitDeadlineExpired();
    error InvalidSigner();
    error NotOwner();
    error InvalidTokenId();
    error AlreadyExists();
    error MaxSupplyExceeded(uint256 currentSupply, uint256 maxSupply);
        // Error definitions
    error DecimalsTooLow();

    error InvalidTransfer(address from, address to, string reason);

    error TokenLocked(uint256 tokenId, uint256 unlockTime);
    error InvalidOperation(string reason);
    error BatchOperationFailed(uint256[] failedIds, string reason);

    // Add queue-specific errors
    error QueueEmpty();
    error QueueFull();
    error QueueOutOfBounds();

    // Core ERC20 functions
    /// @notice Transfer tokens to a specified address
    /// @param to The recipient address
    /// @param value The amount to transfer
    /// @return bool Success of the transfer
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Transfer tokens from one address to another
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    
    function approve(address spender, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);

    // Core ERC721 functions
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 id) external view returns (string memory);
    function erc721BalanceOf(address owner) external view returns (uint256);
    function erc20BalanceOf(address owner) external view returns (uint256);
    function erc721TotalSupply() external view returns (uint256);
    function erc20TotalSupply() external view returns (uint256);

    // Base functions
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function units() external view returns (uint256);
    function minted() external view returns (uint256);
    
    // ERC721 Transfer Exemption
    function erc721TransferExempt(address target) external view returns (bool);
    function setSelfERC721TransferExempt(bool state) external;
    
    // EIP-2612 Permit
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Get the maximum total supply of ERC20 tokens
    /// @return The maximum total supply including decimals
    function maxTotalSupplyERC20() external view returns (uint256);

    // Add queue management functions
    function getNextQueueId(address owner_) external view returns (uint256);
    function getQueueLength(address owner_) external view returns (uint256);
    function getIdAtQueueIndex(address owner_, uint128 index_) external view returns (uint256);
} 