// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {INGU505Staking} from "./interfaces/INGU505Staking.sol";
import {NotGonnaMakeIt} from "./NumberGoUp.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";

/// @title NGU Staking Contract
/// @notice External staking contract for NumberGoUp NFTs
contract NGUStaking is INGU505Staking, ReentrancyGuard, Ownable, IERC721Receiver {
    /// @notice The NumberGoUp token contract
    NotGonnaMakeIt public immutable nguToken;

    /// @notice Mapping of user address to their staked token IDs
    mapping(address => uint256[]) private _stakedTokens;

    /// @notice Mapping of token ID to packed staking data (address + index)
    /// @dev Format: [160 bits for address][96 bits for index]
    mapping(uint256 => uint256) private _stakedData;

    /// @notice Mapping of user address to their staked ERC20 balance
    mapping(address => uint256) private _stakedBalance;

    /// @notice Bit masks for packed data
    uint256 private constant _BITMASK_OWNER = (1 << 160) - 1;
    uint256 private constant _BITMASK_INDEX = ((1 << 96) - 1) << 160;

    constructor(address nguToken_, address initialOwner_) Ownable(initialOwner_) {
        nguToken = NotGonnaMakeIt(nguToken_);
    }

    function getStakedOwner(uint256 tokenId_) public view returns (address owner_) {
        uint256 data = _stakedData[tokenId_];
        assembly {
            owner_ := and(data, _BITMASK_OWNER)
        }
    }

    function getStakedIndex(uint256 tokenId_) public view returns (uint256 index_) {
        uint256 data = _stakedData[tokenId_];
        assembly {
            index_ := shr(160, data)
        }
    }

    function _setStakedData(uint256 tokenId_, address owner_, uint256 index_) internal {
        if (index_ > type(uint96).max) revert IndexOverflow();
        uint256 data;
        assembly {
            data := add(
                and(owner_, _BITMASK_OWNER),
                shl(160, index_)
            )
        }
        _stakedData[tokenId_] = data;
    }

    function stake(uint256[] calldata ids_) external nonReentrant returns (bool) {
        uint256 length = ids_.length;
        if (length == 0) revert EmptyStakingArray();
        if (nguToken.erc721TransferExempt(msg.sender)) revert InvalidStakingExemption();
        if (nguToken.erc721TransferExempt(address(this))) revert InvalidStakingExemption();
        
        uint256 totalValue = nguToken.units() * length;
        uint256 balance = nguToken.balanceOf(msg.sender);
        if (balance < totalValue) revert StakerInsufficientBalance(totalValue, balance);

        uint256 successfulStakes = 0;
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = ids_[i];
            if (getStakedOwner(tokenId) != address(0)) revert TokenAlreadyStaked(tokenId);
            if (nguToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

            nguToken.erc721TransferFrom(msg.sender, address(this), tokenId);

            uint256 newIndex = _stakedTokens[msg.sender].length;
            _stakedTokens[msg.sender].push(tokenId);
            _setStakedData(tokenId, msg.sender, newIndex);
            unchecked { successfulStakes++; }
            unchecked { i++; }
            emit Staked(msg.sender, tokenId, _extractTokenID(tokenId));
        }

        _stakedBalance[msg.sender] += successfulStakes * nguToken.units();
        
        return true;
    }

    function unstake(uint256[] calldata ids_) external nonReentrant returns (bool) {
        uint256 length = ids_.length;
        if (length == 0) revert EmptyStakingArray();

        uint256 successfulUnstakes = 0;
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = ids_[i];
            
            address stakedOwner = getStakedOwner(tokenId);  
            if (stakedOwner == address(0)) revert TokenNotStaked(tokenId);
            if (stakedOwner != msg.sender) revert NotTokenOwner();

            _removeStakedToken(msg.sender, tokenId);
            delete _stakedData[tokenId];
            nguToken.erc721TransferFrom(address(this), msg.sender, tokenId);
            emit Unstaked(msg.sender, tokenId, _extractTokenID(tokenId));
            unchecked { successfulUnstakes++; }
            unchecked { i++; }
        }

        _stakedBalance[msg.sender] -= successfulUnstakes * nguToken.units();

        return true;
    }

    function _removeStakedToken(address owner_, uint256 tokenId_) internal {
        uint256[] storage tokens = _stakedTokens[owner_];
        uint256 lastIndex = tokens.length - 1;
        uint256 targetIndex = getStakedIndex(tokenId_);

        if (targetIndex != lastIndex) {
            uint256 lastTokenId = tokens[lastIndex];
            tokens[targetIndex] = lastTokenId;
            _setStakedData(lastTokenId, owner_, targetIndex);
        }
        tokens.pop();
    }

    function _extractTokenID(uint256 nftId_) internal pure returns (uint256) {
        return nftId_ & ((1 << (256 - 4)) - 1);
    }

    function balanceOf(address owner_) external view returns (uint256) {
        return _stakedBalance[owner_];
    }

    function getStakedERC721Tokens(address owner_) external view returns (uint256[] memory fullTokenId, uint256[] memory formatId) {
        uint256 len = _stakedTokens[owner_].length;
        fullTokenId = new uint256[](len);
        formatId = new uint256[](len);

        for (uint256 i; i < len; ) {
            uint256 tokenId = _stakedTokens[owner_][i];
            fullTokenId[i] = tokenId;
            formatId[i] = _extractTokenID(tokenId);
            unchecked { i++; }
        }
        return (fullTokenId, formatId);
    }

    function erc20TotalBalanceOf(address owner_) external view returns (uint256) {
        return nguToken.balanceOf(owner_) + _stakedBalance[owner_];
    }

    function getNFTId(uint256 tokenId_) external pure override returns (uint256) {
        return tokenId_;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(INGU505Staking).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId;
    }

} 