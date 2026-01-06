// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title VeilVerifier
/// @notice Verifies Casper identity attestations on EVM chains
/// @dev Uses secp256k1 signatures for cross-chain identity verification
contract VeilVerifier is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice Tier levels matching Casper contract
    enum Tier {
        None,
        Bronze,
        Silver,
        Gold,
        Platinum,
        Validator
    }

    /// @notice Attestation data structure for decoding
    struct AttestationData {
        bytes32 casperAddressHash;
        string targetChain;
        string targetAddress;
        uint256 stake;
        uint8 tier;
        uint64 accountAgeDays;
        uint64 createdAt;
        uint64 expiresAt;
        uint64 nonce;
    }

    /// @notice Verified identity data
    struct VerifiedIdentity {
        bytes32 casperAddressHash;
        Tier tier;
        uint256 stake;
        uint64 accountAgeDays;
        uint64 verifiedAt;
        uint64 expiresAt;
    }

    /// @notice Casper attestation signer address
    address public casperSigner;

    /// @notice Verified users mapping
    mapping(address => VerifiedIdentity) public verifiedUsers;

    /// @notice Used attestations (prevent replay)
    mapping(bytes32 => bool) public usedAttestations;

    /// @notice Revoked attestations
    mapping(bytes32 => bool) public revokedAttestations;

    /// @notice Emitted when identity is verified
    event IdentityVerified(
        address indexed user, bytes32 casperAddressHash, Tier tier, uint256 stake
    );

    /// @notice Emitted when attestation is revoked
    event AttestationRevoked(bytes32 indexed attestationId);

    /// @notice Emitted when signer is updated
    event SignerUpdated(address newSigner);

    error AttestationAlreadyUsed();
    error AttestationIsRevoked();
    error AttestationExpired();
    error TargetAddressMismatch();
    error InvalidSignature();

    constructor(address _casperSigner) Ownable(msg.sender) {
        casperSigner = _casperSigner;
    }

    /// @notice Verify attestation and store identity
    /// @param attestation ABI-encoded attestation data
    /// @param signature 65-byte secp256k1 signature (r, s, v)
    function verifyAndStore(bytes calldata attestation, bytes calldata signature)
        external
        returns (bool)
    {
        AttestationData memory data = _decodeAttestation(attestation);
        bytes32 attestationId = keccak256(attestation);

        _validateAttestation(attestationId, data.expiresAt);
        _validateTargetAddress(data.targetAddress);
        _validateSignature(attestation, signature);

        usedAttestations[attestationId] = true;

        verifiedUsers[msg.sender] = VerifiedIdentity({
            casperAddressHash: data.casperAddressHash,
            tier: Tier(data.tier),
            stake: data.stake,
            accountAgeDays: data.accountAgeDays,
            verifiedAt: uint64(block.timestamp),
            expiresAt: data.expiresAt
        });

        emit IdentityVerified(msg.sender, data.casperAddressHash, Tier(data.tier), data.stake);

        return true;
    }

    /// @notice Verify attestation without storing
    function verify(bytes calldata attestation, bytes calldata signature)
        external
        view
        returns (bool valid, Tier tier, uint256 stake)
    {
        AttestationData memory data = _decodeAttestation(attestation);
        bytes32 attestationId = keccak256(attestation);

        if (usedAttestations[attestationId]) return (false, Tier.None, 0);
        if (revokedAttestations[attestationId]) return (false, Tier.None, 0);
        if (block.timestamp * 1000 >= data.expiresAt) return (false, Tier.None, 0);

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);

        if (recovered != casperSigner) return (false, Tier.None, 0);

        return (true, Tier(data.tier), data.stake);
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get user's tier
    function getTier(address user) external view returns (Tier) {
        VerifiedIdentity memory identity = verifiedUsers[user];
        if (identity.expiresAt < block.timestamp * 1000) {
            return Tier.None;
        }
        return identity.tier;
    }

    /// @notice Get user's stake
    function getStake(address user) external view returns (uint256) {
        return verifiedUsers[user].stake;
    }

    /// @notice Check if user is verified
    function isVerified(address user) external view returns (bool) {
        VerifiedIdentity memory identity = verifiedUsers[user];
        return identity.expiresAt > block.timestamp * 1000;
    }

    /// @notice Get full verified identity
    function getVerifiedIdentity(address user) external view returns (VerifiedIdentity memory) {
        return verifiedUsers[user];
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Update signer address
    function updateSigner(address newSigner) external onlyOwner {
        casperSigner = newSigner;
        emit SignerUpdated(newSigner);
    }

    /// @notice Revoke an attestation
    function revokeAttestation(bytes32 attestationId) external onlyOwner {
        revokedAttestations[attestationId] = true;
        emit AttestationRevoked(attestationId);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _decodeAttestation(bytes calldata attestation)
        internal
        pure
        returns (AttestationData memory)
    {
        (
            bytes32 casperAddressHash,
            string memory targetChain,
            string memory targetAddress,
            uint256 stake,
            uint8 tier,
            uint64 accountAgeDays,
            uint64 createdAt,
            uint64 expiresAt,
            uint64 nonce
        ) = abi.decode(
            attestation, (bytes32, string, string, uint256, uint8, uint64, uint64, uint64, uint64)
        );

        return AttestationData({
            casperAddressHash: casperAddressHash,
            targetChain: targetChain,
            targetAddress: targetAddress,
            stake: stake,
            tier: tier,
            accountAgeDays: accountAgeDays,
            createdAt: createdAt,
            expiresAt: expiresAt,
            nonce: nonce
        });
    }

    function _validateAttestation(bytes32 attestationId, uint64 expiresAt) internal view {
        if (usedAttestations[attestationId]) revert AttestationAlreadyUsed();
        if (revokedAttestations[attestationId]) revert AttestationIsRevoked();
        if (block.timestamp * 1000 >= expiresAt) revert AttestationExpired();
    }

    function _validateTargetAddress(string memory targetAddress) internal view {
        if (!_compareStrings(targetAddress, _addressToString(msg.sender))) {
            revert TargetAddressMismatch();
        }
    }

    function _validateSignature(bytes calldata attestation, bytes calldata signature) internal view {
        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        if (recovered != casperSigner) revert InvalidSignature();
    }

    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
