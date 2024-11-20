// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {INGU505} from "./interfaces/INGU505.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";
import {ERC721Events} from "./lib/ERC721Events.sol";
import {ERC20Events} from "./lib/ERC20Events.sol";
// import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./lib/DoubleEndedQueue.sol";
// ReentrancyGuard
abstract contract NGU505 is INGU505 {
    using DoubleEndedQueue for DoubleEndedQueue.Uint256Deque;

    /// @dev The name of the token.
    string public name;

    /// @dev The symbol for the token.
    string public symbol;

    /// @dev The number of decimals for the ERC20 token.
    uint8 public immutable decimals;

    /// @dev Number of units for the ERC20 token.
    uint256 public immutable units;

    /// @dev The total supply of ERC20 tokens.
    uint256 public totalSupply;

    /// @dev The total number of ERC721 tokens minted.
    uint256 public minted;

    /// @dev Initial chain id for EIP-2612 support
    uint256 internal immutable _INITIAL_CHAIN_ID;

    /// @dev Initial domain separator for EIP-2612 support
    bytes32 internal immutable _INITIAL_DOMAIN_SEPARATOR;

    /// @dev A mapping of users to their held ERC20 tokens.
    mapping(address => uint256) public stakedERC20TokenBank;

    /// @dev ERC20 user balances.
    mapping(address => uint256) public balanceOf;

    /// @dev ERC20 allowances, from grantor to grantee.
    mapping(address => mapping(address => uint256)) public allowance;

    /// @dev Addresses that are exempt from ERC-721 transfer, typically for gas savings (pairs, routers, etc)
    mapping(address => bool) internal _erc721TransferExempt;

    /// @dev EIP-2612 nonces
    mapping(address => uint256) public nonces;

    /// @notice - Queue of NFTs which are unstaked, and for sale. Staked NFTs are not included.
    mapping(address => DoubleEndedQueue.Uint256Deque) private _sellingQueue;
    
    /// @notice - The next two mappings are for tracking an address's staked tokens
    /// @dev owner => [staked token IDs]
    mapping(address => uint256[]) private _staked;
    /// @dev token ID => owner+index in _staked array
    mapping(uint256 => uint256) private _stakedData;

    /// @notice - The next two mappings are for tracking who owns a token and the index.
    ///@dev owner => [owned token IDs]
    mapping(address => uint256[]) private _owned;
    /// @dev token ID => owner+index in _owned array
    mapping(uint256 => uint256) private _ownedData;

    /// @dev Address bitmask for packed ownership data
    uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;
    /// @dev Owned index bitmask for packed ownership data
    uint256 private constant _BITMASK_OWNED_INDEX = ((1 << 96) - 1) << 160;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;

        if (decimals_ < 18) {
            revert DecimalsTooLow();
        }
        decimals = decimals_;
        units = 10 ** decimals;
        
        // EIP-2612 initialization
        _INITIAL_CHAIN_ID = block.chainid;
        _INITIAL_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    /// @notice tokenURI must be implemented by child contract.
    function tokenURI(uint256 id_) public view virtual returns (string memory);

    /// @notice - Function to get the owner of an ERC-721 token.
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _getOwnerOf(tokenId);
        require(owner != address(0), "NGU505: owner query for nonexistent token");
        return owner;
    }

    function owned(
        address owner_
    ) public view virtual returns (uint256[] memory) {
        return _owned[owner_];
    }

    function erc721BalanceOf(
        address owner_
    ) public view virtual returns (uint256) {
        return _owned[owner_].length;
    }

    function erc20BalanceOf(
        address owner_
    ) public view virtual returns (uint256) {
        return balanceOf[owner_];
    }

    function getStakedERC20Balance(address owner_) public view virtual returns (uint256) {
        return stakedERC20TokenBank[owner_];
    }

    function getStakedTokens(address owner_) public view virtual returns (uint256[] memory) {
        return _staked[owner_];
    }

    function erc20TotalSupply() public view virtual returns (uint256) {
        return totalSupply;
    }

    function erc721TotalSupply() public view virtual returns (uint256) {
        return minted;
    }

    /// @notice This function handles consolidated ERC721 functions.
    /// Handles both minting and transferring 721s, based on from_ and to_ addresses.
    /// @dev - Currently set up to transfer the first item in from_'s queue if id_ = 0
    function _transferERC721(
        address from_,
        address to_,
        uint256 id_
    ) internal virtual {
        uint256 tokenId;
        if (from_ != address(0)) {
            // If this is not a mint.
            // Check if the sender is the owner of the token - May have to do this elsewhere because of dynamic ID
            // require(_getOwnerOf(id_) == from_, "NGU505: transfer of token that is not own");

            // Pop from the sender's selling queue
            if (id_ == 0) {
                if (_sellingQueue[from_].empty()) {
                    revert QueueEmpty();
                }
                tokenId = _sellingQueue[from_].popFront();
            } else {
                tokenId = id_;
            }
            if (_getOwnerOf(tokenId) != from_) {
                revert NotOwner();
            }
            // Remove from from_'s _owned array.
            removeOwnedById(from_, tokenId);
            delete _ownedData[tokenId];
            
        } else {
            // This is a mint - Just take id_
            tokenId = id_;
        }

        // If it's not a burn
        if (to_ != address(0)) {
            // Add the token ID to the to_'s _owned array
            addOwnedToken(to_, tokenId);
            // Sets the owner of the token ID to the to_ address in _ownedData.
            _setOwnerOf(tokenId, to_);
            // Sets the owned index of the token ID to the length of the to_'s _owned array.
            _setOwnedIndex(tokenId, _owned[to_].length - 1);
            // Add the token ID to the to_'s selling queue
            _sellingQueue[to_].pushBack(tokenId);
        } else {
            // If this is a burn
            // Front of queue already popped in the _withdrawAndBurn721 function.
            // Set owner to 0x0 in the ownedData mapping
            _setOwnerOf(tokenId, address(0));
            // delete the token from the ownedData mapping.
            delete _ownedData[tokenId];
        }

        emit ERC721Events.Transfer(from_, to_, tokenId);
    }

    /// @notice This is the lowest level ERC-20 transfer function, which
    /// should be used for both normal ERC-20 transfers as well as minting.
    /// Note that this function allows transfers to and from 0x0.
    function _transferERC20(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual {
        if (from_ == address(0)) {
            totalSupply += value_;
        } else {
            // Use unchecked block to save gas
            unchecked {
                balanceOf[from_] -= value_;
            }
        }

        unchecked {
            balanceOf[to_] += value_;
        }

        emit ERC20Events.Transfer(from_, to_, value_);
    }

    // @notice - Vastly modified from the Pandora Labs ERC404 contract.
    function _transferERC20WithERC721(
        address from_,
        address to_,
        uint256 value_
    ) internal virtual returns (bool) {
        // Cache balances before transfer to avoid multiple SLOAD operations
        uint256 fromBalanceBefore = balanceOf[from_];
        uint256 toBalanceBefore = balanceOf[to_];

        _transferERC20(from_, to_, value_);

        // Cache exemption status to avoid multiple SLOAD operations
        bool isFromExempt = erc721TransferExempt(from_);
        bool isToExempt = erc721TransferExempt(to_);

        // Early return if both parties are exempt
        if (isFromExempt && isToExempt) {
            return true;
        }

        // Calculate whole token changes
        uint256 fromBalanceAfter = balanceOf[from_];
        uint256 toBalanceAfter = balanceOf[to_];
        
        uint256 fromTokensDelta = fromBalanceBefore / units - fromBalanceAfter / units;
        uint256 toTokensDelta = toBalanceAfter / units - toBalanceBefore / units;

        if (isFromExempt) {
            // Mint any new whole tokens to recipient
            for (uint256 i = 0; i < toTokensDelta; ) {
                _mintERC721(to_);
                unchecked { ++i; }
            }
        } else if (isToExempt) {
            // Burn whole tokens from sender
            for (uint256 i = 0; i < fromTokensDelta; ) {
                _withdrawAndBurnERC721(from_);
                unchecked { ++i; }
            }
        } else {
            // Transfer whole tokens between non-exempt addresses
            uint256 nftsToTransfer = value_ / units;
            
            // First handle direct transfers
            for (uint256 i = 0; i < nftsToTransfer; ) {
                _transferERC721(from_, to_, 0);
                unchecked { ++i; }
            }

            // Then handle any fractional cleanup
            if (fromTokensDelta > nftsToTransfer) {
                _withdrawAndBurnERC721(from_);
            }

            if (toTokensDelta > nftsToTransfer) {
                _mintERC721(to_);
            }
        }

        return true;
    }
/// @notice - Gets the next ID in the selling queue
    function getNextQueueId(
        address owner_
    ) public view virtual returns (uint256) {
        return _sellingQueue[owner_].front();
    }

/// @notice - This is the function we will use to get N items from the queue. Iterate over this for indices 0 to n - 1.
    function getIdAtQueueIndex(
        address owner_,
        uint128 index_
    ) public view virtual returns (uint256) {
        return _sellingQueue[owner_].at(index_);
    }

function removeItemFromQueueById(address owner_, uint256 id_) public {
    _sellingQueue[owner_].removeById(id_);
}

function getQueueLength(address owner_) public view virtual returns (uint256) {
    return _sellingQueue[owner_].size();
}

function getOwnerOfId(uint256 id_) public view virtual returns (address) {
    return _getOwnerOf(id_);
}

/// @notice - This does what is intended above but it's mostly in the smart contract. Secondary implementation option.
/// @notice - Refactor this trash.
    function getERC721TokensInQueue(
        address owner_,
        uint256 count_
    ) public view virtual returns (uint256[] memory) {
        require(!_sellingQueue[owner_].empty(), "Selling queue is empty");

        uint256 count;
        uint256 queueLength = _sellingQueue[owner_].size();
        
        if (queueLength < count_){
            count = queueLength;
        }
        uint256[] memory tokensInQueue = new uint256[](count);
        
        for (uint256 i = 0; i < count; ) {
            tokensInQueue[i] = _sellingQueue[owner_].at(i);

            unchecked {
                ++i;
            }
        }

        return tokensInQueue;
    }

/// @dev - Helper function to add a token ID to an owner's _owned array
/// @notice - may want to add selling queue stuff as well. 
    function addOwnedToken(address owner, uint256 tokenId) internal {
        uint256 index = _owned[owner].length;
        _owned[owner].push(tokenId);
        // Update packed data for _ownedData
        _setOwnerOf(tokenId, owner);
        _setOwnedIndex(tokenId, index);
        // Add to selling queue (?)
    }

    function stakeNFT(uint256 id_) public virtual returns (bool) {
        // Ensure the caller is the owner of the NFT
        require(_getOwnerOf(id_) == msg.sender, "Caller is not the owner");
        require(msg.sender != address(0), "Invalid sender");
        require(erc721TransferExempt(msg.sender) == false, "Sender is exempt from ERC-721 staking");
        require(erc721BalanceOf(msg.sender) > 0, "No NFTs to stake");
        require(balanceOf[msg.sender] >= units, "Insufficient ERC20 balance to stake");

        // ERC-20 Logic
        // Use unchecked block to save gas
        unchecked {
            balanceOf[msg.sender] -= units;
        }
        stakedERC20TokenBank[msg.sender] += units;

        // ERC-721 Logic
        removeItemFromQueueById(msg.sender, id_);
        _staked[msg.sender].push(id_);
        _setStakedIndex(id_, _staked[msg.sender].length - 1);
        _setStakedIdOwner(id_, msg.sender);

        return true;
    }

    /// @notice - Need to work on this function. Something weird with the permissions and msg.sender.
    function stakeMultipleNFTs(uint256[] memory ids_) public virtual returns (bool) {
        for (uint256 i = 0; i < ids_.length; i++) {
            stakeNFT(ids_[i]);
        }
        return true;
    }

    function unstakeNFT(uint256 id_) public virtual returns (bool) {
        // Ensure the caller is the owner of the staked NFT
        address owner = _getOwnerOfStakedId(id_);
        require(owner == msg.sender, "Only owner can unstake.");

        // Check if the user has enough staked ERC20 balance
        uint256 stakedBalance = stakedERC20TokenBank[msg.sender];
        require(stakedBalance >= units, "Insufficient staked balance to unstake");

        // ERC-20 Logic
        // Temporarily exempt the user from ERC-721 minting to prevent unintended NFT minting
        _setERC721TransferExempt(msg.sender, true);
        // Adjust the staked and available ERC20 balances
        stakedERC20TokenBank[msg.sender] -= units;
        balanceOf[msg.sender] += units;
        // Remove the exemption
        _setERC721TransferExempt(msg.sender, false);

        // ERC-721 Logic
        // Add the NFT back to the selling queue
        _sellingQueue[msg.sender].pushBack(id_);
        // Remove the NFT from the staked array and data mapping
        removeStakedFromQueueById(msg.sender, id_);
        delete _stakedData[id_];

        return true;
    }

/// @notice - Need to work on this function. Something weird with the permissions and msg.sender. 
    // function unstakeMultipleNFTs(uint256[] memory ids_) public virtual returns (bool) {
    //     for (uint256 i = 0; i < ids_.length; i++) {
    //         unstakeNFT(ids_[i]);
    //     }
    //     return true;
    // }
    /// @notice - Approvals for ERC20 balance management.
    /// in the previous version of ERC404, this function was used for 721 and 20 approvals.
    /// we don't delegte 721 approvals in this contract.
    function approve(
        address spender_,
        uint256 value_
    ) public virtual returns (bool) {
        if (spender_ == address(0)) {
            revert InvalidSpender();
        }

        allowance[msg.sender][spender_] = value_;

        emit ERC20Events.Approval(msg.sender, spender_, value_);

        return true;
    }

    /// @notice - This function is used to transfer ERC20 tokens from one address to another. Used by Uniswap for setting up the pool.
    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) public virtual returns (bool) {
        if (from_ == address(0)) {
            revert InvalidSender();
        }

        if (to_ == address(0)) {
            revert InvalidRecipient();
        }

        uint256 allowed = allowance[from_][msg.sender];

        // Check if operator has sufficent balance
        if (allowed != type(uint256).max) {
            allowance[from_][msg.sender] = allowed - value_;
        }

        return _transferERC20WithERC721(from_, to_, value_);
    }

    function _withdrawAndBurnERC721(address from_) internal virtual {
        if (from_ == address(0)) {
            revert InvalidSender();
        }

        // Get the first token in the owner's queue
        uint256 tokenId = _sellingQueue[from_].popFront();

        _transferERC721(from_, address(0), tokenId);
    }

    /// @notice Internal function for ERC20 minting
    /// @dev This function will allow minting of new ERC20s.
    ///      If mintCorrespondingERC721s_ is true, and the recipient is not ERC-721 exempt, it will
    ///      also mint the corresponding ERC721s.
    /// Handles ERC-721 exemptions.
    function _mintERC20(address to_, uint256 value_) internal virtual {
        /// You cannot mint to the zero address (you can't mint and immediately burn in the same transfer).
        if (to_ == address(0)) {
            revert InvalidRecipient();
        }

        if (totalSupply + value_ > type(uint256).max) {
            revert MintLimitReached();
        }

        _transferERC20WithERC721(address(0), to_, value_);
    }

    /// @notice Internal function for ERC-721 minting and retrieval from the bank.
    /// @dev This function will allow minting of new ERC-721s up to the total fractional supply. It will
    ///      first try to pull from the bank, and if the bank is empty, it will mint a new token.
    /// Does not handle ERC-721 exemptions.
    function _mintERC721(address to_) internal virtual {
        if (to_ == address(0)) {
            revert InvalidRecipient();
        }
        // Increase minted counter
        ++minted;

        // Reserve max uint256 for approvals
        if (minted == type(uint256).max) {
            revert MintLimitReached();
        }

        uint256 id = minted;

        address erc721Owner = _getOwnerOf(id);

        // The token should not already belong to anyone besides 0x0 or this contract.
        // If it does, something is wrong, as this should never happen.
        if (erc721Owner != address(0)) {
            revert AlreadyExists();
        }

        // Transfer the token to the recipient, either transferring from the contract's bank or minting.
        // Does not handle ERC-721 exemptions.
        _transferERC721(erc721Owner, to_, id);
    }

    // Transfers from msg.sender as sender. 
    function transfer(
        address to_,
        uint256 value_
    ) public virtual returns (bool) {
        // Prevent burning tokens to 0x0
        if (to_ == address(0)) {
            revert InvalidRecipient();
        }
        require(balanceOf[msg.sender] >= value_, "Insufficient balance");
        uint256 value = value_ * units;
        // Transferring ERC-20s directly requires the _transferERC20WithERC721 function
        return _transferERC20WithERC721(msg.sender, to_, value);
    }

    // /// @dev - Maybe this is where we transfer ERC-721 tokens?? If we don't have an ID encoding prefix, it's hard
    // /// to tell what kind of asset we are attempting to transfer. 
    // /// @notice - Ideas: include a prefix like NGU-##?
    // function safeTransfer (
    //     address to_,
    //     uint256 id_
    // ) public virtual returns (bool) {
        
    // }

   //  function safeTransferFrom(
   //      address from_,
   //      address to_,
   //      uint256 id_
   //  ) public virtual {
   //      safeTransferFrom(from_, to_, id_, "");
   //  }

    function safeTransferFrom(
        address from_,
        address to_,
        uint256 id_,
        bytes memory data_
    ) public virtual {
        if (id_ > type(uint256).max && id_ != type(uint256).max) {
            revert InvalidTokenId();
        }

        transferFrom(from_, to_, id_);

        if (
            to_.code.length != 0 &&
            IERC721Receiver(to_).onERC721Received(
                msg.sender,
                from_,
                id_,
                data_
            ) !=
            IERC721Receiver.onERC721Received.selector
        ) {
            revert UnsafeRecipient();
        }
    }

    function erc721TransferExempt(
        address target_
    ) public view virtual returns (bool) {
        return target_ == address(0) || _erc721TransferExempt[target_];
    }

    /// @notice Function for self-exemption
    function setSelfERC721TransferExempt(bool state_) public virtual {
        _setERC721TransferExempt(msg.sender, state_);
    }

    /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
    function _setERC721TransferExempt(
        address target_,
        bool state_
    ) internal virtual {
        if (target_ == address(0)) {
            revert InvalidExemption();
        }
        _erc721TransferExempt[target_] = state_;
    }

    /// @notice _setOwnerOf, _getOwnerOf, _getOwnedIndex, and _setOwnedIndex are helper functions for managing the packed data in _ownedData.
    function _setOwnerOf(uint256 tokenId, address owner) internal virtual {
        uint256 data = _ownedData[tokenId];

        assembly {
            data := add(
                and(data, _BITMASK_OWNED_INDEX),
                and(owner, _BITMASK_ADDRESS)
            )
        }
        _ownedData[tokenId] = data;
    }

    function _getOwnerOf(
        uint256 tokenId
    ) internal view virtual returns (address owner_) {
        uint256 data = _ownedData[tokenId];

        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    function _getOwnedIndex(
        uint256 tokenId
    ) internal view virtual returns (uint256 ownedIndex_) {
        uint256 data = _ownedData[tokenId];

        assembly {
            ownedIndex_ := shr(160, data)
        }
    }

    function _setOwnedIndex(uint256 id_, uint256 index_) internal virtual {
        uint256 data = _ownedData[id_];

        if (index_ > _BITMASK_OWNED_INDEX >> 160) {
            revert OwnedIndexOverflow();
        }

        assembly {
            data := add(
                and(data, _BITMASK_ADDRESS),
                and(shl(160, index_), _BITMASK_OWNED_INDEX)
            )
        }

        _ownedData[id_] = data;
    }
        /// @notice - removeOnwedById is a helper function to remove the token ID from the owner's _owned array.
    function removeOwnedById(address owner, uint256 tokenId) internal {
        uint256 index = _getOwnedIndex(tokenId);
        uint256 lastIndex = _owned[owner].length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = _owned[owner][lastIndex];

            // Swap the token IDs
            _owned[owner][index] = lastTokenId;

            // Update the owned index in the packed data for the swapped token
            _setOwnedIndex(lastTokenId, index);
        }

        // Remove the last element
        _owned[owner].pop();
        delete _ownedData[tokenId];
    }

    /// @notice The below are helper functions for staked NFT management. 
    function _setStakedIdOwner(uint256 tokenId, address owner) internal virtual {
        uint256 data = _stakedData[tokenId];

        assembly {
            data := add(
                and(data, _BITMASK_OWNED_INDEX),
                and(owner, _BITMASK_ADDRESS)
            )
        }
        _stakedData[tokenId] = data;
    }

    function _getOwnerOfStakedId(
        uint256 tokenId
    ) internal view virtual returns (address owner_) {
        uint256 data = _stakedData[tokenId];

        assembly {
            owner_ := and(data, _BITMASK_ADDRESS)
        }
    }

    function _getStakedIndex(
        uint256 tokenId
    ) internal view virtual returns (uint256 stakedIndex_) {
        uint256 data = _stakedData[tokenId];

        assembly {
            stakedIndex_ := shr(160, data)
        }
    }

    function _setStakedIndex(uint256 id_, uint256 index_) internal virtual {
        uint256 data = _stakedData[id_];

        if (index_ > _BITMASK_OWNED_INDEX >> 160) {
            revert OwnedIndexOverflow();
        }

        assembly {
            data := add(
                and(data, _BITMASK_ADDRESS),
                and(shl(160, index_), _BITMASK_OWNED_INDEX)
            )
        }

        _stakedData[id_] = data;
    }

    /// @notice - removeStakedFromQueueById is a helper function to remove the token ID from the owner's _owned array.
    function removeStakedFromQueueById(address owner, uint256 tokenId) internal {
        uint256 index = _getStakedIndex(tokenId);
        uint256 lastIndex = _staked[owner].length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = _staked[owner][lastIndex];

            // Swap the token IDs
            _staked[owner][index] = lastTokenId;

            // Update the owned index in the packed data for the swapped token
            _setStakedIndex(lastTokenId, index);
        }

        // Remove the last element
        _staked[owner].pop();
        delete _stakedData[tokenId];
    }

    /// @notice Function for EIP-2612 permits (ERC-20 only).
    /// @dev Providing type(uint256).max for permit value results in an
    ///      unlimited approval that is not deducted from on transfers.
    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) public virtual {
        if (deadline_ < block.timestamp) {
            revert PermitDeadlineExpired();
        }

        // permit cannot be used for ERC-721 token approvals, so ensure
        // the value does not fall within the valid range of ERC-721 token ids.
        if (value_ >= type(uint256).max) {
            revert InvalidApproval();
        }

        if (spender_ == address(0)) {
            revert InvalidSpender();
        }

        unchecked {
            address recoveredAddress = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        DOMAIN_SEPARATOR(),
                        keccak256(
                            abi.encode(
                                keccak256(
                                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                                ),
                                owner_,
                                spender_,
                                value_,
                                nonces[owner_]++,
                                deadline_
                            )
                        )
                    )
                ),
                v_,
                r_,
                s_
            );

            if (recoveredAddress == address(0) || recoveredAddress != owner_) {
                revert InvalidSigner();
            }

            allowance[recoveredAddress][spender_] = value_;
        }

        emit ERC20Events.Approval(owner_, spender_, value_);
    }

    /// @notice Internal function to compute domain separator for EIP-2612 permits
    function _computeDomainSeparator() internal view virtual returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(name)),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }

    /// @notice Returns domain initial domain separator, or recomputes if chain id is not equal to initial chain id
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        return
            block.chainid == _INITIAL_CHAIN_ID
                ? _INITIAL_DOMAIN_SEPARATOR
                : _computeDomainSeparator();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual returns (bool) {
        return
            interfaceId == type(INGU505).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
