// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IERC404UniswapV3Exempt Interface
/// @notice Interface for managing Uniswap V3 exemptions in ERC404 tokens
/// @dev Extends IERC165 for interface detection
interface IERC404UniswapV3Exempt is IERC165 {
    /// @notice Thrown when factory addresses from router and position manager don't match
    error ERC404UniswapV3ExemptFactoryMismatch();
    /// @notice Thrown when WETH9 addresses from router and position manager don't match
    error ERC404UniswapV3ExemptWETH9Mismatch();

    /// @notice Sets the ERC721 transfer exemption status for an account
    /// @param account_ The address to set the exemption for
    /// @param value_ True to make exempt, false to remove exemption
    function setERC721TransferExempt(address account_, bool value_) external;

    /// @notice Checks if an address is exempt from ERC721 transfer restrictions
    /// @param target_ The address to check
    /// @return True if the address is exempt, false otherwise
    function erc721TransferExempt(address target_) external view returns (bool);
} 