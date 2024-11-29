//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404UniswapV3Exempt} from "./extensions/ERC404UniswapV3Exempt.sol";
import {NGU505Staking} from "./NGU505Staking.sol";
import {NGU505Base} from "./NGU505Base.sol";

contract NumberGoUp is NGU505Staking, ERC404UniswapV3Exempt, Ownable {
    string public _uriBase = "https://ipfs.io/ipfs/QmUMUSjDwvMqgbPneHnvpQAt8cEBDEDgDZUyYM93qazLga/";
    uint256 public constant variants = 5;
    using Strings for uint256;

    event URIBaseUpdated(string newBase);

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
        NGU505Base(name_, symbol_, decimals_, maxTotalSupplyERC20_)
        ERC404UniswapV3Exempt(
            uniswapSwapRouter_,
            uniswapV3NonfungiblePositionManager_
        )
        Ownable(initialOwner_)
    {
        _setERC721TransferExempt(initialMintRecipient_, true);
        _mintERC20(initialMintRecipient_, maxTotalSupplyERC20_ * units);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        if (_getOwnerOf(id) == address(0)) revert InvalidTokenId();
        
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
        string memory dString = d.toString();
        return string(abi.encodePacked(_uriBase, dString, ".json"));
    }

    function setURIBase(string memory newBase_) external onlyOwner {
        _uriBase = newBase_;
        emit URIBaseUpdated(newBase_);
    }
}
