//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404UniswapV3Exempt} from "./extensions/ERC404UniswapV3Exempt.sol";
import {NGU505Base} from "./NGU505Base.sol";

// Modify metadata to add more attributes? Generate in contract?


/// @title NumberGoUp Token Contract
/// @notice Implementation of the NGU token with ERC404, staking, and Uniswap V3 integration
/// @dev Extends NGU505Staking and ERC404UniswapV3Exempt for full functionality
contract NeverSkipLegDay is Ownable, NGU505Base, ERC404UniswapV3Exempt {
    /// @notice Base URI for token metadata
    string public _uriBase = "https://ipfs.io/ipfs/QmUMUSjDwvMqgbPneHnvpQAt8cEBDEDgDZUyYM93qazLga/";
    
    /// @notice Number of different token variants
    uint256 public constant variants = 5;
    
    using Strings for uint256;

    /// @notice Emitted when the base URI is updated
    /// @param newBase The new base URI
    event URIBaseUpdated(string newBase);

    /// @notice Initializes the NumberGoUp token with its core parameters
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param decimals_ Number of decimals for ERC20 functionality
    /// @param maxTotalSupplyERC20_ Maximum total supply of ERC20 tokens
    /// @param initialOwner_ Address of the initial contract owner
    /// @param initialMintRecipient_ Address to receive the initial token mint
    /// @param uniswapSwapRouter_ Address of the Uniswap V3 router
    /// @param uniswapV3NonfungiblePositionManager_ Address of the Uniswap V3 position manager
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
        Ownable(initialOwner_)
        ERC404UniswapV3Exempt(
            uniswapSwapRouter_,
            uniswapV3NonfungiblePositionManager_
        )
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner_);
        _grantRole(EXEMPTION_MANAGER_ROLE, initialOwner_);
        _setERC721TransferExempt(initialMintRecipient_, true);
        _mintERC20(initialMintRecipient_, maxTotalSupplyERC20_ * units);
    }

    /// @notice Returns the metadata URI for a specific token ID
    /// @dev Implements rarity tiers based on token ID
    /// @param id The token ID to get the URI for
    /// @return The metadata URI string

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

    /// @notice Updates the base URI for token metadata
    /// @dev Only callable by contract owner
    /// @param newBase_ The new base URI to set
    function setURIBase(string calldata newBase_) external onlyOwner {
        _uriBase = newBase_;
        emit URIBaseUpdated(newBase_);
    }
}
