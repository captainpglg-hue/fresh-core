// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * FreshCoreAnchor
 *
 * Registre on-chain de Merkle roots qui ancrent les chaînes d'événements
 * de lots Fresh-Core. Le batcher off-chain calcule un Merkle root par
 * batch de lots à ancrer, et l'écrit ici via anchorRoot(). La vérification
 * "tel lot était à tel état à telle date" se fait off-chain en
 * recomputant le keccak256 des feuilles + le proof Merkle, puis en
 * comparant à la valeur retournée par getRoot(batchId).
 *
 * Modèle volontairement minimal :
 *  - 1 owner = adresse du batcher autorisée à publier
 *  - pas de pause, pas de upgrade, pas de royalties
 *  - 1 event RootAnchored par batch (indexé batchId + root, queryable)
 *
 * Déploiement cible : Polygon Amoy testnet ou Polygon PoS mainnet.
 * Coût d'ancrage typique : ~50k gas / appel → < 0.005 MATIC à 30 gwei.
 */
contract FreshCoreAnchor {
    address public owner;
    uint256 public nextBatchId;

    mapping(uint256 => bytes32) public roots;
    mapping(uint256 => uint256) public anchoredAt;
    mapping(uint256 => uint256) public leafCounts;

    event RootAnchored(
        uint256 indexed batchId,
        bytes32 indexed root,
        uint256 leafCount,
        uint256 timestamp
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroRoot();
    error ZeroLeafCount();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function anchorRoot(bytes32 root, uint256 leafCount) external onlyOwner returns (uint256 batchId) {
        if (root == bytes32(0)) revert ZeroRoot();
        if (leafCount == 0) revert ZeroLeafCount();

        batchId = nextBatchId;
        unchecked { nextBatchId = batchId + 1; }

        roots[batchId] = root;
        anchoredAt[batchId] = block.timestamp;
        leafCounts[batchId] = leafCount;

        emit RootAnchored(batchId, root, leafCount, block.timestamp);
    }

    function getRoot(uint256 batchId) external view returns (bytes32) {
        return roots[batchId];
    }

    function getBatch(uint256 batchId)
        external
        view
        returns (bytes32 root, uint256 timestamp, uint256 leafCount)
    {
        return (roots[batchId], anchoredAt[batchId], leafCounts[batchId]);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
