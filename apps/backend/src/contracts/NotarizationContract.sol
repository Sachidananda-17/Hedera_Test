// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NotarizationContract {
    address public treasuryAccount;
    uint256 public mintingFee = 5 ether; // 5 HBAR
    
    struct Content {
        string contentHash;
        address owner;
        uint256 timestamp;
        bool isNotarized;
    }
    
    mapping(uint256 => Content) public contents;
    uint256 public contentCount;
    
    event ContentMinted(
        uint256 indexed contentId,
        string contentHash,
        address indexed owner,
        uint256 timestamp
    );
    
    event ContentNotarized(
        uint256 indexed contentId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    
    constructor(address _treasuryAccount) {
        treasuryAccount = _treasuryAccount;
    }
    
    function mintContent(string memory _contentHash) public payable {
        require(msg.value >= mintingFee, "Insufficient payment for minting");
        
        contentCount++;
        contents[contentCount] = Content({
            contentHash: _contentHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            isNotarized: false
        });
        
        // Transfer minting fee to treasury
        payable(treasuryAccount).transfer(msg.value);
        
        emit ContentMinted(contentCount, _contentHash, msg.sender, block.timestamp);
    }
    
    function notarizeContent(uint256 _contentId) public {
        require(_contentId <= contentCount, "Content does not exist");
        require(contents[_contentId].owner == msg.sender, "Not the content owner");
        require(!contents[_contentId].isNotarized, "Content already notarized");
        
        contents[_contentId].isNotarized = true;
        
        emit ContentNotarized(
            _contentId,
            msg.sender,
            treasuryAccount,
            block.timestamp
        );
    }
    
    function getContent(uint256 _contentId) public view returns (
        string memory contentHash,
        address owner,
        uint256 timestamp,
        bool isNotarized
    ) {
        require(_contentId <= contentCount, "Content does not exist");
        Content memory content = contents[_contentId];
        return (
            content.contentHash,
            content.owner,
            content.timestamp,
            content.isNotarized
        );
    }
}
