// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract MinimalStaking {
    address payable public admin;
    address payable public appAccount;
    uint256 public minimumStake = 50000000; // 0.5 HBAR
    
    mapping(string => uint256) public stakes;
    mapping(string => address payable) public stakeUsers;
    
    event StakeCreated(string requestId, address user, uint256 amount);
    event StakeCompleted(string requestId);
    event StakeRefunded(string requestId);
    
    constructor() {
        admin = payable(msg.sender);
    }
    
    function setAppAccount(address _appAccount) external {
        require(msg.sender == admin, "Only admin");
        appAccount = payable(_appAccount);
    }
    
    function createStake(string memory requestId) external payable {
        require(msg.value >= minimumStake, "Insufficient stake");
        require(stakes[requestId] == 0, "Stake exists");
        
        stakes[requestId] = msg.value;
        stakeUsers[requestId] = payable(msg.sender);
        
        emit StakeCreated(requestId, msg.sender, msg.value);
    }
    
    function completeStake(string memory requestId) external {
        require(msg.sender == admin, "Only admin");
        require(stakes[requestId] > 0, "No stake");
        require(appAccount != address(0), "No app account");
        
        uint256 amount = stakes[requestId];
        stakes[requestId] = 0;
        
        appAccount.transfer(amount);
        emit StakeCompleted(requestId);
    }
    
    function refundStake(string memory requestId) external {
        require(msg.sender == admin, "Only admin");
        require(stakes[requestId] > 0, "No stake");
        
        uint256 amount = stakes[requestId];
        address payable user = stakeUsers[requestId];
        stakes[requestId] = 0;
        
        user.transfer(amount);
        emit StakeRefunded(requestId);
    }
}
