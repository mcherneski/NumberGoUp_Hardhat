// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {INGU505Base} from "./interfaces/INGU505Base.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DoubleEndedQueue} from "./lib/DoubleEndedQueue.sol";

abstract contract NGU505Base is INGU505Base, ReentrancyGuard {
    using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

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

    // Add queue mapping
    mapping(address => DoubleEndedQueue.Uint256Deque) internal _sellingQueue;

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
        _maxTotalSupplyERC20 = maxTotalSupplyERC20_ * units;

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

    function maxTotalSupplyERC20() public view virtual override returns (uint256) {
        return _maxTotalSupplyERC20;
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
        if (allowed < value_) revert InsufficientAllowance(value_, allowed);

        if (allowed != type(uint256).max) {
            allowance[from_][msg.sender] = allowed - value_;
        }

        return _transferERC20WithERC721(from_, to_, value_);
    }

    function approve(
        address spender_,
        uint256 value_
    ) public virtual override returns (bool) {
        if (spender_ == address(0)) revert InvalidSpender();
        
        allowance[msg.sender][spender_] = value_;
        emit Approval(msg.sender, spender_, value_);
        return true;
    }

    function setSelfERC721TransferExempt(bool state) external virtual override {
        _setERC721TransferExempt(msg.sender, state);
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

        if (!erc721TransferExempt(to_)) {
            _owned[to_].push(id);
            _setOwnerOf(id, to_);
            _setOwnedIndex(id, _owned[to_].length - 1);
            _addToSellingQueue(to_, id);
        }
        emit ERC721Minted(to_, id);
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
        if (from_ != address(0)) {
            if (balanceOf[from_] < value_) {
                revert SenderInsufficientBalance(value_, balanceOf[from_]);
            }
        }

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

    function _withdrawAndBurnERC721(address from_) internal virtual {
        // Get and validate token from queue
        uint256 tokenId = _sellingQueue[from_].popFront();
        if (tokenId == 0) revert QueueEmpty();
        
        emit QueueOperation("Getting from queue for burn", tokenId);

        // Clean up ownership data
        _removeFromOwned(from_, tokenId);
        delete _ownedData[tokenId];

        emit ERC721Transfer(from_, address(0), tokenId);
    }

    function _transferERC721(
        address from_,
        address to_
    ) internal virtual {
        uint256 tokenId;
        
        if (from_ != address(0)) {
            // Get tokenId from queue
            tokenId = getNextQueueId(from_);
            if (tokenId == 0) revert QueueEmpty();
            
            // If burning, use dedicated burn function
            if (to_ == address(0)) {
                _withdrawAndBurnERC721(from_);
                return;
            }
            
            // Otherwise handle normal transfer
            tokenId =_sellingQueue[from_].popFront();
            emit QueueOperation("Getting from queue for transfer", tokenId);
            _removeFromOwned(from_, tokenId);
            delete _ownedData[tokenId];
        }

        // Set up recipient's data
        if (to_ != address(0) && !erc721TransferExempt(to_)) {
            uint256 index = _owned[to_].length;
            _owned[to_].push(tokenId);
            _setOwnerOf(tokenId, to_);
            _setOwnedIndex(tokenId, index);
            
            _addToSellingQueue(to_, tokenId);
        }

        emit ERC721Transfer(from_, to_, tokenId);
    }

    // ============ Internal Ownership Management ============
    function _addToOwned(address to_, uint256 tokenId_) internal {
        uint256 index = _owned[to_].length;
        _owned[to_].push(tokenId_);
        _setOwnerOf(tokenId_, to_);
        _setOwnedIndex(tokenId_, index);
    }

    // Add debug events
    event DebugRemoval(
        string message,
        uint256 tokenId,
        uint256 indexToRemove,
        uint256 lastIndex,
        uint256 lastTokenId
    );

    function _removeFromOwned(address from_, uint256 tokenId_) internal {
        // Get current index of token to remove
        uint256 indexToRemove = _getOwnedIndex(tokenId_);
        uint256 lastIndex = _owned[from_].length - 1;
        uint256 lastTokenId = _owned[from_][lastIndex];

        emit DebugRemoval(
            "Removing token",
            tokenId_,
            indexToRemove,
            lastIndex,
            lastTokenId
        );

        // If token to remove is not the last token
        if (indexToRemove != lastIndex) {
            emit DebugRemoval(
                "Moving last token",
                lastTokenId,
                indexToRemove,
                lastIndex,
                _owned[from_][indexToRemove]
            );
            // Move last token to the removed position
            _owned[from_][indexToRemove] = lastTokenId;
            // Update the moved token's index in _ownedData
            _setOwnedIndex(lastTokenId, indexToRemove);
        }

        // Remove last element from array
        _owned[from_].pop();
        
        // Clear removed token's data completely
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
        // Cache initial balances
        uint256 fromBalanceBefore = balanceOf[from_];
        uint256 toBalanceBefore = balanceOf[to_];

        // Perform ERC20 transfer
        _transferERC20(from_, to_, value_);

        // Calculate whole token changes for each party
        // Use floor division to only get whole tokens
        uint256 fromTokens = (fromBalanceBefore - balanceOf[from_]) / units;
        uint256 toTokens = (balanceOf[to_] - toBalanceBefore) / units;

        // Skip if no whole tokens are being transferred
        if (fromTokens == 0 && toTokens == 0) {
            return true;
        }

        // Cache exemption status
        bool isFromExempt = erc721TransferExempt(from_);
        bool isToExempt = erc721TransferExempt(to_);

        // Case 1: Both exempt - do nothing with NFTs
        if (isFromExempt && isToExempt) {
            return true;
        }

        // Case 2: Sender exempt, recipient not exempt - mint new NFTs
        if (isFromExempt && !isToExempt) {
            unchecked {
                for (uint256 i; i < toTokens; ++i) {
                    _mintERC721(to_);
                }
            }
            return true;
        }

        // Case 3: Sender not exempt, recipient exempt - burn NFTs from sender
        if (!isFromExempt && isToExempt) {
            unchecked {
                // Get the last 'fromTokens' number of tokens from the queue
                for (uint256 i; i < fromTokens; ++i) {
                    _withdrawAndBurnERC721(from_);
                }
            }
            return true;
        }

        // Case 4: Neither exempt - transfer NFTs from sender to recipient
        if (!isFromExempt && !isToExempt) {
            unchecked {
                for (uint256 i; i < fromTokens; ++i) {
                    _transferERC721(from_, to_);
                }
            }
            return true;
        }

        return true;
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

    // Add this function for initial minting
    function _initializeMint(address to_, uint256 value_) internal virtual {
        if (to_ == address(0)) revert InvalidRecipient();
        if (totalSupply + value_ > _maxTotalSupplyERC20) {
            revert MaxSupplyExceeded(totalSupply + value_, _maxTotalSupplyERC20);
        }
        
        totalSupply += value_;
        balanceOf[to_] += value_;
        
        emit Transfer(address(0), to_, value_);
    }

    // Queue management functions
    event QueueOperation(string operation, uint256 tokenId);

    function _addToSellingQueue(address owner_, uint256 tokenId_) internal {
        emit QueueOperation("Adding to queue", tokenId_);
        _sellingQueue[owner_].pushBack(tokenId_);
    }

    function getNextQueueId(address owner_) public view returns (uint256) {
        if (_sellingQueue[owner_].empty()) {
            return 0;
        }
        return _sellingQueue[owner_].front();
    }

    function getQueueLength(address owner_) public view virtual returns (uint256) {
        return _sellingQueue[owner_].size();
    }

    function getIdAtQueueIndex(
        address owner_,
        uint128 index_
    ) public view virtual returns (uint256) {
        return _sellingQueue[owner_].at(index_);
    }

    function _removeFromSellingQueue(address owner_, uint256 tokenId_) internal {
        _sellingQueue[owner_].removeById(tokenId_);
    }

    function getOwnedTokens(address owner_) public view returns (uint256[] memory) {
        return _owned[owner_];
    }

    // Add this public view function
    function getOwnedIndex(uint256 tokenId_) public view returns (uint256) {
        uint256 data = _ownedData[tokenId_];
        uint256 index;
        assembly {
            index := shr(160, data)
        }
        return index;
    }

    event Debug(string message, uint256 value);
} 