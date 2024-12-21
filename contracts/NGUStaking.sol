// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {INGU505Staking} from "./interfaces/INGU505Staking.sol";
import {NumberGoUp} from "./NumberGoUp.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";

/// @title NGU Staking Contract
/// @notice External staking contract for NumberGoUp NFTs
contract NGUStaking is INGU505Staking, ReentrancyGuard, Ownable, IERC721Receiver {
    /// @notice The NumberGoUp token contract
    NumberGoUp public immutable nguToken;

    /// @notice Mapping of user address to their staked token IDs
    mapping(address => uint256[]) private _stakedTokens;

    /// @notice Mapping of token ID to packed staking data (address + index)
    /// @dev Format: [160 bits for address][96 bits for index]
    mapping(uint256 => uint256) private _stakedData;

    /// @notice Mapping of user address to their staked ERC20 balance
    mapping(address => uint256) private _stakedBalance;

    /// @notice Maximum number of tokens that can be staked/unstaked in a single transaction
    uint256 public constant MAX_BATCH_SIZE = 46;

    /// @notice Bit masks for packed data
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    uint256 private constant _BITMASK_INDEX = ((1 << 96) - 1) << 160;

    /// @notice Constructor
    /// @param nguToken_ Address of the NumberGoUp token contract
    /// @param initialOwner_ Address of the initial contract owner
    constructor(address nguToken_, address initialOwner_) Ownable(initialOwner_) {
        nguToken = NumberGoUp(nguToken_);
    }

    /// @notice Get the staked owner of a token ID
    /// @param tokenId_ The token ID to check
    function getStakedOwner(uint256 tokenId_) public view returns (address owner_) {
        uint256 data = _stakedData[tokenId_];
        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    /// @notice Get the index of a token in its owner's staked tokens array
    /// @param tokenId_ The token ID to check
    function getStakedIndex(uint256 tokenId_) public view returns (uint256 index_) {
        uint256 data = _stakedData[tokenId_];
        assembly {
            index_ := shr(160, data)
        }
    }

    /// @notice Set the staked owner and index for a token
    /// @param tokenId_ The token ID to update
    /// @param owner_ The owner address
    /// @param index_ The index in the owner's array
    function _setStakedData(uint256 tokenId_, address owner_, uint256 index_) internal {
        if (index_ > type(uint96).max) revert IndexOverflow();
        uint256 data;
        assembly {
            data := add(
                and(owner_, _BITMASK_ADDRESS),
                shl(160, index_)
            )
        }
        _stakedData[tokenId_] = data;
    }

    /// @notice Stake NFTs into the contract
    /// @param ids_ Array of token IDs to stake
    /// @return success True if the staking operation succeeded
    function stake(uint256[] calldata ids_) external nonReentrant returns (bool) {
        uint256 length = ids_.length;
        if (length == 0) revert EmptyStakingArray();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        if (nguToken.erc721TransferExempt(msg.sender)) revert InvalidStakingExemption();

        uint256 totalValue = nguToken.units() * length;
        uint256 balance = nguToken.balanceOf(msg.sender);
        if (balance < totalValue) revert StakerInsufficientBalance(totalValue, balance);

        // Process each token
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = ids_[i];
            
            // Verify ownership and not already staked
            if (getStakedOwner(tokenId) != address(0)) revert TokenAlreadyStaked(tokenId);
            if (nguToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

            // Update staking records
            uint256 newIndex = _stakedTokens[msg.sender].length;
            _stakedTokens[msg.sender].push(tokenId);
            _setStakedData(tokenId, msg.sender, newIndex);
            unchecked { i++; }
        }

        // Update staked balance
        _stakedBalance[msg.sender] += totalValue;

        // Transfer tokens to this contract
        nguToken.transferFrom(msg.sender, address(this), totalValue);

        emit Staked(msg.sender, ids_);
        return true;
    }

    /// @notice Unstake NFTs from the contract
    /// @param ids_ Array of token IDs to unstake
    /// @return success True if the unstaking operation succeeded
    function unstake(uint256[] calldata ids_) external nonReentrant returns (bool) {
        uint256 length = ids_.length;
        if (length == 0) revert EmptyStakingArray();
        if (length > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 totalValue = nguToken.units() * length;

        // Process each token
        for (uint256 i = 0; i < length;) {
            uint256 tokenId = ids_[i];
            
            // Verify ownership
            if (getStakedOwner(tokenId) != msg.sender) revert NotTokenOwner();

            // Remove from staking records
            _removeStakedToken(msg.sender, tokenId);
            delete _stakedData[tokenId];
            unchecked { i++; }
        }

        // Update staked balance
        _stakedBalance[msg.sender] -= totalValue;

        // Transfer tokens back to user
        nguToken.transfer(msg.sender, totalValue);

        emit Unstaked(msg.sender, ids_);
        return true;
    }

    /// @notice Remove a token from the staked tokens array
    /// @param owner_ The owner of the token
    /// @param tokenId_ The token ID to remove
    function _removeStakedToken(address owner_, uint256 tokenId_) internal {
        uint256[] storage tokens = _stakedTokens[owner_];
        uint256 lastIndex = tokens.length - 1;
        uint256 targetIndex = getStakedIndex(tokenId_);

        if (targetIndex != lastIndex) {
            // Move the last token to the removed position
            uint256 lastTokenId = tokens[lastIndex];
            tokens[targetIndex] = lastTokenId;
            // Update the moved token's index
            _setStakedData(lastTokenId, owner_, targetIndex);
        }
        tokens.pop();
    }

    /// @notice Get the staked ERC20 balance for an address
    /// @param owner_ The address to check
    /// @return The total amount of staked ERC20 tokens
    function getStakedERC20Balance(address owner_) external view returns (uint256) {
        return _stakedBalance[owner_];
    }

    /// @notice Get all staked tokens for an address
    /// @param owner_ The address to check
    /// @return Array of token IDs staked by the owner
    function getStakedERC721Tokens(address owner_) external view returns (uint256[] memory) {
        return _stakedTokens[owner_];
    }

    /// @notice Get the total ERC20 balance of an address including staked tokens
    /// @param owner_ The address to check
    /// @return The sum of ERC20 balance and staked balance
    function erc20TotalBalanceOf(address owner_) external view returns (uint256) {
        return nguToken.balanceOf(owner_) + _stakedBalance[owner_];
    }

    /// @notice Get the NFT ID format for a given token ID
    /// @param tokenId_ The token ID to format
    /// @return The formatted NFT ID
    function getNFTId(uint256 tokenId_) external pure returns (uint256) {
        return tokenId_;
    }

    /// @notice Required for IERC721Receiver
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Implementation of IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(INGU505Staking).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId;
    }

    error IndexOverflow();
} 