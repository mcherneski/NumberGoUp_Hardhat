// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {INGU505Base} from "./interfaces/INGU505Base.sol";
import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract NGU505Base is INGU505Base, ReentrancyGuard, AccessControl {
    bytes32 public constant EXEMPTION_MANAGER_ROLE = keccak256("EXEMPTION_MANAGER_ROLE");

    // Core state variables - packed for gas optimization
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
    mapping(address => uint256) public nonces;

    mapping(address => uint256) public balanceOf;
    
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) internal _erc721TransferExempt;

    mapping(address => uint256[]) public _owned;
    mapping(uint256 => uint256) internal _ownedData;
    
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    // NFT ID tracking 1.7369×10^78 Possible NFT IDs. 
    uint256 private constant ID_OFFSET = 252; // Reserve top 4 bits for series
    uint256 internal _currentSeries; // Current hex prefix (0-15)
    uint256 private _currentPrefix;  // Current ID within series

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

        // Setup initial roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EXEMPTION_MANAGER_ROLE, msg.sender);
        _setERC721TransferExempt(msg.sender, true);
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
        
        // NFT transfers are only allowed through ERC20 transfers
        if (_isNFTID(value_)) {
            revert InvalidTransfer();  // Direct NFT transfers not allowed
        }

        // Handle ERC20 transfer which will automatically handle NFT
        return _transferERC20WithERC721(msg.sender, to_, value_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) public virtual override nonReentrant returns (bool) {
        if (from_ == address(0)) revert InvalidSender();
        if (to_ == address(0)) revert InvalidRecipient();

        // NFT transfers are only allowed through ERC20 transfers
        if (_isNFTID(value_)) {
            revert InvalidTransfer();  // Direct NFT transfers not allowed
        }

        // Check allowance for ERC20 transfer
        uint256 allowed = allowance[from_][msg.sender];
        if (allowed < value_) revert InsufficientAllowance(value_, allowed);

        if (allowed != type(uint256).max) {
            allowance[from_][msg.sender] = allowed - value_;
        }

        // Handle ERC20 transfer which will automatically handle NFT
        return _transferERC20WithERC721(from_, to_, value_);
    }

    function approve(
        address spender_,
        uint256 value_
    ) public virtual override nonReentrant returns (bool) {
        if (spender_ == address(0)) revert InvalidSpender();
        
        allowance[msg.sender][spender_] = value_;
        emit Approval(msg.sender, spender_, value_);
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

    function _mintERC721(address to_) internal virtual returns (uint256) {
        unchecked {
            // If we've reached max ID in current series
            if (_currentPrefix == type(uint256).max >> 4) {
                _currentPrefix = 0;  // Reset ID
                
                // Handle series increment in hex order (0-9, then A-F)
                if (_currentSeries == 0xF) revert MaxNFTsReached();  // All series exhausted
                
                // If current series is 9, jump to A (hex)
                if (_currentSeries == 0x9) {
                    _currentSeries = 0xA;
                } else {
                    _currentSeries++;
                }
            }
            
            // Create NFT ID: combine series prefix with current ID
            uint256 nftId = (_currentSeries << (256 - 4)) | _currentPrefix;
            _currentPrefix++;

            // Set up ownership
            _addToOwned(to_, nftId);

            emit ERC721Minted(to_, nftId);
            return nftId;
        }
    }

    function _setERC721TransferExempt(address account_, bool value_) internal virtual {
        if (account_ == address(0)) revert InvalidExemption();

        if (_erc721TransferExempt[account_] != value_) {
            if (value_ == true) {
                _clearERC721Balance(account_);
            } else {
                _reinstateERC721Balance(account_);
            }
        }
        _erc721TransferExempt[account_] = value_;
        emit ERC721TransferExemptSet(account_, value_);
    }

    // ============ Internal Transfer Functions ============
    function _transferERC20(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual {
        // Minting is a special case for which we should not check the balance of
        // the sender, and we should increase the total supply.
        if (from_ == address(0)) {
        totalSupply += value_;
        } else {
        // Deduct value from sender's balance.
        balanceOf[from_] -= value_;
        }

        // Update the recipient's balance.
        // Can be unchecked because on mint, adding to totalSupply is checked, and on transfer balance deduction is checked.
        unchecked {
        balanceOf[to_] += value_;
        }

            emit ERC20Events.Transfer(from_, to_, value_);
        }

    function _withdrawAndBurnERC721(address from_) internal virtual {
        uint256 tokenId = _owned[from_][0];
        // Clean up ownership data
        _removeFromOwnedById(from_, tokenId);
        delete _ownedData[tokenId];

        emit ERC721Events.Burn(from_, tokenId);
    }

    function _transferERC721(
        address from_,
        address to_,
        uint256 tokenId_
    ) internal virtual {
        // Check ownership
        if (from_ != address(0)) {
            delete getApproved[tokenId_];
        }

        _removeFromOwnedById(from_, tokenId_);
        _addToOwned(to_, tokenId_);

        emit ERC721Events.Transfer(from_, to_, tokenId_);
    }

    // ============ Internal Ownership Management ============
    function _addToOwned(address to_, uint256 tokenId_) internal {
        uint256 index = _owned[to_].length;
        _owned[to_].push(tokenId_);
        _setOwnerOf(tokenId_, to_);
        _setOwnedIndex(tokenId_, index);
    }

    function _removeFromOwnedById(address from_, uint256 tokenId_) internal {
        // Get current index of token to remove
        uint256 indexToRemove = getOwnedIndex(tokenId_);
        uint256 lastIndex = _owned[from_].length - 1;
        uint256 lastTokenId = _owned[from_][lastIndex];

        // If token to remove is not the last token
        if (indexToRemove != lastIndex) {
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

    function _removeFromOwnedByIndex(address owner, uint256 index) internal returns (uint256) {
        uint256[] storage ownerTokens = _owned[owner];
        uint256 lastTokenIndex = ownerTokens.length - 1;
        
        if (index != lastTokenIndex) {
            // Move the last token to the index being removed
            uint256 lastTokenId = ownerTokens[lastTokenIndex];
            ownerTokens[index] = lastTokenId;
            _setOwnedIndex(lastTokenId, index);
        }
        
        // Remove the last element
        uint256 id = ownerTokens[ownerTokens.length - 1];
        ownerTokens.pop();
        delete _ownedData[id];
        return id;
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

    function getOwnedIndex(uint256 tokenId_) public view returns (uint256 index_) {
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
        // Cache balances before transfer
        uint256 fromBalanceBefore = balanceOf[from_];
        uint256 toBalanceBefore = balanceOf[to_];

        // Cache exemption status
        bool isFromExempt = erc721TransferExempt(from_);
        bool isToExempt = erc721TransferExempt(to_);

        // Perform ERC20 transfer
        _transferERC20(from_, to_, value_);

        // Case 1: Both exempt - no NFT operations needed
        if (isFromExempt && isToExempt) {
            return true;
        }
        // Calculate whole tokens being transferred
        uint256 wholeTokensTransferred = value_ / units;
        
        // Case 2: Sender exempt, receiver not exempt - mint NFTs to receiver if needed
        if (isFromExempt) {
            uint256 tokensToMint = (balanceOf[to_] / units) - (toBalanceBefore / units);
            // Mint any needed NFTs to receiver
            for (uint256 i = 0; i < tokensToMint;) {
                _mintERC721(to_);
                unchecked {
                    i++;
                }
            }
        }

        // Case 3: Sender not exempt, receiver exempt - burn sender's NFTs if needed
        if (isToExempt) {
            uint256 senderNFTsToRemove = (fromBalanceBefore / units) - (balanceOf[from_] / units);
            
            // Remove required NFTs from sender
            for (uint256 i = 0; i < senderNFTsToRemove;) {
                _removeFromOwnedByIndex(from_, 0);
                unchecked {
                    i++;
                }
            }
        }
        // Case 4: Neither exempt - handle both whole token transfers and fractional changes
        if (!isFromExempt && !isToExempt) {
            // First handle whole token transfers
            uint256 wholeTokens = value_ / units; 
            for (uint256 i = 0; i < wholeTokens;) {
                uint256 tokenId = _owned[from_][0];
                _transferERC721(from_, to_, tokenId);
                unchecked {
                    i++;
                }
            }

            // Then handle fractional changes that might cause additional NFT changes
            uint256 senderBalanceAfter = balanceOf[from_];
            uint256 receiverBalanceAfter = balanceOf[to_];

            // Check if sender lost an additional NFT due to remaining fraction being too small
            if ((fromBalanceBefore / units) - (senderBalanceAfter / units) > wholeTokensTransferred) {
                _removeFromOwnedByIndex(from_, 0);
                
                // Check if recipient needs this NFT due to their new balance
                if ((receiverBalanceAfter / units) > (toBalanceBefore / units) + wholeTokensTransferred) {
                    // Transfer the NFT if recipient needs it
                    uint256 token = _mintERC721(to_);
                    _addToOwned(to_, token);
                    
                }
            }
            // If receiver needs a new NFT and we haven't transferred one from sender
            else if ((receiverBalanceAfter / units) > (toBalanceBefore / units + wholeTokensTransferred)) {
                _mintERC721(to_);
                
            }
        }

        return true;
    }

    // ============ EIP-2612 Functions ============
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
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
    ) public virtual override nonReentrant {
        if (deadline < block.timestamp) revert PermitDeadlineExpired();
        // Prevent using permit for NFT approvals
        if (_isNFTID(value)) revert InvalidApproval();
        if (spender == address(0)) revert InvalidSpender();

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
    ) public view virtual override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(INGU505Base).interfaceId ||
               interfaceId == type(IERC165).interfaceId;
    }

    /// @dev Sets ERC721 transfer exemption status using AccessControl
    /// @dev Only callable by addresses with EXEMPTION_MANAGER_ROLE
    /// @dev Updates internal _erc721TransferExempt mapping
    function setERC721TransferExempt(address account_, bool value_) external virtual override nonReentrant onlyRole(EXEMPTION_MANAGER_ROLE) {
        _setERC721TransferExempt(account_, value_);
    }

    /// @dev Grants EXEMPTION_MANAGER_ROLE using OpenZeppelin AccessControl
    /// @dev Only callable by DEFAULT_ADMIN_ROLE
    /// @dev Emits ExemptionManagerAdded event
    function addExemptionManager(address account_) external virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(EXEMPTION_MANAGER_ROLE, account_);
        emit ExemptionManagerAdded(account_);
    }

    /// @dev Revokes EXEMPTION_MANAGER_ROLE using OpenZeppelin AccessControl
    /// @dev Only callable by DEFAULT_ADMIN_ROLE
    /// @dev Emits ExemptionManagerRemoved event
    function removeExemptionManager(address account_) external virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(EXEMPTION_MANAGER_ROLE, account_);
        emit ExemptionManagerRemoved(account_);
    }

    /// @dev Checks if address has EXEMPTION_MANAGER_ROLE using OpenZeppelin AccessControl
    function isExemptionManager(address account_) external view virtual returns (bool) {
        return hasRole(EXEMPTION_MANAGER_ROLE, account_);
    }

    // Helper functions for NFT ID management
    function _isNFTID(uint256 value_) internal pure returns (bool) {
        // An NFT ID must have:
        // 1. A series value in the top 4 bits (0-15)
        // 2. All other bits must be 0 except for the ID portion
        uint256 topBits = value_ >> (256 - 4);  // Get series bits
        uint256 idPart = value_ & ((1 << (256 - 4)) - 1);  // Get ID portion
        
        // For a value to be an NFT ID:
        // 1. The top bits must be a valid series (0-15)
        // 2. The ID part must be non-zero (we never mint ID 0)
        // 3. The ID part must be a single contiguous number (no gaps in binary representation)
        return topBits <= 0xF && 
               idPart > 0 && 
               idPart <= type(uint256).max >> 4 &&
               (idPart & (idPart - 1)) == 0;  // Power of 2 check to ensure no gaps
    }

    function _extractSeries(uint256 nftId_) internal pure returns (uint256) {
        return nftId_ >> (256 - 4);  // Get top 4 bits
    }

    function _extractTokenID(uint256 nftId_) internal pure returns (uint256) {
        return nftId_ & ((1 << (256 - 4)) - 1);  // Get everything except top 4 bits
    }

    // Error for when all NFT series are exhausted
    error MaxNFTsReached();

    /// @notice Function to reinstate NFT balance when removing exemption
    function _reinstateERC721Balance(address target_) internal {
        uint256 expectedERC721Balance = balanceOf[target_] / units;
        uint256 actualERC721Balance = erc721BalanceOf(target_);

        // Mint any missing NFTs to match ERC20 balance
        for (uint256 i = 0; i < expectedERC721Balance - actualERC721Balance; i++) {
            _mintERC721(target_);
        }
    }

    /// @notice Function to clear NFT balance when adding exemption
    function _clearERC721Balance(address target_) internal {
        uint256 erc721Balance = erc721BalanceOf(target_);

        // Burn all NFTs when becoming exempt
        for (uint256 i = 0; i < erc721Balance; i++) {
            _withdrawAndBurnERC721(target_);
        }
    }

    /// @notice Get all tokens owned by an address
    /// @param owner The address to check
    /// @return Array of token IDs owned by the address
    function getOwnedTokens(address owner) public view returns (uint256[] memory) {
        return _owned[owner];
    }
} 