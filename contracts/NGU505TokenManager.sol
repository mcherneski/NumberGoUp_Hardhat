// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NGU505Base.sol";
import "./interfaces/INGU505TokenManager.sol";
import {DoubleEndedQueue} from "./lib/DoubleEndedQueue.sol";

abstract contract NGU505TokenManager is NGU505Base, INGU505TokenManager {
    using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

    // State variables
    mapping(address => uint256[]) private _staked;
    mapping(uint256 => uint256) private _stakedData;
    mapping(address => uint256) public stakedERC20TokenBank;
    mapping(address => DoubleEndedQueue.Uint256Deque) private _sellingQueue;


    // Bitmask constants
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    // Queue Management Functions
    function getERC721TokensInQueue(
        address owner_,
        uint256 count_
    ) public view virtual override returns (uint256[] memory) {
        if (_sellingQueue[owner_].empty()) {
            revert QueueEmpty();
        }

        uint256 queueLength = _sellingQueue[owner_].size();
        uint256 count = queueLength < count_ ? queueLength : count_;
        uint256[] memory tokensInQueue = new uint256[](count);
        
        for (uint256 i = 0; i < count; ) {
            tokensInQueue[i] = _sellingQueue[owner_].at(i);
            unchecked {
                ++i;
            }
        }

        return tokensInQueue;
    }

    function getIdAtQueueIndex(
        address owner_,
        uint128 index_
    ) public view virtual override returns (uint256) {
        return _sellingQueue[owner_].at(index_);
    }

    function getNextQueueId(
        address owner_
    ) public view virtual override returns (uint256) {
        if (_sellingQueue[owner_].empty()) revert QueueEmpty();
        return _sellingQueue[owner_].front();
    }

    function getQueueLength(
        address owner_
    ) public view virtual override returns (uint256) {
        return _sellingQueue[owner_].size();
    }

    // Staking Functions
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

    function stakeNFT(uint256 id_) public virtual override nonReentrant returns (bool) {
        if (_getOwnerOf(id_) != msg.sender) revert NotTokenOwner();
        if (msg.sender == address(0)) revert InvalidSender();
        if (erc721TransferExempt(msg.sender)) revert InvalidStakingExemption();
        if (balanceOf[msg.sender] < units) revert InsufficientBalance();

        // ERC-20 Logic
        unchecked {
            balanceOf[msg.sender] -= units;
            stakedERC20TokenBank[msg.sender] += units;
        }

        // ERC-721 Logic
        removeItemFromQueueById(msg.sender, id_);
        _staked[msg.sender].push(id_);
        _setStakedIndex(id_, _staked[msg.sender].length - 1);
        _setStakedIdOwner(id_, msg.sender);

        emit NFTStaked(msg.sender, id_);
        return true;
    }

    function unstakeNFT(uint256 id_) public virtual override nonReentrant returns (bool) {
        address owner = _getOwnerOfStakedId(id_);
        if (owner != msg.sender) revert NotTokenOwner();

        uint256 stakedBalance = stakedERC20TokenBank[msg.sender];
        if (stakedBalance < units) revert InsufficientBalance();

        // ERC-20 Logic
        _setERC721TransferExempt(msg.sender, true);
        unchecked {
            stakedERC20TokenBank[msg.sender] -= units;
            balanceOf[msg.sender] += units;
        }
        _setERC721TransferExempt(msg.sender, false);

        // ERC-721 Logic
        _sellingQueue[msg.sender].pushBack(id_);
        removeStakedFromQueueById(msg.sender, id_);
        delete _stakedData[id_];

        emit NFTUnstaked(msg.sender, id_);
        return true;
    }

    function stakeMultipleNFTs(
        uint256[] calldata ids_
    ) public virtual override nonReentrant returns (bool) {
        uint256 length = ids_.length;
        if (length == 0) revert EmptyStakingArray();
        
        uint256 totalStakeAmount = length * units;
        if (balanceOf[msg.sender] < totalStakeAmount) revert InsufficientBalance();

        for (uint256 i = 0; i < length;) {
            if (_getOwnerOf(ids_[i]) != msg.sender) revert NotTokenOwner();
            stakeNFT(ids_[i]);
            unchecked { ++i; }
        }

        emit BatchNFTStaked(msg.sender, ids_);
        return true;
    }

    // Internal Helper Functions
    function _withdrawAndBurnERC721(address from_) internal virtual override {
        if (from_ == address(0)) {
            revert InvalidSender();
        }

        if (_sellingQueue[from_].empty()) {
            revert QueueEmpty();
        }

        uint256 tokenId = _sellingQueue[from_].popFront();
        _transferERC721(from_, address(0), tokenId);
    }

    function removeItemFromQueueById(address owner_, uint256 id_) internal {
        _sellingQueue[owner_].removeById(id_);
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

    function _getStakedIndex(uint256 tokenId) internal view virtual returns (uint256 stakedIndex_) {
        uint256 data = _stakedData[tokenId];
        assembly {
            stakedIndex_ := shr(160, data)
        }
    }

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

    function removeStakedFromQueueById(address owner, uint256 tokenId) internal {
        uint256 index = _getStakedIndex(tokenId);
        uint256[] storage stakedArray = _staked[owner];
        uint256 lastIndex = stakedArray.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = stakedArray[lastIndex];
            stakedArray[index] = lastTokenId;
            _setStakedIndex(lastTokenId, index);
        }

        stakedArray.pop();
        delete _stakedData[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(NGU505Base) returns (bool) {
        return super.supportsInterface(interfaceId) ||
            interfaceId == type(INGU505TokenManager).interfaceId;
    }
} 