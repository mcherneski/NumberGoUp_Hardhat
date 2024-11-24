//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title INGU505 Interface
/// @notice Interface for the NGU505 contract, defining ERC20 and ERC721 combined functionalities.
interface INGU505 is IERC165 {
  /// Errors
  error NotFound();
  error InvalidTokenId();
  error AlreadyExists();
  error InvalidRecipient();
  error InvalidSender();
  error InvalidSpender();
  error InvalidOperator();
  error UnsafeRecipient();
  error RecipientIsERC721TransferExempt();
  error Unauthorized();
  error InsufficientAllowance();
  error DecimalsTooLow();
  error PermitDeadlineExpired();
  error InvalidSigner();
  error InvalidApproval();
  error OwnedIndexOverflow();
  error MintLimitReached();
  error InvalidExemption();
  error QueueEmpty();
  error NotOwner();
  error InsufficientBalance();


    // ERC721 Functions
    function tokenURI(uint256 id_) external view returns (string memory);

    function ownerOf(uint256 tokenId) external view returns (address);

    function owned(address owner_) external view returns (uint256[] memory);

    function erc721BalanceOf(address owner_) external view returns (uint256);

    function erc721TotalSupply() external view returns (uint256);

    // ERC20 Functions
    function erc20BalanceOf(address owner_) external view returns (uint256);

    function getStakedTokens(address owner_) external view returns (uint256[] memory);

    function erc20TotalSupply() external view returns (uint256);

    function approve(address spender_, uint256 value_) external returns (bool);

    function transferFrom(address from_, address to_, uint256 value_) external returns (bool);

    // Queue Functions
    // function getNextQueueId(address owner_) external view returns (uint256);

    // function getIdAtQueueIndex(address owner_, uint128 index_) external view returns (uint256);

    function getERC721TokensInQueue(
        address owner_,
        uint256 count_
    ) external view returns (uint256[] memory);

    // Exemption Functions
    function erc721TransferExempt(address target_) external view returns (bool);

    function setSelfERC721TransferExempt(bool state_) external;

    // EIP-2612 Permit Function
    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) external;

    // Domain Separator Function
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    // ERC165 Support Interface
    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    // Events

    /// @notice ERC20 Transfer event
    event ERC20Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice ERC20 Approval event
    event ERC20Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice ERC721 Transfer event
    event ERC721Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
}
