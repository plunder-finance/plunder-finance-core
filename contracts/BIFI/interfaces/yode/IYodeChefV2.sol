// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IYodeChefV2 {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint256 _pid, address _user) external view returns (
        uint256 amount, // How many LP tokens the user has provided.
        uint256 rewardDebt, // Reward debt. See explanation below.
        uint256 rewardLockedUp, // Reward locked up.
        uint256 nextHarvestUntil // When can the user harvest again.
    );
    function emergencyWithdraw(uint256 _pid) external;
    function pendingYode(uint256 _pid, address _user) external view returns (uint256);
    function rewarder(uint256 _pid) external view returns (address);
}
