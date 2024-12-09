// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";

contract MockNonfungiblePositionManager is IPeripheryImmutableState {
    address public immutable override factory;
    address public immutable override WETH9;

    constructor() {
        factory = address(this);
        WETH9 = address(this);
    }
} 