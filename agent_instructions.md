# NumberGoUp Game Instructions for AI Agents

## Game Objective
Your goal is to accumulate the highest value of staked tokens while maintaining a profitable position in the game.

## Core Mechanics
1. Each ERC20 token is paired with an NFT (1:1 ratio)
2. Token value increases when:
   - Other players stake tokens
   - Other players transfer tokens
   - Liquidity is added to the pool
3. Token value decreases when:
   - Players unstake tokens
   - Players sell tokens
   - Liquidity is removed from the pool

## Available Actions

### Basic Token Operations
```solidity
// Get your current token balance
function balanceOf(address account) external view returns (uint256)

// Get your NFT balance
function erc721BalanceOf(address account) external view returns (uint256)

// Transfer tokens to another address (automatically transfers NFTs)
function transfer(address to, uint256 amount) external returns (bool)

// Check token allowance
function allowance(address owner, address spender) external view returns (uint256)

// Approve spending
function approve(address spender, uint256 amount) external returns (bool)
```

### Staking Operations
```solidity
// Get your staked token balance
function getStakedERC20Balance(address account) external view returns (uint256)

// Get list of your staked NFT IDs
function getStakedERC721Tokens(address account) external view returns (uint256[] memory)

// Stake specific NFTs (must own corresponding tokens)
function stake(uint256[] calldata tokenIds) external

// Unstake specific NFTs
function unstake(uint256[] calldata tokenIds) external
```

### Market Operations
```solidity
// Get current token price from Uniswap pool
function getTokenPrice() external view returns (uint256)

// Buy tokens through Uniswap
function swapExactETHForTokens(
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external payable returns (uint256[] memory amounts)

// Sell tokens through Uniswap
function swapExactTokensForETH(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts)
```

## Batch Limits
- Maximum tokens per transfer (exempt to non-exempt): 323
- Maximum tokens per transfer (non-exempt to non-exempt): 76
- Maximum tokens per transfer (non-exempt to exempt): 250
- Maximum tokens per stake/unstake operation: 46

## Winning Strategies

### Strategy 1: Early Staking
1. Buy tokens early when price is low
2. Stake immediately to earn from others' actions
3. Monitor price increases
4. Unstake and sell at price peaks

### Strategy 2: Market Making
1. Provide liquidity to the pool
2. Earn fees from other players' trades
3. Monitor price movements
4. Adjust positions based on market direction

### Strategy 3: Swing Trading
1. Buy during price dips
2. Stake during accumulation phases
3. Unstake during price rallies
4. Sell at local peaks

## Risk Management
1. Never stake 100% of your tokens
2. Keep some tokens liquid for opportunities
3. Monitor gas costs for operations
4. Watch for large unstaking events
5. Track your entry and exit prices

## Performance Metrics
Track these metrics to evaluate your strategy:
1. Total Value Locked (TVL) = (Staked Balance + Liquid Balance) * Current Price
2. Profit/Loss = Current TVL - Initial Investment
3. Staking Ratio = Staked Balance / Total Balance
4. Average Entry Price
5. Current ROI

## Error Handling
Common errors to handle:
- InsufficientBalance
- BatchSizeExceeded
- TokenAlreadyStaked
- TokenNotStaked
- NotFound
- QueueEmpty
- QueueFull

## Game Theory Notes
1. First mover advantage exists for staking
2. Large unstaking events create buying opportunities
3. Coordinated staking increases value for all players
4. Price discovery happens through Uniswap V3 pool
5. NFT queue system ensures fair distribution 

## Uniswap V3 Pool Mechanics

### Pool Configuration
```solidity
// Pool address can be found via factory
function getPool() external view returns (address)

// Pool fee tier: 0.3% (3000)
uint24 constant public FEE_TIER = 3000

// Token pair: NGU/WETH
address public constant WETH = [WETH_ADDRESS]
```

### Liquidity Ranges
1. Concentrated Liquidity:
   - Liquidity can be provided in specific price ranges
   - Tighter ranges earn more fees but risk going out of range
   - Wider ranges earn fewer fees but stay in range longer

2. Price Impact:
   - Large buys push price up exponentially
   - Large sells push price down exponentially
   - Impact increases with trade size relative to liquidity depth

### Pool Interactions
```solidity
// Add liquidity to pool
function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount,
    bytes calldata data
) external returns (uint256 tokenId)

// Remove liquidity
function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
) external returns (uint256 amount0, uint256 amount1)

// Collect earned fees
function collect(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0Requested,
    uint128 amount1Requested
) external returns (uint128 amount0, uint128 amount1)
```

### Price Calculation
```solidity
// Get current sqrt price
function slot0() external view returns (
    uint160 sqrtPriceX96,
    int24 tick,
    uint16 observationIndex,
    uint16 observationCardinality,
    uint16 observationCardinalityNext,
    uint8 feeProtocol,
    bool unlocked
)

// Convert sqrt price to actual price
price = (sqrtPriceX96 * sqrtPriceX96 * 1e18) >> (96 * 2)
```

### Trading Strategy Considerations
1. Slippage Protection:
   - Set appropriate amountOutMin when buying
   - Set appropriate amountInMax when selling
   - Use price impact calculations to estimate slippage

2. Optimal Trade Sizes:
   - Large trades (>5% of pool liquidity) have high slippage
   - Break large trades into smaller chunks
   - Monitor liquidity depth at different price levels

3. MEV Protection:
   - Set reasonable deadlines for trades
   - Use appropriate slippage tolerance
   - Be aware of sandwich attack risks

4. Liquidity Provider Strategy:
   - Position ranges around current price
   - Rebalance positions when price moves
   - Collect fees regularly
   - Monitor impermanent loss

### Pool Health Metrics
Monitor these metrics for optimal trading:
1. Liquidity Depth = Total Value Locked in pool
2. Price Range = Current tick position relative to pool range
3. Fee Generation = Daily trading volume * fee tier
4. Price Impact = Expected slippage for trade size
5. Liquidity Utilization = Active liquidity / Total liquidity

### Example Trade Calculations
```typescript
// Calculate optimal trade size
const poolLiquidity = await pool.liquidity()
const maxTradeSize = poolLiquidity * 0.02 // 2% of pool liquidity

// Calculate price impact
const priceImpact = amount * amount / poolLiquidity
const minOutAmount = expectedOut * (1 - maxSlippage)

// Calculate position range
const currentTick = await pool.slot0().tick
const tickSpacing = 60 // For 0.3% fee tier
const rangeSize = 120 // 2 tick spacing for medium range
const lowerTick = currentTick - rangeSize
const upperTick = currentTick + rangeSize
```