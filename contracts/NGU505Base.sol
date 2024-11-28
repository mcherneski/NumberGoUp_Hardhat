// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {INGU505Base} from "./interfaces/INGU505Base.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

abstract contract NGU505Base is INGU505Base, ReentrancyGuard {
    // ============ Storage ============
    // Core state variables
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public immutable units;
    uint256 public totalSupply;
    uint256 public minted;
    uint256 private immutable _maxTotalSupplyERC20;

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

    // ============ Constructor ============
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxTotalSupplyERC20_
    ) {
        name = name_;
        symbol = symbol_;
        
        if (decimals_ < 18) {
            revert DecimalsTooLow();
        }
        decimals = decimals_;
        units = 10 ** decimals;
        _maxTotalSupplyERC20 = maxTotalSupplyERC20_;

        _INITIAL_CHAIN_ID = block.chainid;
        _INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    // ============ External View Functions ============
    function erc20TotalSupply() public view virtual returns (uint256) {
        return totalSupply;
    }

    function erc721TotalSupply() public view virtual returns (uint256) {
        return minted;
    }

    function erc721TransferExempt(address target_) public view virtual returns (bool) {
        return _erc721TransferExempt[target_];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _getOwnerOf(tokenId);
        if (owner == address(0)) revert NotFound();
        return owner;
    }

    function erc20BalanceOf(address owner) public view virtual override returns (uint256) {
        return balanceOf[owner];
    }

    function erc721BalanceOf(address owner) public view virtual override returns (uint256) {
        return _owned[owner].length;
    }

    // ============ External Transfer Functions ============
    function transfer(address to_, uint256 value_) public virtual override nonReentrant returns (bool) {
        if (to_ == address(0)) revert InvalidRecipient();
        return _transferERC20WithERC721(msg.sender, to_, value_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) public virtual override nonReentrant returns (bool) {
        if (from_ == address(0)) revert InvalidSender();
        if (to_ == address(0)) revert InvalidRecipient();

        uint256 allowed = allowance[from_][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from_][msg.sender] = allowed - value_;
        }

        return _transferERC20WithERC721(from_, to_, value_);
    }

    function approve(address spender, uint256 value) public virtual override returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    // ============ Internal Mint/Burn Functions ============
    function _mintERC20(address to_, uint256 value_) internal virtual {
        if (to_ == address(0)) revert InvalidRecipient();
        if (totalSupply + value_ > _maxTotalSupplyERC20) {
            revert MaxSupplyExceeded(totalSupply + value_, _maxTotalSupplyERC20);
        }
        _transferERC20WithERC721(address(0), to_, value_);
    }

    function _mintERC721(address to_) internal virtual {
        if (to_ == address(0)) revert InvalidRecipient();

        unchecked {
            ++minted;
        }

        if (minted == type(uint256).max) {
            revert MintLimitReached();
        }

        uint256 id = minted;
        if (_getOwnerOf(id) != address(0)) {
            revert AlreadyExists();
        }

        _transferERC721(address(0), to_, id);
    }

    function _setERC721TransferExempt(address account_, bool value_) internal virtual {
        _erc721TransferExempt[account_] = value_;
    }

    // ============ Internal Transfer Functions ============
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
        if (from_ != address(0)) {
            if (_getOwnerOf(id_) != from_) revert NotOwner();
            _removeFromOwned(from_, id_);
        }

        if (to_ != address(0)) {
            _addToOwned(to_, id_);
        }

        emit ERC721Transfer(from_, to_, id_);
    }

    // ============ Internal Ownership Management ============
    function _addToOwned(address to_, uint256 tokenId_) internal {
        uint256 index = _owned[to_].length;
        _owned[to_].push(tokenId_);
        _setOwnerOf(tokenId_, to_);
        _setOwnedIndex(tokenId_, index);
    }

    function _removeFromOwned(address from_, uint256 tokenId_) internal {
        uint256 index = _getOwnedIndex(tokenId_);
        uint256 lastIndex = _owned[from_].length - 1;
        if (index != lastIndex) {
            uint256 lastTokenId = _owned[from_][lastIndex];
            _owned[from_][index] = lastTokenId;
            _setOwnedIndex(lastTokenId, index);
        }
        _owned[from_].pop();
        delete _ownedData[tokenId_];
    }

    function _getOwnerOf(uint256 tokenId_) internal view returns (address owner_) {
        uint256 data = _ownedData[tokenId_];
        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    function _setOwnerOf(uint256 tokenId_, address owner_) internal {
        uint256 data = _ownedData[tokenId_];
        assembly {
            data := add(
                and(data, _BITMASK_OWNED_INDEX),
                and(owner_, _BITMASK_ADDRESS)
            )
        }
        _ownedData[tokenId_] = data;
    }

    function _getOwnedIndex(uint256 tokenId_) internal view returns (uint256 index_) {
        uint256 data = _ownedData[tokenId_];
        assembly {
            index_ := shr(160, data)
        }
    }

    function _setOwnedIndex(uint256 tokenId_, uint256 index_) internal {
        if (index_ > _BITMASK_OWNED_INDEX >> 160) revert OwnedIndexOverflow();
        uint256 data = _ownedData[tokenId_];
        assembly {
            data := add(
                and(data, _BITMASK_ADDRESS),
                and(shl(160, index_), _BITMASK_OWNED_INDEX)
            )
        }
        _ownedData[tokenId_] = data;
    }

    // ============ Internal Transfer Functions ============
    function _transferERC20WithERC721(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual returns (bool) {
        // Check balance
        if (balanceOf[from_] < value_) {
            revert SenderInsufficientBalance(value_, balanceOf[from_]);
        }

        // Perform ERC20 transfer
        _transferERC20(from_, to_, value_);

        // Cache exemption status
        bool isFromExempt = erc721TransferExempt(from_);
        bool isToExempt = erc721TransferExempt(to_);

        // Early return if both parties are exempt
        if (isFromExempt && isToExempt) {
            return true;
        }

        // Calculate whole tokens
        uint256 nftsToTransfer = value_ / units;

        // Handle NFT transfers based on exemption status
        if (isFromExempt) {
            // Only mint new tokens
            for (uint256 i; i < nftsToTransfer;) {
                _mintERC721(to_);
                unchecked { ++i; }
            }
        } else if (isToExempt) {
            // Only burn tokens
            for (uint256 i; i < nftsToTransfer;) {
                _withdrawAndBurnERC721(from_);
                unchecked { ++i; }
            }
        } else {
            // Transfer tokens directly
            for (uint256 i; i < nftsToTransfer;) {
                _transferERC721(from_, to_, 0);
                unchecked { ++i; }
            }
        }

        return true;
    }

    function _withdrawAndBurnERC721(address from_) internal virtual {
        if (from_ == address(0)) revert InvalidSender();
        uint256[] storage ownedTokens = _owned[from_];
        if (ownedTokens.length == 0) revert NotFound();
        uint256 tokenId = ownedTokens[0];
        _transferERC721(from_, address(0), tokenId);
    }

    // ============ EIP-2612 Functions ============
    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32) {
        return block.chainid == _INITIAL_CHAIN_ID
            ? _INITIAL_DOMAIN_SEPARATOR
            : _computeDomainSeparator();
    }

    function _computeDomainSeparator() internal view virtual returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override {
        if (deadline < block.timestamp) revert PermitDeadlineExpired();

        // Unchecked because the only math done is incrementing
        // the owner's nonce which cannot realistically overflow.
        unchecked {
            bytes32 structHash = keccak256(
                abi.encode(
                    keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                    owner,
                    spender,
                    value,
                    nonces[owner]++,
                    deadline
                )
            );

            bytes32 hash = keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
            );

            address signer = ecrecover(hash, v, r, s);
            if (signer == address(0) || signer != owner) revert InvalidSigner();

            allowance[owner][spender] = value;
        }

        emit Approval(owner, spender, value);
    }

    // ============ Interface Support ============
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return interfaceId == type(INGU505Base).interfaceId ||
               interfaceId == type(IERC165).interfaceId;
    }
} 