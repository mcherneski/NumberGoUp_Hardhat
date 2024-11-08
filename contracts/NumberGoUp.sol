//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {NGU404} from "./NGU404.sol";
import {ERC404UniswapV3Exempt} from "./extensions/ERC404UniswapV3Exempt.sol";
/// @notice - I commented out the ERC404UniswapV3Exempt extension because it's not working with local tests. 
/// the contract should inherit from the ERC404UniswapV3Exempt extension in the future.
// ERC404UniswapV3Exempt
contract NumberGoUp is Ownable, NGU404, ERC404UniswapV3Exempt {
    string public _uriBase = "https://ipfs.io/ipfs/QmUMUSjDwvMqgbPneHnvpQAt8cEBDEDgDZUyYM93qazLga/";
    uint256 public constant variants = 5;
    using Strings for uint256;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxTotalSupplyERC20_,
        address initialOwner_,
        address initialMintRecipient_,
        address uniswapSwapRouter_,
        address uniswapV3NonfungiblePositionManager_
    )
        NGU404(name_, symbol_, decimals_)
        Ownable(initialOwner_)
        ERC404UniswapV3Exempt(
            uniswapSwapRouter_,
            uniswapV3NonfungiblePositionManager_
        )
    {
        // Do not mint 721s to initial owner
        _setERC721TransferExempt(initialMintRecipient_, true);
        _mintERC20(initialMintRecipient_, maxTotalSupplyERC20_ * units);
    }
    function tokenURI(
        uint256 id
    ) public view virtual override returns (string memory) {
        uint256 v = (uint256(keccak256(abi.encode(id))) % 1000);
        uint256 d;
        if (v < 29) {
            // Rarity 1: 3%
            d = 1;
        } else if (v < 127) {
            // Rarity 2: 9.7%
            d = 2;
        } else if (v < 282) {
            // Rarity 3: 15.5%
            d = 3;
        } else if (v < 531) {
            // Rarity 4: 24.9%
            d = 4;
        } else {
            // Rarity 5: 46.9%
            d = 5;
        }
        // Cache the result of d.toString() to save gas
        string memory dString = d.toString();
        return string(abi.encodePacked(_uriBase, dString, ".json"));
    }

    function setERC721TransferExempt(
        address account_,
        bool value_
    ) external onlyOwner {
        _setERC721TransferExempt(account_, value_);
    }
}
