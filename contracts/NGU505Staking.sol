// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NGU505Base.sol";
import {INGU505Staking} from "./interfaces/INGU505Staking.sol";

abstract contract NGU505Staking is NGU505Base, INGU505Staking {

    // Add bitmask constants for staked token tracking
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    // State variables
    mapping(address => uint256[]) private _staked;
    mapping(uint256 => uint256) private _stakedData;
    mapping(address => uint256) public stakedERC20TokenBank;

    // Add missing internal functions for staked token management
    function _setStakedIndex(uint256 id_, uint256 index_) internal virtual {
        uint256 data = _stakedData[id_];
        if (index_ > _BITMASK_OWNED_INDEX >> 160) revert OwnedIndexOverflow();

        assembly {
            data := add(
                and(data, _BITMASK_ADDRESS),
                and(shl(160, index_), _BITMASK_OWNED_INDEX)
            )
        }
        _stakedData[id_] = data;
    }

    function _getStakedIndex(uint256 tokenId) internal view virtual returns (uint256 stakedIndex_) {
        uint256 data = _stakedData[tokenId];
        assembly {
            stakedIndex_ := shr(160, data)
        }
    }

    function _setStakedIdOwner(uint256 tokenId, address owner) internal virtual {
        uint256 data = _stakedData[tokenId];
        assembly {
            data := add(
                and(data, _BITMASK_OWNED_INDEX),
                and(owner, _BITMASK_ADDRESS)
            )
        }
        _stakedData[tokenId] = data;
    }

    function _getOwnerOfStakedId(uint256 tokenId) internal view virtual returns (address owner_) {
        uint256 data = _stakedData[tokenId];
        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    function stakeNFT(uint256 id_) public virtual override nonReentrant returns (bool) {
        if (msg.sender == address(0)) revert InvalidSender();
        if (erc721TransferExempt(msg.sender)) revert InvalidStakingExemption();
        if (balanceOf[msg.sender] < units) revert StakerInsufficientBalance(units, balanceOf[msg.sender]);
        // Check if the token is already staked
        if (_getOwnerOfStakedId(id_) != address(0)) {
            revert TokenAlreadyStaked(id_);
        }
        // ERC-20 Logic
        unchecked {
            balanceOf[msg.sender] -= units;
            stakedERC20TokenBank[msg.sender] += units;
        }

        // ERC-721 Logic
        // 1. Remove from selling queue
        _removeFromSellingQueue(msg.sender, id_);
        
        // 2. Add to staked array and update mappings
        uint256 index = _staked[msg.sender].length;
        _staked[msg.sender].push(id_);
        _setStakedIndex(id_, index);
        _setStakedIdOwner(id_, msg.sender);

        emit NFTStaked(msg.sender, id_);
        return true;
    }

    function unstakeNFT(uint256 id_) public virtual override nonReentrant returns (bool) {
        address owner = _getOwnerOfStakedId(id_);
        if (owner != msg.sender) revert NotTokenOwner();

        uint256 stakedBalance = stakedERC20TokenBank[msg.sender];
        if (stakedBalance < units) revert StakerInsufficientBalance(units, stakedBalance);

        // First add back to selling queue
        _addToSellingQueue(msg.sender, id_);
        
        // Then remove from staked array and clear mappings
        uint256 index = _getStakedIndex(id_);
        uint256[] storage stakedArray = _staked[msg.sender];
        uint256 lastIndex = stakedArray.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = stakedArray[lastIndex];
            stakedArray[index] = lastTokenId;
            _setStakedIndex(lastTokenId, index);
        }
        stakedArray.pop();
        delete _stakedData[id_];

        // Finally handle ERC20 transfers
        _setERC721TransferExempt(msg.sender, true);
        unchecked {
            stakedERC20TokenBank[msg.sender] -= units;
            balanceOf[msg.sender] += units;
        }
        _setERC721TransferExempt(msg.sender, false);

        emit NFTUnstaked(msg.sender, id_);
        return true;
    }

    function stakeMultipleNFTs(uint256[] calldata ids_) public virtual override nonReentrant returns (bool) {
        uint256 length = ids_.length;
        address sender = msg.sender;
        
        if (length == 0) revert EmptyStakingArray();
        
        // OPTIMIZATION: Calculate total amount and check balance once
        uint256 totalStakeAmount;
        unchecked {
            totalStakeAmount = length * units;  // Safe because length is bounded by array size
        }
        
        uint256 senderBalance = balanceOf[sender];
        if (senderBalance < totalStakeAmount) {
            revert StakerInsufficientBalance(totalStakeAmount, senderBalance);
        }

        // OPTIMIZATION: Cache staked array length once
        uint256 startingIndex = _staked[sender].length;

        // Process one token at a time - ERC20 and ERC721 together
        unchecked {
            for (uint256 i; i < length; ++i) {
                uint256 id = ids_[i];
                // Check if token is already staked by checking if _stakedData contains a non-zero value
                if (_stakedData[id] != 0) revert TokenAlreadyStaked(id);
                // Check ownership
                if (_getOwnerOf(id) != sender) revert NotTokenOwner();
                
                // Move ERC20 to bank for this specific token
                balanceOf[sender] -= units;
                stakedERC20TokenBank[sender] += units;

                // Remove from selling queue
                _removeFromSellingQueue(sender, id);

                // Add to staked array and update mappings in single operation
                _staked[sender].push(id);
                
                // Pack owner and index data in single storage write
                uint256 data;
                assembly {
                    data := add(
                        and(sender, _BITMASK_ADDRESS),
                        and(shl(160, add(startingIndex, i)), _BITMASK_OWNED_INDEX)
                    )
                }
                _stakedData[id] = data;
            }
        }

        emit BatchNFTStaked(sender, ids_);
        return true;
    }
    // Add this function with the other public view functions
    function getStakedERC20Balance(
        address owner_
    ) public view virtual override returns (uint256) {
        return stakedERC20TokenBank[owner_];
    }

    // Add this function to get all staked tokens for an address
    function getStakedTokens(
        address owner_
    ) public view virtual override returns (uint256[] memory) {
        return _staked[owner_];
    }

    // Add this function to handle removing staked tokens
    function removeStakedFromQueueById(address owner, uint256 tokenId) internal {
        // Input validation
        if (owner == address(0)) revert InvalidSender();
        if (tokenId == 0) revert InvalidTokenId();
        
        // Check if token exists first
        if (tokenId > minted) revert NotTokenOwner();
        
        // Then check ownership
        if (_getOwnerOf(tokenId) != owner) revert NotTokenOwner();
        
        // Check if already staked
        uint256 stakedData = _stakedData[tokenId];
        address stakedOwner;
        assembly {
            stakedOwner := and(stakedData, _BITMASK_ADDRESS)
        }
        if (stakedOwner != address(0)) {
            revert TokenAlreadyStaked(tokenId);
        }

        // Get next token from queue
        uint256 queuedToken = getNextQueueId(owner);
        // Only try to remove if there's a valid token (not 0)
        if (queuedToken != 0) {
            _removeFromSellingQueue(owner, tokenId);
        }

        // Add to staked array
        uint256 index = _staked[owner].length;
        if (index > type(uint96).max) revert OwnedIndexOverflow();

        _staked[owner].push(tokenId);
        _setStakedIndex(tokenId, index);
        _setStakedIdOwner(tokenId, owner);
    }

    /// @notice Get the total balance of an address including staked tokens
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function _totalBalanceOf(address owner_) internal view returns (uint256) {
        unchecked {
            // Safe to use unchecked since we're adding two uint256 values
            // that are each less than maxTotalSupplyERC20
            return balanceOf[owner_] + stakedERC20TokenBank[owner_];
        }
    }

    /// @notice External view function to get total balance
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function totalBalanceOf(address owner_) public view returns (uint256) {
        return _totalBalanceOf(owner_);
    }

} 