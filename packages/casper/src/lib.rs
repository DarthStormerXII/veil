#![no_std]

extern crate alloc;

pub mod types;
pub mod veil_attestation;

pub use types::*;
pub use veil_attestation::VeilAttestation;

#[cfg(test)]
mod tests {
    use alloc::string::ToString;
    use odra::host::{Deployer, HostEnv};
    use odra::casper_types::bytesrepr::Bytes;
    use crate::veil_attestation::{VeilAttestation, VeilAttestationHostRef, VeilAttestationInitArgs};

    // Test private key (matches EVM tests)
    const TEST_PRIVATE_KEY: [u8; 32] = [
        0xac, 0x09, 0x74, 0xbe, 0xc3, 0x9a, 0x17, 0xe3,
        0x6b, 0xa4, 0xa6, 0xb4, 0xd2, 0x38, 0xff, 0x94,
        0x4b, 0xac, 0xb4, 0x78, 0xcb, 0xed, 0x5e, 0xfc,
        0xae, 0x78, 0x4d, 0x7b, 0xf4, 0xf2, 0xff, 0x80,
    ];

    // Expected signer address (Ethereum format)
    const EXPECTED_SIGNER: [u8; 20] = [
        0xf3, 0x9F, 0xd6, 0xe5, 0x1a, 0xad, 0x88, 0xF6,
        0xF4, 0xce, 0x6a, 0xB8, 0x82, 0x72, 0x79, 0xcf,
        0xff, 0xFb, 0x92, 0x26,
    ];

    fn setup() -> (HostEnv, VeilAttestationHostRef) {
        let env = odra_test::env();
        let admin = env.get_account(0);

        let init_args = VeilAttestationInitArgs {
            admin,
            signer_private_key: TEST_PRIVATE_KEY,
        };

        let contract = VeilAttestation::deploy(&env, init_args);
        (env, contract)
    }

    #[test]
    fn test_init_derives_correct_signer_address() {
        let (_, contract) = setup();
        let signer_addr = contract.get_signer_address();

        // Verify first few bytes match expected Ethereum address
        assert_eq!(&signer_addr[..4], &EXPECTED_SIGNER[..4],
            "Signer address derivation failed");
    }

    #[test]
    fn test_create_attestation_returns_valid_signature() {
        let (env, mut contract) = setup();

        let target_chain = "base-sepolia".to_string();
        let target_address = "0x1234567890abcdef1234567890abcdef12345678".to_string();

        env.set_caller(env.get_account(1));
        let (attestation_id, signature) = contract.create_attestation(
            target_chain.clone(),
            target_address.clone(),
        );

        // Verify attestation ID is not zero
        assert_ne!(attestation_id, [0u8; 32], "Attestation ID should not be zero");

        // Verify signature is 65 bytes
        assert_eq!(signature.len(), 65, "Signature should be 65 bytes");

        // Verify v value is 27 or 28
        let v = signature[64];
        assert!(v == 27 || v == 28, "v should be 27 or 28, got {}", v);
    }

    #[test]
    fn test_create_attestation_stores_data() {
        let (env, mut contract) = setup();
        let caller = env.get_account(1);

        let target_chain = "base-sepolia".to_string();
        let target_address = "0xabcdef1234567890abcdef1234567890abcdef12".to_string();

        env.set_caller(caller);
        let (attestation_id, _) = contract.create_attestation(
            target_chain.clone(),
            target_address.clone(),
        );

        // Retrieve attestation
        let attestation = contract.get_attestation(attestation_id)
            .expect("Attestation should exist");

        assert_eq!(attestation.target_chain, target_chain);
        assert_eq!(attestation.target_address, target_address);
        assert_eq!(attestation.casper_address, caller);
        assert!(!attestation.revoked);
    }

    #[test]
    fn test_get_user_attestations() {
        let (env, mut contract) = setup();
        let caller = env.get_account(1);

        env.set_caller(caller);

        // Create multiple attestations
        contract.create_attestation(
            "base-sepolia".to_string(),
            "0x1111111111111111111111111111111111111111".to_string(),
        );
        contract.create_attestation(
            "base-sepolia".to_string(),
            "0x2222222222222222222222222222222222222222".to_string(),
        );

        let attestations = contract.get_user_attestations(caller);
        assert_eq!(attestations.len(), 2);
    }

    #[test]
    fn test_revoke_attestation() {
        let (env, mut contract) = setup();
        let caller = env.get_account(1);

        env.set_caller(caller);
        let (attestation_id, _) = contract.create_attestation(
            "base-sepolia".to_string(),
            "0x1234567890abcdef1234567890abcdef12345678".to_string(),
        );

        // Revoke
        contract.revoke_attestation(attestation_id);

        // Verify revoked
        let attestation = contract.get_attestation(attestation_id)
            .expect("Attestation should exist");
        assert!(attestation.revoked);
    }

    #[test]
    #[should_panic(expected = "VmError")]
    fn test_revoke_others_attestation_fails() {
        let (env, mut contract) = setup();

        // User 1 creates attestation
        env.set_caller(env.get_account(1));
        let (attestation_id, _) = contract.create_attestation(
            "base-sepolia".to_string(),
            "0x1234567890abcdef1234567890abcdef12345678".to_string(),
        );

        // User 2 tries to revoke - should fail
        env.set_caller(env.get_account(2));
        contract.revoke_attestation(attestation_id);
    }

    #[test]
    #[should_panic(expected = "VmError")]
    fn test_invalid_evm_address_rejected() {
        let (env, mut contract) = setup();

        env.set_caller(env.get_account(1));
        contract.create_attestation(
            "base-sepolia".to_string(),
            "not-an-address".to_string(), // Invalid - should panic
        );
    }

    #[test]
    fn test_nonce_increments() {
        let (env, mut contract) = setup();
        let caller = env.get_account(1);

        env.set_caller(caller);

        // First attestation
        let (id1, _) = contract.create_attestation(
            "base-sepolia".to_string(),
            "0x1111111111111111111111111111111111111111".to_string(),
        );

        // Second attestation
        let (id2, _) = contract.create_attestation(
            "base-sepolia".to_string(),
            "0x2222222222222222222222222222222222222222".to_string(),
        );

        let att1 = contract.get_attestation(id1).unwrap();
        let att2 = contract.get_attestation(id2).unwrap();

        assert_eq!(att1.nonce, 0);
        assert_eq!(att2.nonce, 1);
    }

    #[test]
    fn test_tier_calculation() {
        let (env, contract) = setup();
        let user = env.get_account(1);

        // With zero stake (query_user_stake returns 0 for MVP)
        let tier = contract.get_user_tier(user);

        // Should be None tier
        assert_eq!(tier as u8, 0);
    }
}
