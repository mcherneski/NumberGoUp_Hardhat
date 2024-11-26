// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INGU505Base {
    // Additional Base-specific functions
    function getOwnerOfId(uint256 id_) external view returns (address);
    function erc20TotalSupply() external view returns (uint256);
    function erc721TotalSupply() external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address owner) external view returns (uint256);
} 