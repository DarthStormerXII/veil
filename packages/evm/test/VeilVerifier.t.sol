// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VeilVerifier.sol";

contract VeilVerifierTest is Test {
    VeilVerifier public verifier;

    // Test private key (Foundry default anvil key #0)
    uint256 constant SIGNER_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address constant SIGNER_ADDRESS = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    address user = address(0x1234);

    function setUp() public {
        verifier = new VeilVerifier(SIGNER_ADDRESS);
    }

    // ============ UNIT TESTS ============

    function test_constructor_setsSigner() public view {
        assertEq(verifier.casperSigner(), SIGNER_ADDRESS);
    }

    function test_unverifiedUser_returnsNone() public view {
        assertEq(uint(verifier.getTier(user)), uint(VeilVerifier.Tier.None));
        assertEq(verifier.isVerified(user), false);
    }

    // ============ SIGNATURE TESTS ============

    function test_verifyAndStore_withValidSignature() public {
        // Create attestation payload
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetChain = "base-sepolia";
        string memory targetAddress = _addressToString(user);
        uint256 stake = 1000 * 1e9; // 1000 CSPR in motes
        uint8 tier = 2; // Silver
        uint64 accountAgeDays = 0;
        uint64 createdAt = uint64(block.timestamp * 1000);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);
        uint64 nonce = 0;

        // ABI encode the attestation
        bytes memory attestation = abi.encode(
            casperAddressHash,
            targetChain,
            targetAddress,
            stake,
            tier,
            accountAgeDays,
            createdAt,
            expiresAt,
            nonce
        );

        // Sign with Ethereum personal_sign
        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Verify and store
        vm.prank(user);
        bool success = verifier.verifyAndStore(attestation, signature);

        assertTrue(success);
        assertEq(verifier.isVerified(user), true);
        assertEq(uint(verifier.getTier(user)), uint(VeilVerifier.Tier.Silver));
        assertEq(verifier.getStake(user), stake);
    }

    function test_verifyAndStore_rejectsWrongSender() public {
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetChain = "base-sepolia";
        string memory targetAddress = _addressToString(user); // Target is 'user'
        uint256 stake = 1000 * 1e9;
        uint8 tier = 2;
        uint64 accountAgeDays = 0;
        uint64 createdAt = uint64(block.timestamp * 1000);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);
        uint64 nonce = 0;

        bytes memory attestation = abi.encode(
            casperAddressHash, targetChain, targetAddress,
            stake, tier, accountAgeDays, createdAt, expiresAt, nonce
        );

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Wrong sender (not 'user')
        address wrongUser = address(0x9999);
        vm.prank(wrongUser);
        vm.expectRevert(VeilVerifier.TargetAddressMismatch.selector);
        verifier.verifyAndStore(attestation, signature);
    }

    function test_verifyAndStore_rejectsInvalidSignature() public {
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetAddress = _addressToString(user);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);

        bytes memory attestation = abi.encode(
            casperAddressHash, "base-sepolia", targetAddress,
            1000 * 1e9, uint8(2), uint64(0), uint64(block.timestamp * 1000), expiresAt, uint64(0)
        );

        // Sign with wrong key
        uint256 wrongKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user);
        vm.expectRevert(VeilVerifier.InvalidSignature.selector);
        verifier.verifyAndStore(attestation, signature);
    }

    function test_verifyAndStore_rejectsExpiredAttestation() public {
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetAddress = _addressToString(user);
        uint64 createdAt = uint64(block.timestamp * 1000);
        uint64 expiresAt = uint64((block.timestamp - 1) * 1000); // Already expired

        bytes memory attestation = abi.encode(
            casperAddressHash, "base-sepolia", targetAddress,
            1000 * 1e9, uint8(2), uint64(0), createdAt, expiresAt, uint64(0)
        );

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user);
        vm.expectRevert(VeilVerifier.AttestationExpired.selector);
        verifier.verifyAndStore(attestation, signature);
    }

    function test_verifyAndStore_rejectsReplayAttack() public {
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetAddress = _addressToString(user);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);

        bytes memory attestation = abi.encode(
            casperAddressHash, "base-sepolia", targetAddress,
            1000 * 1e9, uint8(2), uint64(0), uint64(block.timestamp * 1000), expiresAt, uint64(0)
        );

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // First verification succeeds
        vm.prank(user);
        verifier.verifyAndStore(attestation, signature);

        // Second verification fails (replay)
        vm.prank(user);
        vm.expectRevert(VeilVerifier.AttestationAlreadyUsed.selector);
        verifier.verifyAndStore(attestation, signature);
    }

    function test_verify_viewFunction() public {
        bytes32 casperAddressHash = keccak256("casper-account-hash");
        string memory targetAddress = _addressToString(user);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);

        bytes memory attestation = abi.encode(
            casperAddressHash, "base-sepolia", targetAddress,
            10000 * 1e9, uint8(3), uint64(0), uint64(block.timestamp * 1000), expiresAt, uint64(0)
        );

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        (bool valid, VeilVerifier.Tier tier, uint256 stake) = verifier.verify(attestation, signature);

        assertTrue(valid);
        assertEq(uint(tier), uint(VeilVerifier.Tier.Gold));
        assertEq(stake, 10000 * 1e9);
    }

    // ============ ADMIN TESTS ============

    function test_updateSigner_onlyOwner() public {
        address newSigner = address(0xBEEF);

        // Owner can update
        verifier.updateSigner(newSigner);
        assertEq(verifier.casperSigner(), newSigner);

        // Non-owner cannot update
        vm.prank(user);
        vm.expectRevert();
        verifier.updateSigner(address(0xDEAD));
    }

    function test_revokeAttestation_onlyOwner() public {
        bytes32 attestationId = keccak256("some-attestation");

        // Owner can revoke
        verifier.revokeAttestation(attestationId);
        assertTrue(verifier.revokedAttestations(attestationId));

        // Non-owner cannot revoke
        vm.prank(user);
        vm.expectRevert();
        verifier.revokeAttestation(keccak256("other"));
    }

    // ============ TIER TESTS ============

    function test_allTiers() public {
        // Test each tier level
        uint256[] memory stakes = new uint256[](5);
        stakes[0] = 50 * 1e9;      // None (< 100 CSPR)
        stakes[1] = 100 * 1e9;     // Bronze
        stakes[2] = 1000 * 1e9;    // Silver
        stakes[3] = 10000 * 1e9;   // Gold
        stakes[4] = 100000 * 1e9;  // Platinum

        for (uint i = 0; i < 5; i++) {
            address testUser = address(uint160(0x1000 + i));
            _createAndVerifyAttestation(testUser, stakes[i], uint8(i));
            assertEq(uint(verifier.getTier(testUser)), i);
        }
    }

    // ============ HELPERS ============

    function _createAndVerifyAttestation(address targetUser, uint256 stake, uint8 tier) internal {
        bytes32 casperAddressHash = keccak256(abi.encodePacked(targetUser));
        string memory targetAddress = _addressToString(targetUser);
        uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);

        bytes memory attestation = abi.encode(
            casperAddressHash, "base-sepolia", targetAddress,
            stake, tier, uint64(0), uint64(block.timestamp * 1000), expiresAt, uint64(0)
        );

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(targetUser);
        verifier.verifyAndStore(attestation, signature);
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
