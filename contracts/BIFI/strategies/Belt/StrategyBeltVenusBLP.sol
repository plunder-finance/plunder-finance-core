// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../../interfaces/common/IUniswapRouter.sol";
import "../../interfaces/common/IUniswapV2Pair.sol";
import "../../interfaces/belt/IMasterBelt.sol";
import "../../interfaces/belt/IBeltLP.sol";

/**
 * @dev Implementation of a strategy to get yields from farming Venus BLP on Belt.
 */
contract StrategyBeltVenusBLP is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /**
     * @dev Tokens Used:
     * {wbnb, busd} - Required for liquidity routing when doing swaps.
     * {belt} - Token generated by staking our funds. In this case it's the BELT token.
     * {bifi} - PlunderFinance token, used to send funds to the treasury.
     * {want} - Token that the strategy maximizes. The same token that users deposit in the vault. bDAI+bUSDC+bUSDT+bBUSD
     */
    address constant public wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address constant public busd = address(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
    address constant public belt = address(0xE0e514c71282b6f4e823703a39374Cf58dc3eA4f);
    address constant public bifi = address(0xCa3F508B8e4Dd382eE878A314789373D80A5190A);
    address constant public want = address(0x86aFa7ff694Ab8C985b79733745662760e454169);

    /**
     * @dev Third Party Contracts:
     * {unirouter} - PancakeSwap unirouter
     * {masterbelt} - MasterBelt contract
     * {beltLP} - BeltLP contract, to deposit and withdraw bDAI+bUSDC+bUSDT+bBUSD
     * {poolId} - MasterBelt pool id
     */
    address constant public unirouter  = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    address constant public masterbelt = address(0xD4BbC80b9B102b77B21A06cb77E954049605E6c1);
    address constant public beltLP     = address(0xf157A4799bE445e3808592eDd7E7f72150a7B050);
    uint8 public poolId;

    /**
     * @dev Plunder Contracts:
     * {rewards} - Reward pool where the strategy fee earnings will go.
     * {treasury} - Address of the PlunderFinance treasury
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
     * @dev Routes we take to swap tokens using PancakeSwap.
     * {beltToWbnbRoute} - Route we take to go from {belt} into {wbnb}.
     * {wbnbToBifiRoute} - Route we take to go from {wbnb} into {bifi}.
     * {beltToBusdRoute} - Route we take to get from {belt} into {busd}.
     */
    address[] public beltToWbnbRoute = [belt, wbnb];
    address[] public wbnbToBifiRoute = [wbnb, bifi];
    address[] public beltToBusdRoute = [belt, wbnb, busd];

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    /**
     * @dev Initializes the strategy with the token to maximize.
     */
    constructor(uint8 _poolId, address _vault, address _strategist) public {
        poolId = _poolId;
        vault = _vault;
        strategist = _strategist;

        IERC20(want).safeApprove(masterbelt, uint(-1));
        IERC20(belt).safeApprove(unirouter, uint(-1));
        IERC20(wbnb).safeApprove(unirouter, uint(-1));
        IERC20(busd).safeApprove(beltLP, uint(-1));
    }

    /**
     * @dev Function that puts the funds to work.
     * It gets called whenever someone deposits in the strategy's vault contract.
     * It deposits {want} in the MasterBelt to earn rewards in {belt}.
     */
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IMasterBelt(masterbelt).deposit(poolId, wantBal);
        }
    }

    /**
     * @dev Withdraws funds and sents them back to the vault.
     * It withdraws {want} from the MasterBelt.
     * The available {want} minus fees is returned to the vault.
     */
    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IMasterBelt(masterbelt).withdraw(poolId, _amount.sub(wantBal));
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        if (tx.origin == owner()) {
            IERC20(want).safeTransfer(vault, wantBal);
        } else {
            uint256 withdrawalFee = wantBal.mul(WITHDRAWAL_FEE).div(WITHDRAWAL_MAX);
            IERC20(want).safeTransfer(vault, wantBal.sub(withdrawalFee));
        }
    }

    /**
     * @dev Core function of the strat, in charge of collecting and re-investing rewards.
     * 1. It claims rewards from the MasterBelt
     * 3. It charges the system fee and sends it to BIFI stakers.
     * 4. It re-invests the remaining profits.
     */
    function harvest() external whenNotPaused {
        require(!Address.isContract(msg.sender), "!contract");
        IMasterBelt(masterbelt).deposit(poolId, 0);
        chargeFees();
        swapRewards();
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
        uint256 toWbnb = IERC20(belt).balanceOf(address(this)).mul(45).div(1000);
        IUniswapRouter(unirouter).swapExactTokensForTokens(toWbnb, 0, beltToWbnbRoute, address(this), now.add(600));

        uint256 wbnbBal = IERC20(wbnb).balanceOf(address(this));

        uint256 callFee = wbnbBal.mul(CALL_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(tx.origin, callFee);

        uint256 treasuryHalf = wbnbBal.mul(TREASURY_FEE).div(MAX_FEE).div(2);
        IERC20(wbnb).safeTransfer(treasury, treasuryHalf);
        IUniswapRouter(unirouter).swapExactTokensForTokens(treasuryHalf, 0, wbnbToBifiRoute, treasury, now.add(600));

        uint256 rewardsFee = wbnbBal.mul(REWARDS_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(rewards, rewardsFee);

        uint256 strategistFee = wbnbBal.mul(STRATEGIST_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(strategist, strategistFee);
    }

    /**
     * @dev Swaps {belt} rewards earned for {busd} and adds to VenusBeltLP.
     */
    function swapRewards() internal {
        uint256 beltBal = IERC20(belt).balanceOf(address(this));
        IUniswapRouter(unirouter).swapExactTokensForTokens(beltBal, 0, beltToBusdRoute, address(this), now.add(600));

        uint256 busdBal = IERC20(busd).balanceOf(address(this));
        uint256[4] memory uamounts = [0, 0, 0, busdBal];
        IBeltLP(beltLP).add_liquidity(uamounts, 0);
    }

    /**
     * @dev Function to calculate the total underlying {want} held by the strat.
     * It takes into account both the funds in hand, as the funds allocated in AutoFarm.
     */
    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    /**
     * @dev It calculates how much {want} the contract holds.
     */
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    /**
     * @dev It calculates how much {want} the strategy has allocated in the MasterBelt
     */
    function balanceOfPool() public view returns (uint256) {
        return IMasterBelt(masterbelt).stakedWantTokens(poolId, address(this));
    }

    /**
     * @dev Function that has to be called as part of strat migration. It sends all the available funds back to the
     * vault, ready to be migrated to the new strat.
     */
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IMasterBelt(masterbelt).emergencyWithdraw(poolId);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    /**
     * @dev Pauses deposits. Withdraws all funds from the MasterBelt, leaving rewards behind
     */
    function panic() public onlyOwner {
        pause();
        IMasterBelt(masterbelt).emergencyWithdraw(poolId);
    }

    /**
     * @dev Pauses the strat.
     */
    function pause() public onlyOwner {
        _pause();

        IERC20(want).safeApprove(masterbelt, uint(0));
        IERC20(belt).safeApprove(unirouter, uint(0));
        IERC20(wbnb).safeApprove(unirouter, uint(0));
        IERC20(busd).safeApprove(beltLP, uint(0));
    }

    /**
     * @dev Unpauses the strat.
     */
    function unpause() external onlyOwner {
        _unpause();

        IERC20(want).safeApprove(masterbelt, uint(-1));
        IERC20(belt).safeApprove(unirouter, uint(-1));
        IERC20(wbnb).safeApprove(unirouter, uint(-1));
        IERC20(busd).safeApprove(beltLP, uint(-1));
    }

    /**
     * @dev Updates address where strategist fee earnings will go.
     * @param _strategist new strategist address.
     */
    function setStrategist(address _strategist) external {
        require(msg.sender == strategist, "!strategist");
        strategist = _strategist;
    }
}
