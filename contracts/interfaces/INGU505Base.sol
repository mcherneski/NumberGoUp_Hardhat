// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title INGU505Base Interface
/// @notice Interface for the NGU505 base functionality
/// @dev Combines ERC20 and ERC721 functionality with additional features  
interface INGU505Base is IERC165 {
    // Events    
    /// @notice Emitted when approval is granted for token spending
    /// @param owner The token owner
    /// @param spender The approved spender
    /// @param value The approved amount
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

    /// @notice Emitted when an address is set to be exempt from ERC721 transfer restrictions
    /// @param account The address that was set
    /// @param value True if the address is exempt, false if not
    event ERC721TransferExemptSet(address indexed account, bool value);

    /// @notice Emitted when the NFT series is changed
    /// @param oldSeries The old series
    /// @param newSeries The new series
    event NFTSeriesChanged(uint256 indexed oldSeries, uint256 indexed newSeries);

    /// @notice Emitted when an operator is approved/disapproved for all tokens
    /// @param owner The token owner
    /// @param operator The operator address
    /// @param approved True if approved, false if disapproved
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // Errors
    /// @notice Sender has insufficient balance for transfer
    /// @param required Amount required
    /// @param available Amount available
    error SenderInsufficientBalance(uint256 required, uint256 available);
    /// @notice Insufficient allowance for transfer
    /// @param requested Amount requested
    /// @param available Amount available
    error InsufficientAllowance(uint256 requested, uint256 available);
    /// @notice Invalid recipient address
    error InvalidRecipient();
    /// @notice Invalid sender address
    error InvalidSender();
    /// @notice Invalid spender address
    error InvalidSpender();
    /// @notice Invalid approval operation
    error InvalidApproval();
    /// @notice Maximum mint limit reached
    error MintLimitReached();
    /// @notice Invalid exemption operation
    error InvalidExemption();
    /// @notice Owned index overflow
    error OwnedIndexOverflow();
    /// @notice Permit deadline has expired
    error PermitDeadlineExpired();
    /// @notice Invalid signer for permit
    error InvalidSigner();
    /// @notice Caller is not the owner
    error NotOwner();
    /// @notice Invalid token ID
    error InvalidTokenId();
    /// @notice Token already exists
    error AlreadyExists();
    /// @notice Maximum supply exceeded
    /// @param currentSupply Current total supply
    /// @param maxSupply Maximum allowed supply
    error MaxSupplyExceeded(uint256 currentSupply, uint256 maxSupply);
    /// @notice Decimals value too low
    error DecimalsTooLow();
    /// @notice Invalid transfer operation
    error InvalidTransfer();
    /// @notice Token is locked
    /// @param tokenId ID of the locked token
    /// @param unlockTime Time when token unlocks
    error TokenLocked(uint256 tokenId, uint256 unlockTime);
    /// @notice Invalid operation
    /// @param reason Description of why operation is invalid
    error InvalidOperation(string reason);
    /// @notice Batch operation failed
    /// @param failedIds List of token IDs that failed
    /// @param reason Reason for failure
    error BatchOperationFailed(uint256[] failedIds, string reason);
    /// @notice Token not found in queue
    error TokenNotFound();
    /// @notice Unauthorized operation
    error Unauthorized();
    /// @notice Invalid operator
    error InvalidOperator();
    /// @notice Unsafe recipient
    error UnsafeRecipient();
    /// @notice Maximum NFTs reached
    error MaxNFTsReached(string message);
    /// @notice Invalid staking contract
    error InvalidStakingContract();

    // Core ERC20 functions
    /// @notice Transfers tokens from sender to recipient
    /// @param to The recipient address
    /// @param value The amount to transfer
    /// @return success True if the transfer succeeded
    /// @dev Will automatically handle NFT transfers based on whole token amounts
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Returns the current token ID
    /// @return The current token ID
    function currentTokenId() external view returns (uint256);

    /// @notice Transfers tokens from one address to another
    /// @param from The sender address
    /// @param to The recipient address
    /// @param value The amount to transfer
    /// @return success True if the transfer succeeded
    /// @dev Requires approval if sender is not msg.sender
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    /// @notice Approves an address to spend tokens
    /// @param spender The address to approve
    /// @param value The amount to approve
    /// @return success True if the approval succeeded
    function approve(address spender, uint256 value) external returns (bool);

    /// @notice Sets the staking contract
    /// @param stakingContract_ The address of the staking contract
    /// @return True if the staking contract was set successfully
    function setStakingContract(address stakingContract_) external returns (bool);

    /// @notice Returns the amount of tokens approved for a spender
    /// @param owner The token owner
    /// @param spender The spender address
    /// @return The amount approved
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Returns the total token supply
    /// @return The total supply
    function totalSupply() external view returns (uint256);

    /// @notice Returns the token balance of an address
    /// @param account The address to query
    /// @return The balance
    function balanceOf(address account) external view returns (uint256);

    // Core ERC721 functions
    /// @notice Returns the owner of a specific NFT
    /// @param tokenId The NFT token ID
    /// @return The owner address
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Returns the URI for a token's metadata
    /// @param id The token ID
    /// @return The metadata URI
    function tokenURI(uint256 id) external view returns (string memory);

    /// @notice Returns the number of NFTs owned by an address
    /// @param owner The address to query
    /// @return tokenIds The formatted token IDs owned by the address
    function owned(address owner) external view returns (uint256[] memory tokenIds);

    /// @notice Returns the full and formatted token IDs owned by an address
    /// @param owner The address to query
    /// @return fullTokenId The full token IDs
    /// @return formattedTokenId The formatted token IDs    
    function getOwnedERC721Data(address owner) external view returns (uint256[] memory fullTokenId, uint256[] memory formattedTokenId);

    /// @notice Returns the number of NFTs owned by an address
    /// @param owner The address to query
    /// @return The number of NFTs owned
    function erc721BalanceOf(address owner) external view returns (uint256);

    /// @notice Returns the ERC20 balance of an address
    /// @param owner The address to query
    /// @return The ERC20 balance
    function erc20BalanceOf(address owner) external view returns (uint256);

    /// @notice Returns the total number of NFTs
    /// @return The total NFT supply
    function erc721TotalSupply() external view returns (uint256);

    /// @notice Returns the total ERC20 supply
    /// @return The total ERC20 supply
    function erc20TotalSupply() external view returns (uint256);

    // Base functions
    /// @notice Returns the token name
    /// @return The name
    function name() external view returns (string memory);

    /// @notice Returns the token symbol
    /// @return The symbol
    function symbol() external view returns (string memory);

    /// @notice Returns the number of decimals
    /// @return The decimals
    function decimals() external view returns (uint8);

    /// @notice Returns the base unit (1 token in smallest units)
    /// @return The base unit
    function units() external view returns (uint256);

    /// @notice Returns the total number of NFTs minted
    /// @return The number minted
    function minted() external view returns (uint256);
    
    // ERC721 Transfer Exemption
    /// @notice Checks if an address is exempt from ERC721 transfer restrictions
    /// @param target The address to check
    /// @return True if exempt
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
    /// @notice EIP-2612 permit function for gasless approvals
    /// @param owner The token owner
    /// @param spender The spender to approve
    /// @param value The amount to approve
    /// @param deadline The deadline for the signature
    /// @param v The recovery byte of the signature
    /// @param r Half of the ECDSA signature pair
    /// @param s Half of the ECDSA signature pair
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    
    /// @notice Returns the current nonce for an address
    /// @param owner The address to query
    /// @return The current nonce
    function nonces(address owner) external view returns (uint256);

    /// @notice Returns the domain separator used in the permit signature
    /// @return The domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns the maximum total supply of ERC20 tokens
    /// @return The maximum supply
    function maxTotalSupplyERC20() external view returns (uint256);

    /// @notice Returns the staking contract address
    /// @return The address of the staking contract
    function stakingContract() external view returns (address);

    /// @notice Returns the role identifier for exemption managers
    /// @return The keccak256 hash of "EXEMPTION_MANAGER_ROLE"
    function EXEMPTION_MANAGER_ROLE() external view returns (bytes32);

    /// @notice Transfers ERC20 tokens from one address to another
    /// @param from_ The sender address
    /// @param to_ The recipient address
    /// @param value_ The amount to transfer
    /// @return success True if the transfer succeeded
    function erc20TransferFrom(address from_, address to_, uint256 value_) external returns (bool);

    /// @notice Gets the index of a token in its owner's queue
    /// @param tokenId_ The token ID to query
    /// @return index_ The index in the owner's queue
    function getOwnedIndex(uint256 tokenId_) external view returns (uint256 index_);
} 
