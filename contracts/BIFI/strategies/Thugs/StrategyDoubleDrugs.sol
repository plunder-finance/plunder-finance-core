// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../../interfaces/common/IUniswapRouter.sol";
import "../../interfaces/thugs/IOriginalGangsterV2.sol";
import "../../interfaces/thugs/ISmartGangster.sol";

/**
 * @dev Implementation of a strategy to get yields from farming a {hoes} pool + base {drugs} farming.
 *
 * The strategy simply deposits whatever {drugs} it receives from the vault into the OriginalGangster getting {hoes} in exchange.
 * This {hoes} is then allocated into the configured pool (SmartGangster). Rewards generated by the SmartGangster can be harvested,
 * and deposited again for compound farming. Rewards from the OriginalGangster are also compounded.
 * This strat is currently only compatible with the 'double drugs' {hoes} pool.
 */
contract StrategyDoubleDrugs is Ownable, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /**
     * @dev Tokens Used:
     * {wbnb} - Required for liquidity routing when doing swaps.
     * {drugs} - Token that the strategy maximizes. The same token that users deposit in the vault.
     * {hoes} - Intermediate token generated by staking {drugs} in the OriginalGangster.
     * {bifi} - BeefyFinance token, used to send funds to the treasury.
     */
    address constant public wbnb  = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    address constant public drugs = address(0x339550404Ca4d831D12B1b2e4768869997390010);
    address constant public hoes  = address(0xfE60B258204398F008581775F08D2b43fb7b422b);
    address constant public bifi  = address(0xCa3F508B8e4Dd382eE878A314789373D80A5190A);

    /**
     * @dev Third Party Contracts:
     * {unirouter} - StreetSwap unirouter
     * {originalGangster} - OriginalGangster contract. Stake {drugs}, get {hoes}.
     * {smartGangster} - SmartGangster contract. Stake {hoes}, get more {drugs}.
     */
    address constant public unirouter = address(0x3bc677674df90A9e5D741f28f6CA303357D0E4Ec);
    address constant public originalGangster = address(0x03edb31BeCc296d45670790c947150DAfEC2E238);
    address constant public smartGangster = address(0xf1254DE60C5dfd3Af6E7608A308c6f16c6CB773F);

    /**
     * @dev Beefy Contracts:
     * {rewards} - Reward pool where the strategy fee earnings will go.
     * {treasury} - Address of the BeefyFinance treasury
     * {vault} - Address of the vault that controls the strategy's funds.
     */
    address constant public rewards = address(0x453D4Ba9a2D594314DF88564248497F7D74d6b2C);
    address constant public treasury = address(0x4A32De8c248533C28904b24B4cFCFE18E9F2ad01);
    address public vault;
    /**
     * @dev Distribution of fees earned. This allocations relative to the % implemented on chargeFees().
     * Current implementation separates 6% for fees.
     *
     * {REWARDS_FEE} - 4% goes to BIFI holders through the {rewards} pool.
     * {CALL_FEE} - 0.5% goes to whoever executes the harvest function as gas subsidy.
     * {TREASURY_FEE} - 1.5% goes to the treasury.
     * {MAX_FEE} - Aux const used to safely calc the correct amounts.
     *
     * {WITHDRAWAL_FEE} - Fee taxed when a user withdraws funds. 10 === 0.1% fee.
     * {WITHDRAWAL_MAX} - Aux const used to safely calc the correct amounts.
     */
    uint constant public REWARDS_FEE = 667;
    uint constant public CALL_FEE = 83;
    uint constant public TREASURY_FEE = 250;
    uint constant public MAX_FEE = 1000;

    uint constant public WITHDRAWAL_FEE = 10;
    uint constant public WITHDRAWAL_MAX = 10000;

    /**
     * @dev Routes we take to swap tokens using StreetSwap.
     * {drugsToWbnbRoute} - Route we take to get from {drugs} into {wbnb}.
     * {wbnbToBifiRoute} - Route we take to get from {wbnb} into {bifi}.
     */
    address[] public drugsToWbnbRoute = [drugs, wbnb];
    address[] public wbnbToBifiRoute = [wbnb, bifi];

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    /**
     * @dev Initializes the strategy with the vault that it will use.
     */
    constructor(address _vault) {
        vault = _vault;

        IERC20(drugs).safeApprove(unirouter, type(uint).max);
        IERC20(wbnb).safeApprove(unirouter, type(uint).max);
    }

    /**
     * @dev Function that puts the funds to work.
     * It gets called whenever someone deposits in the strategy's vault contract.
     * It deposits {drugs} in the OriginalGangster to receive {hoes}
     * It then deposits the received {hoes} in the SmartGangster to farm more {drugs}.
     */
    function deposit() public whenNotPaused {
        uint256 drugsBal = IERC20(drugs).balanceOf(address(this));

        if (drugsBal > 0) {
            IERC20(drugs).safeApprove(originalGangster, 0);
            IERC20(drugs).safeApprove(originalGangster, drugsBal);
            IOriginalGangsterV2(originalGangster).enterStaking(drugsBal);

            uint256 hoesBal = IERC20(hoes).balanceOf(address(this));
            IERC20(hoes).safeApprove(smartGangster, 0);
            IERC20(hoes).safeApprove(smartGangster, hoesBal);
            ISmartGangster(smartGangster).deposit(hoesBal);
        }
    }

    /**
     * @dev Withdraws funds and sends them back to the vault.
     * It withdraws {hoes} from the SmartGangster, the {hoes} is switched back to {drugs}.
     * The resulting {drugs} minus fees is returned to the vault.
     */
    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 drugsBal = IERC20(drugs).balanceOf(address(this));

        if (drugsBal < _amount) {
            uint256 hoesBal = IERC20(hoes).balanceOf(address(this));
            ISmartGangster(smartGangster).withdraw(_amount.sub(drugsBal).sub(hoesBal));

            hoesBal = IERC20(hoes).balanceOf(address(this));
            if (hoesBal > _amount) {
                hoesBal = _amount;
            }

            IOriginalGangsterV2(originalGangster).leaveStaking(hoesBal);
            drugsBal = IERC20(drugs).balanceOf(address(this));
        }

        if (drugsBal > _amount) {
            drugsBal = _amount;
        }

        uint256 _fee = drugsBal.mul(WITHDRAWAL_FEE).div(WITHDRAWAL_MAX);
        IERC20(drugs).safeTransfer(vault, drugsBal.sub(_fee));
    }

    /**
     * @dev Core function of the strat, in charge of collecting and re-investing rewards.
     * 1. It claims rewards from the OriginalGangster & SmartGangster
     * 2. It charges the system fee and sends it to BIFI stakers.
     * 3. It re-invests the remaining profits.
     */
    function harvest() public whenNotPaused {
        require(!Address.isContract(msg.sender), "!contract");
        IOriginalGangsterV2(originalGangster).leaveStaking(0);
        ISmartGangster(smartGangster).deposit(0);
        chargeFees();
        deposit();

        emit StratHarvest(msg.sender);
    }

    /**
     * @dev Takes out 6% as system fees from the rewards.
     * 0.5% -> Call Fee
     * 1.5% -> Treasury fee
     * 4% -> BIFI Holders
     */
    function chargeFees() internal {
        uint256 toWbnb = IERC20(drugs).balanceOf(address(this)).mul(6).div(100);
        IUniswapRouter(unirouter).swapExactTokensForTokens(toWbnb, 0, drugsToWbnbRoute, address(this), block.timestamp.add(600));

        uint256 wbnbBal = IERC20(wbnb).balanceOf(address(this));

        uint256 callFee = wbnbBal.mul(CALL_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(msg.sender, callFee);

        uint256 treasuryHalf = wbnbBal.mul(TREASURY_FEE).div(MAX_FEE).div(2);
        IERC20(wbnb).safeTransfer(treasury, treasuryHalf);
        IUniswapRouter(unirouter).swapExactTokensForTokens(treasuryHalf, 0, wbnbToBifiRoute, treasury, block.timestamp.add(600));

        uint256 rewardsFee = wbnbBal.mul(REWARDS_FEE).div(MAX_FEE);
        IERC20(wbnb).safeTransfer(rewards, rewardsFee);
    }

    /**
     * @dev Function to calculate the total underlaying {drugs} held by the strat.
     * It takes into account both the funds at hand, as the funds allocated in the SmartGangster.
     */
    function balanceOf() public view returns (uint256) {
        return balanceOfDrugs().add(balanceOfPool());
    }

    /**
     * @dev It calculates how much {drugs} the contract holds.
     */
    function balanceOfDrugs() public view returns (uint256) {
        return IERC20(drugs).balanceOf(address(this));
    }

    /**
     * @dev It calculates how much {drugs} the strategy has allocated in the OriginalGangster
     */
    function balanceOfPool() public view returns (uint256) {
        (uint256 _amount, ) = IOriginalGangsterV2(originalGangster).userInfo(0, address(this));
        return _amount;
    }

    /**
     * @dev Function that has to be called as part of strat migration. It sends all the available funds back to the
     * vault, ready to be migrated to the new strat.
     */
    function retireStrat() external onlyOwner {
        panic();

        uint256 drugsBal = IERC20(drugs).balanceOf(address(this));
        IERC20(drugs).transfer(vault, drugsBal);
    }

    /**
     * @dev Withdraws all funds from the SmartGangster & OriginalGangster, leaving rewards behind.
     * It also reduces allowance of the unirouter
     */
    function panic() public onlyOwner {
        pause();

        ISmartGangster(smartGangster).emergencyWithdraw();

        uint256 hoesBal = IERC20(hoes).balanceOf(address(this));
        IOriginalGangsterV2(originalGangster).leaveStaking(hoesBal);
    }

    /**
     * @dev Pauses the strat.
     */
    function pause() public onlyOwner {
        _pause();

        IERC20(drugs).safeApprove(unirouter, 0);
        IERC20(wbnb).safeApprove(unirouter, 0);
    }

    /**
     * @dev Unpauses the strat.
     */
    function unpause() external onlyOwner {
        _unpause();

        IERC20(drugs).safeApprove(unirouter, type(uint).max);
        IERC20(wbnb).safeApprove(unirouter, type(uint).max);
    }
}