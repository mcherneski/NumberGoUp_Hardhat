// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {INGU505Base} from "./interfaces/INGU505Base.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";
import {ERC721Events} from "./lib/ERC721Events.sol";

abstract contract NGU505Base is INGU505Base, ReentrancyGuard {
    // Error definitions
    error DecimalsTooLow();
    error InvalidRecipient();
    error InvalidSender();
    error InvalidSpender();
    error InvalidApproval();
    error MintLimitReached();
    error AlreadyExists();
    error InvalidExemption();
    error OwnedIndexOverflow();
    error PermitDeadlineExpired();
    error InvalidSigner();
    error NotOwner();
    error NotFound();

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ERC721Transfer(address indexed from, address indexed to, uint256 indexed id);

    // Core state variables
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public immutable units;
    uint256 public totalSupply;
    uint256 public minted;

    // EIP-2612 support
    uint256 internal immutable _INITIAL_CHAIN_ID;
    bytes32 internal immutable _INITIAL_DOMAIN_SEPARATOR;

    // Core mappings
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) internal _erc721TransferExempt;
    mapping(address => uint256) public nonces;

    // Ownership data
    mapping(address => uint256[]) private _owned;
    mapping(uint256 => uint256) private _ownedData;

    // Bitmask constants
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) 
    {
        name = name_;
        symbol = symbol_;
        
        if (decimals_ < 18) {
            revert DecimalsTooLow();
        }
        decimals = decimals_;
        units = 10 ** decimals;

        _INITIAL_CHAIN_ID = block.chainid;
        _INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    // Core ERC20 functions
    function transfer(address to_, uint256 value_) public virtual nonReentrant returns (bool) {
        if (to_ == address(0)) revert InvalidRecipient();
        return _transferERC20WithERC721(msg.sender, to_, value_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) public virtual nonReentrant returns (bool) {
        if (from_ == address(0)) revert InvalidSender();
        if (to_ == address(0)) revert InvalidRecipient();

        uint256 allowed = allowance[from_][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from_][msg.sender] = allowed - value_;
        }

        return _transferERC20WithERC721(from_, to_, value_);
    }

    function approve(
        address spender_,
        uint256 value_
    ) public virtual nonReentrant returns (bool) {
        if (spender_ == address(0)) revert InvalidSpender();
        
        allowance[msg.sender][spender_] = value_;
        emit Approval(msg.sender, spender_, value_);
        return true;
    }

    // Core ERC721 functions
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _getOwnerOf(tokenId);
        if (owner == address(0)) revert("NGU505: owner query for nonexistent token");
        return owner;
    }

    function erc721BalanceOf(address owner_) public view virtual returns (uint256) {
        return _owned[owner_].length;
    }

    function erc20BalanceOf(address owner_) public view virtual returns (uint256) {
        return balanceOf[owner_];
    }

    // Internal transfer helpers
    function _transferERC20(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual {
        if (from_ == address(0)) {
            totalSupply += value_;
        } else {
            unchecked {
                balanceOf[from_] -= value_;
            }
        }

        unchecked {
            balanceOf[to_] += value_;
        }

        emit Transfer(from_, to_, value_);
    }

    function _transferERC721(
        address from_,
        address to_,
        uint256 id_
    ) internal virtual {
      // Ok TOMORROW YOU NEED TO LOOK AT THIS CODE. NotOwner() is being triggered, which means the owner is not being exempted correctly. 
      // This may be an issue with the exemption or it could be a problem with the _transferERC20WithERC721 function.
        if (from_ != address(0)) {
            if (_getOwnerOf(id_) != from_) revert NotOwner();
            removeOwnedById(from_, id_);
            delete _ownedData[id_];
        }

        if (to_ != address(0)) {
            uint256 index = _owned[to_].length;
            _owned[to_].push(id_);
            _setOwnerOf(id_, to_);
            _setOwnedIndex(id_, index);
        }

        emit ERC721Transfer(from_, to_, id_);
    }

    function _transferERC20WithERC721(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual returns (bool) {
        // Cache balances before transfer to avoid multiple SLOAD operations
        uint256 fromBalance = balanceOf[from_];
        uint256 toBalance = balanceOf[to_];

        // Perform ERC20 transfer
        _transferERC20(from_, to_, value_);

        // Cache exemption status to avoid multiple SLOAD operations
        bool isFromExempt = erc721TransferExempt(from_);
        bool isToExempt = erc721TransferExempt(to_);

        // Early return if both parties are exempt
        if (isFromExempt && isToExempt) {
            return true;
        }

        // Calculate whole token changes
        uint256 fromBalanceAfter = balanceOf[from_];
        uint256 toBalanceAfter = balanceOf[to_];
        
        uint256 fromTokensDelta = fromBalance / units - fromBalanceAfter / units;
        uint256 toTokensDelta = toBalanceAfter / units - toBalance / units;

        if (isFromExempt) {
            // Mint any new whole tokens to recipient
            for (uint256 i = 0; i < toTokensDelta; ) {
                _mintERC721(to_);
                unchecked { ++i; }
            }
        } else if (isToExempt) {
            // Burn whole tokens from sender
            for (uint256 i = 0; i < fromTokensDelta; ) {
                _withdrawAndBurnERC721(from_);
                unchecked { ++i; }
            }
        } else {
            // Transfer whole tokens between non-exempt addresses
            uint256 nftsToTransfer = value_ / units;
            
            // First handle direct transfers
            for (uint256 i = 0; i < nftsToTransfer; ) {
                _transferERC721(from_, to_, 0);
                unchecked { ++i; }
            }

            // Then handle any fractional cleanup
            if (fromTokensDelta > nftsToTransfer) {
                _withdrawAndBurnERC721(from_);
            }

            if (toTokensDelta > nftsToTransfer) {
                _mintERC721(to_);
            }
        }

        return true;
    }

    // Owner management functions
    function _setOwnerOf(uint256 tokenId, address owner) internal virtual {
        uint256 data = _ownedData[tokenId];
        assembly {
            data := add(
                and(data, _BITMASK_OWNED_INDEX),
                and(owner, _BITMASK_ADDRESS)
            )
        }
        _ownedData[tokenId] = data;
    }

    function _getOwnerOf(
        uint256 tokenId
    ) internal view virtual returns (address owner_) {
        uint256 data = _ownedData[tokenId];
        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    function _getOwnedIndex(
        uint256 tokenId
    ) internal view virtual returns (uint256 ownedIndex_) {
        uint256 data = _ownedData[tokenId];
        assembly {
            ownedIndex_ := shr(160, data)
        }
    }

    function _setOwnedIndex(uint256 id_, uint256 index_) internal virtual {
        uint256 data = _ownedData[id_];
        if (index_ > _BITMASK_OWNED_INDEX >> 160) revert OwnedIndexOverflow();

        assembly {
            data := add(
                and(data, _BITMASK_ADDRESS),
                and(shl(160, index_), _BITMASK_OWNED_INDEX)
            )
        }
        _ownedData[id_] = data;
    }

    function removeOwnedById(address owner, uint256 tokenId) internal {
        uint256 index = _getOwnedIndex(tokenId);
        uint256 lastIndex = _owned[owner].length - 1;
        
        if (index != lastIndex) {
            uint256 lastTokenId = _owned[owner][lastIndex];
            _owned[owner][index] = lastTokenId;
            _setOwnedIndex(lastTokenId, index);
        }
        
        _owned[owner].pop();
    }

    // ERC721 transfer exempt management
    function erc721TransferExempt(
        address target_
    ) public view virtual returns (bool) {
        return target_ == address(0) || _erc721TransferExempt[target_];
    }

    function _setERC721TransferExempt(
        address target_,
        bool state_
    ) internal virtual {
        if (target_ == address(0)) revert InvalidExemption();
        _erc721TransferExempt[target_] = state_;
    }

    // EIP-2612 permit
    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) public virtual nonReentrant {
        if (deadline_ < block.timestamp) revert PermitDeadlineExpired();
        if (value_ >= type(uint256).max) revert InvalidApproval();
        if (spender_ == address(0)) revert InvalidSpender();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256(
                            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                        ),
                        owner_,
                        spender_,
                        value_,
                        nonces[owner_]++,
                        deadline_
                    )
                )
            )
        );

        address recoveredAddress = ecrecover(digest, v_, r_, s_);
        if (recoveredAddress == address(0) || recoveredAddress != owner_) {
            revert InvalidSigner();
        }

        allowance[recoveredAddress][spender_] = value_;
        emit Approval(owner_, spender_, value_);
    }

    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        return block.chainid == _INITIAL_CHAIN_ID
            ? _INITIAL_DOMAIN_SEPARATOR
            : _computeDomainSeparator();
    }

    function _computeDomainSeparator() internal view virtual returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    // Interface support
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual returns (bool) {
        return interfaceId == type(INGU505Base).interfaceId ||
               interfaceId == type(IERC165).interfaceId;
    }

    // Add functions from NGU505.sol
    function getOwnerOfId(uint256 id_) public view virtual returns (address) {
        return _getOwnerOf(id_);
    }

    function erc20TotalSupply() public view virtual returns (uint256) {
        return totalSupply;
    }

    function erc721TotalSupply() public view virtual returns (uint256) {
        return minted;
    }

    function _mintERC20(address to_, uint256 value_) internal virtual {
        if (to_ == address(0)) {
            revert InvalidRecipient();
        }

        if (totalSupply + value_ > type(uint256).max) {
            revert MintLimitReached();
        }

        _transferERC20WithERC721(address(0), to_, value_);
    }

    function _mintERC721(address to_) internal virtual {
        if (to_ == address(0)) {
            revert InvalidRecipient();
        }

        unchecked {
            ++minted;
        }

        if (minted == type(uint256).max) {
            revert MintLimitReached();
        }

        uint256 id = minted;
        address erc721Owner = _getOwnerOf(id);

        if (erc721Owner != address(0)) {
            revert AlreadyExists();
        }

        _transferERC721(erc721Owner, to_, id);
    }

    function tokenURI(uint256 id_) public view virtual returns (string memory);

    /// @notice Internal function to burn ERC721
    /// @dev Removes the first token from the owner's queue and burns it
    /// @param from_ The address to burn the token from
    function _withdrawAndBurnERC721(address from_) internal virtual {
        if (from_ == address(0)) {
            revert InvalidSender();
        }

        // Get the first token in the owner's queue
        uint256 tokenId = _getNextQueueId(from_);

        // Transfer to zero address to burn
        _transferERC721(from_, address(0), tokenId);
    }

    /// @notice Helper function to get the next token ID from an address's queue
    /// @param owner_ The address to get the next token ID from
    /// @return The next token ID in the queue
    function _getNextQueueId(address owner_) internal view virtual returns (uint256) {
        uint256[] storage ownedTokens = _owned[owner_];
        if (ownedTokens.length == 0) revert NotFound();
        return ownedTokens[0];
    }
} 