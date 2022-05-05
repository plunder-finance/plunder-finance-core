// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../interfaces/IStrategy.sol';
import '../interfaces/IVault.sol';
import '@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';

abstract contract PlunderBaseStrategyv2 is
IStrategy,
UUPSUpgradeable,
AccessControlEnumerableUpgradeable,
PausableUpgradeable
{
    uint256 public constant PERCENT_DIVISOR = 10_000;
    uint256 public constant ONE_YEAR = 365 days;
    uint256 public constant UPGRADE_TIMELOCK = 48 hours; // minimum 48 hours for RF

    struct Harvest {
        uint256 timestamp;
        uint256 vaultSharePrice;
    }

    Harvest[] public harvestLog;
    uint256 public harvestLogCadence;
    uint256 public lastHarvestTimestamp;

    uint256 public upgradeProposalTime;

    /**
     * Reaper Roles in increasing order of privilege.
     * {KEEPER} - Stricly permissioned trustless access for off-chain programs or third party keepers.
     * {STRATEGIST} - Role conferred to authors of the strategy, allows for tweaking non-critical params.
     * {GUARDIAN} - Multisig requiring 2 signatures for emergency measures such as pausing and panicking.
     * {ADMIN}- Multisig requiring 3 signatures for unpausing.
     *
     * The DEFAULT_ADMIN_ROLE (in-built access control role) will be granted to a multisig requiring 4
     * signatures. This role would have upgrading capability, as well as the ability to grant any other
     * roles.
     *
     * Also note that roles are cascading. So any higher privileged role should be able to perform all the functions
     * of any lower privileged role.
     */
    bytes32 public constant KEEPER = keccak256('KEEPER');
    bytes32 public constant STRATEGIST = keccak256('STRATEGIST');
    bytes32 public constant GUARDIAN = keccak256('GUARDIAN');
    bytes32 public constant ADMIN = keccak256('ADMIN');
    bytes32[] private cascadingAccess;

    /**
     * @dev Reaper contracts:
     * {treasury} - Address of the Reaper treasury
     * {vault} - Address of the vault that controls the strategy's funds.
     * {strategistRemitter} - Address where strategist fee is remitted to.
     */
    address public treasury;
    address public vault;
    address public strategistRemitter;

    /**
     * Fee related constants:
     * {MAX_FEE} - Maximum fee allowed by the strategy. Hard-capped at 10%.
     * {STRATEGIST_MAX_FEE} - Maximum strategist fee allowed by the strategy (as % of treasury fee).
     *                        Hard-capped at 50%
     */
    uint256 public constant MAX_FEE = 1000;
    uint256 public constant STRATEGIST_MAX_FEE = 5000;

    /**
     * @dev Distribution of fees earned, expressed as % of the profit from each harvest.
     * {totalFee} - divided by 10,000 to determine the % fee. Set to 4.5% by default and
     * lowered as necessary to provide users with the most competitive APY.
     *
     * {callFee} - Percent of the totalFee reserved for the harvester (1000 = 10% of total fee: 0.45% by default)
     * {treasuryFee} - Percent of the totalFee taken by maintainers of the software (9000 = 90% of total fee: 4.05% by default)
     * {strategistFee} - Percent of the treasuryFee taken by strategist (2500 = 25% of treasury fee: 1.0125% by default)
     *
     * {securityFee} - Fee taxed when a user withdraws funds. Taken to prevent flash deposit/harvest attacks.
     * These funds are redistributed to stakers in the pool.
     */
    uint256 public totalFee;
    uint256 public callFee;
    uint256 public treasuryFee;
    uint256 public strategistFee;

    /**
     * {TotalFeeUpdated} Event that is fired each time the total fee is updated.
     * {FeesUpdated} Event that is fired each time callFee+treasuryFee+strategistFee are updated.
     * {StratHarvest} Event that is fired each time the strategy gets harvested.
     * {StrategistRemitterUpdated} Event that is fired each time the strategistRemitter address is updated.
     */
    event TotalFeeUpdated(uint256 newFee);
    event FeesUpdated(uint256 newCallFee, uint256 newTreasuryFee, uint256 newStrategistFee);
    event StratHarvest(address indexed harvester);
    event StrategistRemitterUpdated(address newStrategistRemitter);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function __PlunderBaseStrategy_init(
        address _vault,
        address[] memory _feeRemitters,
        address[] memory _strategists,
        address[] memory _multisigRoles
    ) internal onlyInitializing {
        __UUPSUpgradeable_init();
        __AccessControlEnumerable_init();
        __Pausable_init_unchained();

        harvestLogCadence = 1 minutes;
        totalFee = 450;
        callFee = 1000;
        treasuryFee = 9000;
        strategistFee = 2500;

        vault = _vault;
        treasury = _feeRemitters[0];
        strategistRemitter = _feeRemitters[1];

        for (uint256 i = 0; i < _strategists.length; i++) {
            _grantRole(STRATEGIST, _strategists[i]);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, _multisigRoles[0]);
        _grantRole(ADMIN, _multisigRoles[1]);
        _grantRole(GUARDIAN, _multisigRoles[2]);

        cascadingAccess = [DEFAULT_ADMIN_ROLE, ADMIN, GUARDIAN, STRATEGIST, KEEPER];
        clearUpgradeCooldown();
        harvestLog.push(
            Harvest({ timestamp: block.timestamp, vaultSharePrice: IVault(_vault).getPricePerFullShare() })
        );
    }

    /**
     * @dev Function that puts the funds to work.
     *      It gets called whenever someone deposits in the strategy's vault contract.
     *      Deposits go through only when the strategy is not paused.
     */
    function deposit() public override whenNotPaused {
        _deposit();
    }

    /**
     * @dev Withdraws funds and sends them back to the vault. Can only
     *      be called by the vault. _amount must be valid and security fee
     *      is deducted up-front.
     */
    function withdraw(uint256 _amount) external override {
        require(msg.sender == vault);
        require(_amount != 0);
        require(_amount <= balanceOf());

        _withdraw(_amount);
    }

    /**
     * @dev harvest() function that takes care of logging. Subcontracts should
     *      override _harvestCore() and implement their specific logic in it.
     */
    function harvest() external override whenNotPaused {
        _harvestCore();

        if (block.timestamp >= harvestLog[harvestLog.length - 1].timestamp + harvestLogCadence) {
            harvestLog.push(
                Harvest({ timestamp: block.timestamp, vaultSharePrice: IVault(vault).getPricePerFullShare() })
            );
        }

        lastHarvestTimestamp = block.timestamp;
        emit StratHarvest(msg.sender);
    }

    function harvestLogLength() external view returns (uint256) {
        return harvestLog.length;
    }

    /**
     * @dev Traverses the harvest log backwards _n items,
     *      and returns the average APR calculated across all the included
     *      log entries. APR is multiplied by PERCENT_DIVISOR to retain precision.
     */
    function averageAPRAcrossLastNHarvests(int256 _n) external view returns (int256) {
        require(harvestLog.length >= 2);

        int256 runningAPRSum;
        int256 numLogsProcessed;

        for (uint256 i = harvestLog.length - 1; i > 0 && numLogsProcessed < _n; i--) {
            runningAPRSum += calculateAPRUsingLogs(i - 1, i);
            numLogsProcessed++;
        }

        return runningAPRSum / numLogsProcessed;
    }

    /**
     * @dev Strategists and roles with higher privilege can edit the log cadence.
     */
    function updateHarvestLogCadence(uint256 _newCadenceInSeconds) external {
        _atLeastRole(STRATEGIST);
        harvestLogCadence = _newCadenceInSeconds;
    }

    /**
     * @dev Function to calculate the total {want} held by the strat.
     *      It takes into account both the funds in hand, plus the funds in external contracts.
     */
    function balanceOf() public view virtual override returns (uint256);

    /**
     * @dev Function to retire the strategy. Claims all rewards and withdraws
     *      all principal from external contracts, and sends everything back to
     *      the vault. Guardian and roles with higher privilege can retire the strat.
     *
     * Note: this is not an emergency withdraw function. For that, see panic().
     */
    function retireStrat() external override {
        _atLeastRole(GUARDIAN);
        _retireStrat();
    }

    /**
     * @dev Pauses deposits. Withdraws all funds leaving rewards behind.
     *      Guardian and roles with higher privilege can panic.
     */
    function panic() external override {
        _atLeastRole(GUARDIAN);
        _reclaimWant();
        pause();
    }

    /**
     * @dev Pauses the strat. Deposits become disabled but users can still
     *      withdraw. Guardian and roles with higher privilege can pause.
     */
    function pause() public override {
        _atLeastRole(GUARDIAN);
        _pause();
        _removeAllowances();
    }

    /**
     * @dev Unpauses the strat. Opens up deposits again and invokes deposit().
     *      Admin and roles with higher privilege can unpause.
     */
    function unpause() external override {
        _atLeastRole(ADMIN);
        _unpause();
        _giveAllowances();
        deposit();
    }

    /**
     * @dev updates the total fee, capped at 5%; only DEFAULT_ADMIN_ROLE.
     */
    function updateTotalFee(uint256 _totalFee) external {
        _atLeastRole(DEFAULT_ADMIN_ROLE);
        require(_totalFee <= MAX_FEE);
        totalFee = _totalFee;
        emit TotalFeeUpdated(totalFee);
    }

    /**
     * @dev updates the call fee, treasury fee, and strategist fee
     *      call Fee + treasury Fee must add up to PERCENT_DIVISOR
     *
     *      strategist fee is expressed as % of the treasury fee and
     *      must be no more than STRATEGIST_MAX_FEE
     *
     *      only DEFAULT_ADMIN_ROLE.
     */
    function updateFees(
        uint256 _callFee,
        uint256 _treasuryFee,
        uint256 _strategistFee
    ) external returns (bool) {
        _atLeastRole(DEFAULT_ADMIN_ROLE);
        require(_callFee + _treasuryFee == PERCENT_DIVISOR);
        require(_strategistFee <= STRATEGIST_MAX_FEE);

        callFee = _callFee;
        treasuryFee = _treasuryFee;
        strategistFee = _strategistFee;
        emit FeesUpdated(callFee, treasuryFee, strategistFee);
        return true;
    }

    /**
     * @dev only DEFAULT_ADMIN_ROLE can update treasury address.
     */
    function updateTreasury(address newTreasury) external returns (bool) {
        _atLeastRole(DEFAULT_ADMIN_ROLE);
        treasury = newTreasury;
        return true;
    }

    /**
     * @dev Updates the current strategistRemitter. Only DEFAULT_ADMIN_ROLE may do this.
     */
    function updateStrategistRemitter(address _newStrategistRemitter) external {
        _atLeastRole(DEFAULT_ADMIN_ROLE);
        require(_newStrategistRemitter != address(0));
        strategistRemitter = _newStrategistRemitter;
        emit StrategistRemitterUpdated(_newStrategistRemitter);
    }

    /**
     * @dev Project an APR using the vault share price change between harvests at the provided indices.
     */
    function calculateAPRUsingLogs(uint256 _startIndex, uint256 _endIndex) public view returns (int256) {
        Harvest storage start = harvestLog[_startIndex];
        Harvest storage end = harvestLog[_endIndex];
        bool increasing = true;
        if (end.vaultSharePrice < start.vaultSharePrice) {
            increasing = false;
        }

        uint256 unsignedSharePriceChange;
        if (increasing) {
            unsignedSharePriceChange = end.vaultSharePrice - start.vaultSharePrice;
        } else {
            unsignedSharePriceChange = start.vaultSharePrice - end.vaultSharePrice;
        }

        uint256 unsignedPercentageChange = (unsignedSharePriceChange * 1e18) / start.vaultSharePrice;
        uint256 timeDifference = end.timestamp - start.timestamp;

        uint256 yearlyUnsignedPercentageChange = (unsignedPercentageChange * ONE_YEAR) / timeDifference;
        yearlyUnsignedPercentageChange /= 1e14; // restore basis points precision

        if (increasing) {
            return int256(yearlyUnsignedPercentageChange);
        }

        return -int256(yearlyUnsignedPercentageChange);
    }

    /**
     * @dev This function must be called prior to upgrading the implementation.
     *      It's required to wait UPGRADE_TIMELOCK seconds before executing the upgrade.
     *      Strategists and roles with higher privilege can initiate this cooldown.
     */
    function initiateUpgradeCooldown() external {
        _atLeastRole(STRATEGIST);
        upgradeProposalTime = block.timestamp;
    }

    /**
     * @dev This function is called:
     *      - in initialize()
     *      - as part of a successful upgrade
     *      - manually to clear the upgrade cooldown.
     * Guardian and roles with higher privilege can clear this cooldown.
     */
    function clearUpgradeCooldown() public {
        _atLeastRole(GUARDIAN);
        upgradeProposalTime = block.timestamp + (ONE_YEAR * 100);
    }

    /**
     * @dev This function must be overriden simply for access control purposes.
     *      Only DEFAULT_ADMIN_ROLE can upgrade the implementation once the timelock
     *      has passed.
     */
    function _authorizeUpgrade(address) internal override {
        _atLeastRole(DEFAULT_ADMIN_ROLE);
        require(upgradeProposalTime + UPGRADE_TIMELOCK < block.timestamp);
        clearUpgradeCooldown();
    }

    /**
     * @dev Modifier that checks cascading role privileges. Any higher privileged role should be able
     * to perform all the functions of any lower privileged role. This is accomplished using the
     * {cascadingAccess} array that lists all roles from most privileged to least privileged.
     */
    function _atLeastRole(bytes32 role) internal view {
        uint256 numRoles = cascadingAccess.length;
        uint256 specifiedRoleIndex;
        for (uint256 i = 0; i < numRoles; i++) {
            if (role == cascadingAccess[i]) {
                specifiedRoleIndex = i;
                break;
            } else if (i == numRoles - 1) {
                revert();
            }
        }

        for (uint256 i = 0; i <= specifiedRoleIndex; i++) {
            if (hasRole(cascadingAccess[i], msg.sender)) {
                break;
            } else if (i == specifiedRoleIndex) {
                revert();
            }
        }
    }

    /**
     * @dev subclasses should add their custom deposit logic in this function.
     */
    function _deposit() internal virtual;

    /**
     * @dev subclasses should add their custom withdraw logic in this function.
     *      Note that security fee has already been deducted, so it shouldn't be deducted
     *      again within this function.
     */
    function _withdraw(uint256 _amount) internal virtual;

    /**
     * @dev subclasses should add their custom harvesting logic in this function
     *      including charging any fees.
     */
    function _harvestCore() internal virtual;

    /**
     * @dev subclasses should add their custom logic to retire the strategy in this function.
     *      Note that we expect all funds (including any pending rewards) to be sent back to
     *      the vault in this function.
     */
    function _retireStrat() internal virtual;

    /**
     * @dev subclasses should add their custom logic to withdraw the principal from
     *      any external contracts in this function. Note that we don't care about rewards,
     *      we just want to reclaim our principal as much as possible, and as quickly as possible.
     *      So keep this function lean. Principal should be left in the strategy and not sent to
     *      the vault.
     */
    function _reclaimWant() internal virtual;

    /**
     * @dev subclasses should add their custom logic to give allowances to external contracts
     *      so the strategy can successfully interface with them.
     */
    function _giveAllowances() internal virtual;

    /**
     * @dev subclasses should add their custom logic to remove all allowances for any external
     *      contracts.
     */
    function _removeAllowances() internal virtual;
}
