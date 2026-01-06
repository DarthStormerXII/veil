// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VeilVerifier.sol";

/// @title Integration test for cross-chain attestation
/// @dev This script tests the full flow of attestation verification
contract IntegrationTest is Script {
    // VeilVerifier address on Base Sepolia
    address constant VERIFIER = 0x0a3A0d3407acb40D11af9539a1c016E44deca4A0;

    // Test signer private key (same as Casper contract)
    uint256 constant SIGNER_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(deployerPrivateKey);

        console.log("=== Cross-Chain Integration Test ===");
        console.log("User address:", user);

        VeilVerifier verifier = VeilVerifier(VERIFIER);
        console.log("VeilVerifier address:", address(verifier));
        console.log("Casper signer:", verifier.casperSigner());

        // Check if user is already verified
        bool isVerified = verifier.isVerified(user);
        console.log("Already verified:", isVerified);

        if (!isVerified) {
            // Create test attestation data (simulating what Casper would create)
            bytes32 casperAddressHash = keccak256(abi.encodePacked("test-casper-account"));
            string memory targetChain = "base-sepolia";
            string memory targetAddress = _addressToString(user);
            uint256 stake = 0;
            uint8 tier = 0;
            uint64 accountAgeDays = 0;
            uint64 createdAt = uint64(block.timestamp * 1000);
            uint64 expiresAt = uint64((block.timestamp + 7 days) * 1000);
            uint64 nonce = 0;

            // Encode the attestation
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

            console.log("Attestation encoded, length:", attestation.length);

            // Sign the attestation hash
            bytes32 messageHash = keccak256(attestation);
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

            (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, ethSignedHash);
            bytes memory signature = abi.encodePacked(r, s, v);

            console.log("Signature created, length:", signature.length);

            // Verify and store
            vm.startBroadcast(deployerPrivateKey);

            bool success = verifier.verifyAndStore(attestation, signature);
            console.log("verifyAndStore result:", success);

            vm.stopBroadcast();
        }

        // Check final state
        VeilVerifier.Tier userTier = verifier.getTier(user);
        uint256 userStake = verifier.getStake(user);
        bool finalVerified = verifier.isVerified(user);

        console.log("\n=== Final State ===");
        console.log("User verified:", finalVerified);
        console.log("User tier:", uint256(userTier));
        console.log("User stake:", userStake);

        console.log("\n=== Integration Test Complete ===");
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
