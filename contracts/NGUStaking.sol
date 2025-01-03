// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {INGU505Staking} from "./interfaces/INGU505Staking.sol";
import {NumberGoUp} from "./NumberGoUp.sol";
import {INGU505Base} from "./NGU505Base.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";

/// @title NGU Staking Contract
/// @notice External staking contract for NumberGoUp NFTs
contract NGUStaking is INGU505Staking, ReentrancyGuard, Ownable, IERC721Receiver {
    /// @notice The NumberGoUp token contract
    INGU505Base public immutable nguToken;

    /// @notice Mapping of user address to their staked token IDs
    mapping(address => uint256[]) internal _stakedTokens;

    /// @notice Mapping of token ID to packed staking data (address + index)
    /// @dev Format: [160 bits for address][96 bits for index]
    mapping(uint256 => uint256) internal _stakedData;

    /// @notice Mapping of user address to their staked ERC20 balance
    mapping(address => uint256) internal _stakedBalance;

    /// @notice Bit masks for packed data
    uint256 private constant _BITMASK_OWNER = (1 << 160) - 1;
    uint256 private constant _BITMASK_INDEX = ((1 << 96) - 1) << 160;

    constructor(address nguToken_, address initialOwner_) Ownable(initialOwner_) {
        nguToken = INGU505Base(nguToken_);
    }

    function getStakedIndex(uint256 tokenId) public view returns (uint256) {
        uint256 data = _stakedData[tokenId];
        return data >> 160;
    }

    function getStakedOwner(uint256 tokenId_) public view returns (address owner_) {
        uint256 data = _stakedData[tokenId_];
        assembly {
            owner_ := and(data, _BITMASK_OWNER)
        }
    }

    function _setStakedData(uint256 tokenId, address owner, uint256 index) internal {
        _stakedData[tokenId] = (uint256(uint160(owner)) | (index << 160));
    }

    function _clearStakedData(uint256 tokenId) internal {
        delete _stakedData[tokenId];
    }

    function stake(uint256[] calldata tokenIds) external nonReentrant returns (bool) {
        uint256 length = tokenIds.length;
        if (length == 0) revert EmptyStakingArray();
        if (nguToken.erc721TransferExempt(msg.sender)) revert InvalidStakingExemption();
        if (nguToken.erc721TransferExempt(address(this))) revert InvalidStakingExemption();
        
        uint256 totalValue = nguToken.units() * length;
        uint256 balance = nguToken.balanceOf(msg.sender);
        if (balance < totalValue) revert StakerInsufficientBalance(totalValue, balance);

        for (uint256 i = 0; i < length;) {
            uint256 tokenId = tokenIds[i];
            if (getStakedOwner(tokenId) != address(0)) revert TokenAlreadyStaked(tokenId);
            if (nguToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

            uint256 newIndex = _stakedTokens[msg.sender].length;
            _stakedTokens[msg.sender].push(tokenId);
            _setStakedData(tokenId, msg.sender, newIndex);
            
            // Transfer NFT to staking contract
            nguToken.erc721TransferFrom(msg.sender, address(this), tokenId);
            
            unchecked { i++; }
            emit Staked(msg.sender, tokenId);
        }

        _stakedBalance[msg.sender] += length * nguToken.units();
        return true;
    }

    function unstake(uint256[] calldata tokenIds) external nonReentrant returns (bool) {
        uint256 length = tokenIds.length;
        if (length == 0) revert EmptyStakingArray();

        for (uint256 i = 0; i < length;) {
            uint256 tokenId = tokenIds[i];
            
            address stakedOwner = getStakedOwner(tokenId);
            if (stakedOwner == address(0)) revert TokenNotStaked(tokenId);
            if (stakedOwner != msg.sender) revert NotTokenOwner();

            uint256 lastIndex = _stakedTokens[msg.sender].length - 1;
            uint256 tokenIndex = getStakedIndex(tokenId);
            
            // If not the last token, move the last token to this position
            if (tokenIndex != lastIndex) {
                uint256 lastTokenId = _stakedTokens[msg.sender][lastIndex];
                _stakedTokens[msg.sender][tokenIndex] = lastTokenId;
                _setStakedData(lastTokenId, msg.sender, tokenIndex);
            }
            _stakedTokens[msg.sender].pop();
            _clearStakedData(tokenId);

            // Transfer NFT back to user
            nguToken.erc721TransferFrom(address(this), msg.sender, tokenId);
            
            emit Unstaked(msg.sender, tokenId);
            unchecked { i++; }
        }

        _stakedBalance[msg.sender] -= length * nguToken.units();
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