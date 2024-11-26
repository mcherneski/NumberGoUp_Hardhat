// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC404UniswapV3Exempt is IERC165 {
    // Errors
    error ERC404UniswapV3ExemptFactoryMismatch();
    error ERC404UniswapV3ExemptWETH9Mismatch();

    // Events
    event UniswapV3PairExempted(address indexed pair, bool status);
    event UniswapV3RouterSet(address indexed router);
    event UniswapV3PositionManagerSet(address indexed positionManager);
} 