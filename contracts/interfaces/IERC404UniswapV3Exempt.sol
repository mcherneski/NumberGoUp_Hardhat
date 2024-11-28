// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC404UniswapV3Exempt is IERC165 {
    error ERC404UniswapV3ExemptFactoryMismatch();
    error ERC404UniswapV3ExemptWETH9Mismatch();

    function setERC721TransferExempt(address account_, bool value_) external;
    function erc721TransferExempt(address target_) external view returns (bool);
} 