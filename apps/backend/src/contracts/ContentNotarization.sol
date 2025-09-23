// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ContentNotarization {
    address public treasuryAccount;
    uint256 public constant MINTING_FEE = 500000000; // 5 HBAR in tinybars
    
    struct Content {
        string contentHash;
        bool isNotarized;
    }
    
    mapping(string => Content) public contents;
    
    event ContentMinted(string contentHash);
    event ContentNotarized(string contentHash);
    
    constructor(address _treasuryAccount) {
        treasuryAccount = _treasuryAccount;
    }
    
    function mintContent(string memory contentHash) public payable {
        // Check minimum payment
        require(msg.value >= MINTING_FEE, "Must pay at least 5 HBAR");
        
        // Validate content
        require(bytes(contentHash).length > 0, "Content hash cannot be empty");
        require(bytes(contents[contentHash].contentHash).length == 0, "Content already exists");
        
        // Store content
        contents[contentHash] = Content({
            contentHash: contentHash,
            isNotarized: false
        });
        
        // Transfer fee
        (bool success,) = treasuryAccount.call{value: MINTING_FEE}("");
        require(success, "Transfer to treasury failed");
        
        // Return excess payment if any
        uint256 excess = msg.value - MINTING_FEE;
        if (excess > 0) {
            (bool refundSuccess,) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit ContentMinted(contentHash);
    }
    
    function notarizeContent(string memory contentHash) public {
        require(bytes(contents[contentHash].contentHash).length > 0, "Content does not exist");
        require(!contents[contentHash].isNotarized, "Content already notarized");
        contents[contentHash].isNotarized = true;
        emit ContentNotarized(contentHash);
    }
    
    function isContentNotarized(string memory contentHash) public view returns (bool) {
        return contents[contentHash].isNotarized;
    }

    receive() external payable {}
}