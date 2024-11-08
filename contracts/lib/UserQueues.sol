// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DoubleEndedQueue.sol";
/// @notice A library for managing user FIFO queues of NFTs
/// When an ERC721 token ID is staked, it is removed from the user's queue.

library NFTUserQueueLib {
    using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

    struct NFTInfo {
        uint256 id;
        uint8 rarity;
        bool isStaked;
    }

    struct UserQueue {
        DoubleEndedQueue.Uint256Deque queue;
        mapping(uint256 => NFTInfo) nftInfo;
        mapping(uint128 => uint128) position;
    }

    // Dequeue an item from the front of the user's queue
    function dequeueFront(UserQueue storage userQueue) internal returns (NFTInfo memory) {
        uint256 id = userQueue.queue.popFront();
        NFTInfo memory info = userQueue.nftInfo[id];
        delete userQueue.nftInfo[id];
        return info;
    }

    // Peek at the front item of the user's queue
    function peekFront(UserQueue storage userQueue) internal view returns (NFTInfo memory) {
        uint256 id = userQueue.queue.front();
        return userQueue.nftInfo[id];
    }

    // // Peek at the back item of the user's queue
    // function peekBack(UserQueue storage userQueue) internal view returns (NFTInfo memory) {
    //     uint256 id = userQueue.queue.back();
    //     return userQueue.nftInfo[id];
    // }

    /// @dev Function to check if an NFT is in the queue
    function isInQueue(UserQueue storage userQueue, uint256 id) internal view returns (bool) {
        return userQueue.nftInfo[id].id != 0;
    }

    /// @dev Check if the user's queue is empty
    function isEmpty(UserQueue storage userQueue) internal view returns (bool) {
        return userQueue.queue.length() == 0;
    }

    // /// @dev Remove a specific NFT ID from user's queue
    // function removeIDFromQueue(UserQueue storage userQueue, uint128 id) internal returns (bool) {
    //     if (!isInQueue(userQueue, id)) {
    //         return false;
    //     }

    //     uint256 position = userQueue.position[id];
    //     uint256 lastIndex = userQueue.queue.length() -1;

    //     if (position != lastIndex) {
    //         uint256 lastId = userQueue.queue.at(lastIndex);
    //         userQueue.queue.set(position, lastId);
    //         userQueue.position[lastId] = position;
    //     }

    //     userQueue.queue.popBack();
    //     delete userQueue.nftInfo[id];
    //     delete userQueue.position[id];
    // }


}