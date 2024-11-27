//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IPeripheryImmutableState} from "@uniswap/v3-periphery/contracts/interfaces/IPeripheryImmutableState.sol";
import {IERC404UniswapV3Exempt} from "../interfaces/IERC404UniswapV3Exempt.sol";
import {NGU505TokenManager} from "../NGU505TokenManager.sol";

abstract contract ERC404UniswapV3Exempt is NGU505TokenManager {
    error ERC404UniswapV3ExemptFactoryMismatch();
    error ERC404UniswapV3ExemptWETH9Mismatch();

    constructor(
        address uniswapV3Router_,
        address uniswapV3NonfungiblePositionManager_
    ) NGU505TokenManager() {
        _setERC721TransferExempt(uniswapV3Router_, true);
        _setERC721TransferExempt(uniswapV3NonfungiblePositionManager_, true);
    }
}