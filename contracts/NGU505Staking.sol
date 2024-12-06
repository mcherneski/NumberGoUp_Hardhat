// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NGU505Base.sol";
import {INGU505Staking} from "./interfaces/INGU505Staking.sol";
import {DoubleEndedQueue} from "./lib/DoubleEndedQueue.sol";

abstract contract NGU505Staking is NGU505Base, INGU505Staking {
    using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

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

    uint256 private constant MAX_BATCH_SIZE = 100;

    function stake(uint256[] calldata ids_) public virtual override nonReentrant returns (bool) {
        uint256 length = ids_.length;
        address sender = msg.sender;
        
        if (length == 0) revert EmptyStakingArray();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        if (sender == address(0)) revert InvalidSender();
        if (erc721TransferExempt(sender)) revert InvalidStakingExemption();
        
        // Calculate total amount and check balance once
        uint256 totalStakeAmount = length * units;
        uint256 senderBalance = balanceOf[sender];
        if (senderBalance < totalStakeAmount) {
            revert StakerInsufficientBalance(totalStakeAmount, senderBalance);
        }

        // Process tokens
        unchecked {
            for (uint256 i; i < length; ++i) {
                uint256 id = ids_[i];
                // Validate token
                if (_stakedData[id] != 0) revert TokenAlreadyStaked(id);
                if (_getOwnerOf(id) != sender) revert NotTokenOwner();
                if (id == 0) revert TokenNotFound();
                
                // Handle ERC20 balance changes
                balanceOf[sender] -= units;
                stakedERC20TokenBank[sender] += units;

                // Remove from selling queue
                if (_sellingQueue[sender].empty()) revert QueueEmpty();
                _sellingQueue[sender].removeById(id);

                // Add to staked array and update mappings
                _staked[sender].push(id);
                uint256 data;
                assembly {
                    data := add(
                        and(sender, _BITMASK_ADDRESS),
                        and(shl(160, i), _BITMASK_OWNED_INDEX)
                    )
                }
                _stakedData[id] = data;
            }
        }

        emit Staked(sender, ids_);
        return true;
    }

    function unstake(uint256[] calldata ids_) public virtual override nonReentrant returns (bool) {
        uint256 length = ids_.length;
        address sender = msg.sender;
        
        if (length == 0) revert EmptyStakingArray();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        
        uint256 totalUnstakeAmount = length * units;
        uint256 stakedBalance = stakedERC20TokenBank[sender];
        if (stakedBalance < totalUnstakeAmount) {
            revert StakerInsufficientBalance(totalUnstakeAmount, stakedBalance);
        }

        unchecked {
            for (uint256 i; i < length; ++i) {
                uint256 id = ids_[i];
                if (_getOwnerOfStakedId(id) != sender) revert NotTokenOwner();

                uint256 index = _getStakedIndex(id);
                uint256[] storage stakedArray = _staked[sender];
                uint256 lastIndex = stakedArray.length - 1;

                if (index != lastIndex) {
                    uint256 lastTokenId = stakedArray[lastIndex];
                    stakedArray[index] = lastTokenId;
                    _setStakedIndex(lastTokenId, index);
                }
                stakedArray.pop();
                delete _stakedData[id];

                // Add to selling queue
                if (id != 0) {
                    _sellingQueue[sender].pushBack(id);
                }
                
                stakedERC20TokenBank[sender] -= units;
                balanceOf[sender] += units;
            }
        }

        emit Unstaked(sender, ids_);
        return true;
    }

    function getStakedERC20Balance(
        address owner_
    ) public view virtual override returns (uint256) {
        return stakedERC20TokenBank[owner_];
    }

    function getStakedTokens(
        address owner_
    ) public view virtual override returns (uint256[] memory) {
        return _staked[owner_];
    }

    /// @notice Get the total balance of an address including staked tokens
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function totalBalanceOf(address owner_) public view returns (uint256) {
        unchecked {
            // Safe to use unchecked since we're adding two uint256 values
            // that are each less than maxTotalSupplyERC20
            return balanceOf[owner_] + stakedERC20TokenBank[owner_];
        }
    }

} 