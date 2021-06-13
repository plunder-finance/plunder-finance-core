// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../../interfaces/bakery/IBakerySwapRouter.sol";
import "../../interfaces/bakery/IBakerySwapPair.sol";
import "../../interfaces/bakery/IBakeryMaster.sol";

/**
 * @dev Implementation of a strategy to get yields from farming LP Pools in BakerySwap.
 *
 * This strat is currently compatible with all LP pools.
 */
contract StrategyBakeryLP is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /**
     * @dev Tokens Used:
     * {wbnb} - Required for liquidity routing when doing swaps.
     * {bake} - Token generated by staking our funds. In this case it's the {bake} token.
     * {bifi} - BeefyFinance token, used to send funds to the treasury.
     * {lpPair} - Token that the strategy maximizes. The same token that users deposit in the vault.
     * {lpToken0, lpToken1} - Tokens that the strategy maximizes. IBakerySwapPair tokens
     */
    address constant public wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address constant public bake = address(0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5);
    address constant public bifi = address(0xCa3F508B8e4Dd382eE878A314789373D80A5190A);
    address public lpPair;
    address public lpToken0;
    address public lpToken1;

    /**
     * @dev Third Party Contracts:
     * {unirouter} - BakerySwap unirouter
     * {bakeryMaster} - BakeryMaster contract
     */
    address constant public unirouter = address(0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F);
    address constant public bakeryMaster = address(0x20eC291bB8459b6145317E7126532CE7EcE5056f);

    /**
     * @dev Beefy Contracts:
     * {rewards} - Reward pool where the strategy fee earnings will go.
     * {treasury} - Address of the BeefyFinance treasury
     * {vault} - Address of the vault that controls the strategy's funds.
     * {strategist} - Address of the strategy author/deployer where strategist fee will go.
     */
    address constant public rewards  = address(0x453D4Ba9a2D594314DF88564248497F7D74d6b2C);
    address constant public treasury = address(0x4A32De8c248533C28904b24B4cFCFE18E9F2ad01);
    address public vault;
    address public strategist;

    /**
     * @dev Distribution of fees earned. This allocations relative to the % implemented on doSplit().
     * Current implementation separates 4.5% for fees.
     *
     * {REWARDS_FEE} - 3% goes to BIFI holders through the {rewards} pool.
     * {CALL_FEE} - 0.5% goes to whoever executes the harvest function as gas subsidy.
     * {TREASURY_FEE} - 0.5% goes to the treasury.
     * {STRATEGIST_FEE} - 0.5% goes to the strategist.
     * {MAX_FEE} - Aux const used to safely calc the correct amounts.
     *
     * {WITHDRAWAL_FEE} - Fee taxed when a user withdraws funds. 10 === 0.1% fee.
     * {WITHDRAWAL_MAX} - Aux const used to safely calc the correct amounts.
     */
    uint constant public REWARDS_FEE    = 665;
    uint constant public CALL_FEE       = 111;
    uint constant public TREASURY_FEE   = 112;
    uint constant public STRATEGIST_FEE = 112;
    uint constant public MAX_FEE        = 1000;

    uint constant public WITHDRAWAL_FEE = 10;
    uint constant public WITHDRAWAL_MAX = 10000;

    /**
     * @dev Routes we take to swap tokens using BakerySwap.
     * {bakeToWbnbRoute} - Route we take to get from {bake} into {wbnb}.
     * {wbnbToBifiRoute} - Route we take to get from {wbnb} into {bifi}.
     * {bakeToLp0Route} - Route we take to get from {bake} into {lpToken0}.
     * {bakeToLp1Route} - Route we take to get from {bake} into {lpToken1}.
     */
    address[] public bakeToWbnbRoute = [bake, wbnb];
    address[] public wbnbToBifiRoute = [wbnb, bifi];
    address[] public bakeToLp0Route;
    address[] public bakeToLp1Route;

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    /**
     * @dev Initializes the strategy with the token to maximize.
     */
    constructor(address _lpPair, address _vault, address _strategist) {
        lpPair = _lpPair;
        lpToken0 = IBakerySwapPair(lpPair).token0();
        lpToken1 = IBakerySwapPair(lpPair).token1();
        vault = _vault;
        strategist = _strategist;

        if (lpToken0 == wbnb) {
            bakeToLp0Route = [bake, wbnb];
        } else if (lpToken0 != bake) {
            bakeToLp0Route = [bake, wbnb, lpToken0];
        }

        if (lpToken1 == wbnb) {
            bakeToLp1Route = [bake, wbnb];
        } else if (lpToken1 != bake) {
            bakeToLp1Route = [bake, wbnb, lpToken1];
        }

        IERC20(lpPair).safeApprove(bakeryMaster, type(uint).max);
        IERC20(bake).safeApprove(unirouter, type(uint).max);
        IERC20(wbnb).safeApprove(unirouter, type(uint).max);

        IERC20(lpToken0).safeApprove(unirouter, 0);
        IERC20(lpToken0).safeApprove(unirouter, type(uint).max);

        IERC20(lpToken1).safeApprove(unirouter, 0);
        IERC20(lpToken1).safeApprove(unirouter, type(uint).max);
    }

    /**
     * @dev Function that puts the funds to work.
     * It gets called whenever someone deposits in the strategy's vault contract.
     * It deposits {lpPair} in the BakeryMaster to farm {bake}
     */
    function deposit() public whenNotPaused {
        uint256 pairBal = IERC20(lpPair).balanceOf(address(this));

        if (pairBal > 0) {
            IBakeryMaster(bakeryMaster).deposit(lpPair, pairBal);
        }
    }

    /**
     * @dev Withdraws funds and sents them back to the vault.
     * It withdraws {lpPair} from the BakeryMaster.
     * The available {lpPair} minus fees is returned to the vault.
     */
    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 pairBal = IERC20(lpPair).balanceOf(address(this));

        if (pairBal < _amount) {
            IBakeryMaster(bakeryMaster).withdraw(lpPair, _amount.sub(pairBal));
            pairBal = IERC20(lpPair).balanceOf(address(this));
        }

        if (pairBal > _amount) {
            pairBal = _amount;
        }

        uint256 withdrawalFee = pairBal.mul(WITHDRAWAL_FEE).div(WITHDRAWAL_MAX);
        IERC20(lpPair).safeTransfer(vault, pairBal.sub(withdrawalFee));
    }

    /**
     * @dev Core function of the strat, in charge of collecting and re-investing rewards.
     * 1. It claims rewards from the BakeryMaster.
     * 2. It charges the system fees to simplify the split.
     * 3. It swaps the {bake} token for {lpToken0} & {lpToken1}
     * 4. Adds more liquidity to the pool.
     * 5. It deposits the new LP tokens.
     */
    function harvest() external whenNotPaused {
        require(!Address.isContract(msg.sender), "!contract");
        IBakeryMaster(bakeryMaster).deposit(lpPair, 0);
        chargeFees();
        addLiquidity();
        deposit();

        emit StratHarvest(msg.sender);
    }

    /**
     * @dev Takes out 4.5% as system fees from the rewards.
     * 0.5% -> Call Fee
     * 0.5% -> Treasury fee
     * 0.5% -> Strategist fee
     * 3.0% -> BIFI Holders
     */
    function chargeFees() internal {
        uint256 toWbnb = IERC20(bake).balanceOf(address(this)).mul(45).div(1000);
        IBakerySwapRouter(unirouter).swapExactTokensForTokens(toWbnb, 0, bakeToWbnbRoute, address(this), block.timestamp.add(600));

        uint256 wbnbBal = IERC20(wbnb).balanceOf(address(this));

        uint256 callFee = wbnbBal.mul(CALL_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(msg.sender, callFee);

        uint256 treasuryHalf = wbnbBal.mul(TREASURY_FEE).div(MAX_FEE).div(2);
        IERC20(wbnb).safeTransfer(treasury, treasuryHalf);
        IBakerySwapRouter(unirouter).swapExactTokensForTokens(treasuryHalf, 0, wbnbToBifiRoute, treasury, block.timestamp.add(600));

        uint256 rewardsFee = wbnbBal.mul(REWARDS_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(rewards, rewardsFee);

        uint256 strategistFee = wbnbBal.mul(STRATEGIST_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(strategist, strategistFee);
    }

    /**
     * @dev Swaps {bake} for {lpToken0}, {lpToken1} & {wbnb} using BakerySwap.
     */
    function addLiquidity() internal {
        uint256 bakeHalf = IERC20(bake).balanceOf(address(this)).div(2);

        if (lpToken0 != bake) {
            IBakerySwapRouter(unirouter).swapExactTokensForTokens(bakeHalf, 0, bakeToLp0Route, address(this), block.timestamp.add(600));
        }

        if (lpToken1 != bake) {
            IBakerySwapRouter(unirouter).swapExactTokensForTokens(bakeHalf, 0, bakeToLp1Route, address(this), block.timestamp.add(600));
        }

        uint256 lp0Bal = IERC20(lpToken0).balanceOf(address(this));
        uint256 lp1Bal = IERC20(lpToken1).balanceOf(address(this));
        IBakerySwapRouter(unirouter).addLiquidity(lpToken0, lpToken1, lp0Bal, lp1Bal, 1, 1, address(this), block.timestamp.add(600));
    }

    /**
     * @dev Function to calculate the total underlaying {lpPair} held by the strat.
     * It takes into account both the funds in hand, as the funds allocated in the BakeryMaster.
     */
    function balanceOf() public view returns (uint256) {
        return balanceOfLpPair().add(balanceOfPool());
    }

    /**
     * @dev It calculates how much {lpPair} the contract holds.
     */
    function balanceOfLpPair() public view returns (uint256) {
        return IERC20(lpPair).balanceOf(address(this));
    }

    /**
     * @dev It calculates how much {lpPair} the strategy has allocated in the BakeryMaster
     */
    function balanceOfPool() public view returns (uint256) {
        (uint256 _amount, ) = IBakeryMaster(bakeryMaster).poolUserInfoMap(lpPair, address(this));
        return _amount;
    }

    /**
     * @dev Function that has to be called as part of strat migration. It sends all the available funds back to the
     * vault, ready to be migrated to the new strat.
     */
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IBakeryMaster(bakeryMaster).emergencyWithdraw(lpPair);

        uint256 pairBal = IERC20(lpPair).balanceOf(address(this));
        IERC20(lpPair).transfer(vault, pairBal);
    }

    /**
     * @dev Pauses deposits. Withdraws all funds from the BakeryMaster, leaving rewards behind
     */
    function panic() public onlyOwner {
        pause();
        IBakeryMaster(bakeryMaster).emergencyWithdraw(lpPair);
    }

    /**
     * @dev Pauses the strat.
     */
    function pause() public onlyOwner {
        _pause();

        IERC20(lpPair).safeApprove(bakeryMaster, 0);
        IERC20(bake).safeApprove(unirouter, 0);
        IERC20(wbnb).safeApprove(unirouter, 0);
        IERC20(lpToken0).safeApprove(unirouter, 0);
        IERC20(lpToken1).safeApprove(unirouter, 0);
    }

    /**
     * @dev Unpauses the strat.
     */
    function unpause() external onlyOwner {
        _unpause();

        IERC20(lpPair).safeApprove(bakeryMaster, type(uint).max);
        IERC20(bake).safeApprove(unirouter, type(uint).max);
        IERC20(wbnb).safeApprove(unirouter, type(uint).max);

        IERC20(lpToken0).safeApprove(unirouter, 0);
        IERC20(lpToken0).safeApprove(unirouter, type(uint).max);

        IERC20(lpToken1).safeApprove(unirouter, 0);
        IERC20(lpToken1).safeApprove(unirouter, type(uint).max);
    }
}
