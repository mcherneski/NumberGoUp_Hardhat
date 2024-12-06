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

    /// @notice Emitted when an NFT is minted
    /// @param to The recipient address
    /// @param id The NFT token ID
    event ERC721Minted(address indexed to, uint256 indexed id);

    /// @notice Emitted when an address is granted the exemption manager role
    /// @param account The address that was granted the role
    event ExemptionManagerAdded(address indexed account);

    /// @notice Emitted when an address is removed from the exemption manager role
    /// @param account The address that was removed from the role
    event ExemptionManagerRemoved(address indexed account);

    // Errors
    error NotFound();
    error SenderInsufficientBalance(uint256 required, uint256 available);
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
    error DecimalsTooLow();
    error InvalidTransfer(address from, address to, string reason);
    error TokenLocked(uint256 tokenId, uint256 unlockTime);
    error InvalidOperation(string reason);
    error BatchOperationFailed(uint256[] failedIds, string reason);
    error QueueEmpty();
    error QueueFull();
    error TokenNotFound();

    // Core ERC20 functions
    function transfer(address to, uint256 value) external returns (bool);
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
    
    // Exemption Manager Functions
    /// @notice Sets whether an address is exempt from ERC721 transfer restrictions
    /// @param account_ The address to modify
    /// @param value_ True to make exempt, false to remove exemption
    function setERC721TransferExempt(address account_, bool value_) external;

    /// @notice Grants exemption manager role to an address
    /// @param account_ The address to grant the role to
    function addExemptionManager(address account_) external;

    /// @notice Removes exemption manager role from an address
    /// @param account_ The address to remove the role from
    function removeExemptionManager(address account_) external;

    /// @notice Returns whether an address has the exemption manager role
    /// @param account_ The address to check
    /// @return True if the address is an exemption manager
    function isExemptionManager(address account_) external view returns (bool);
    
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
    function maxTotalSupplyERC20() external view returns (uint256);

    // Owned Token Management
    function getOwnedTokens(address owner_) external view returns (uint256[] memory);
} 