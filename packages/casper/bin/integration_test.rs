//! Integration test for cross-chain attestation flow
//!
//! Tests the full flow:
//! 1. Create attestation on Casper
//! 2. Get signature
//! 3. (Manual) Submit to EVM
//!
//! Usage:
//!   cargo run --bin veil_attestation_integration_test --features livenet

use std::str::FromStr;
use odra::prelude::*;
use odra::host::HostRefLoader;
use veil_attestation::veil_attestation::VeilAttestation;

fn main() {
    println!("=== Veil Identity Bridge Integration Test ===\n");

    // Load the Casper livenet environment
    let env = odra_casper_livenet_env::env();

    // Get the deployed contract (use hash- prefix for Odra Address parsing)
    let contract_hash = "hash-add1c58f0a9878d0050bc1178c369ef62623d86b15e2e657567f54dfe5a2fc67";
    println!("Connecting to VeilAttestation at: {}", contract_hash);

    // Parse contract address
    let contract_address = Address::from_str(contract_hash)
        .expect("Invalid contract address");

    // Load existing contract
    let mut contract = VeilAttestation::load(&env, contract_address);

    // Test 1: Get signer address
    println!("\n[Test 1] Getting signer address...");
    let signer_addr = contract.get_signer_address();
    println!("Signer address: 0x{}", hex::encode(signer_addr));
    assert_eq!(
        hex::encode(signer_addr).to_lowercase(),
        "f39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "Signer address mismatch!"
    );
    println!("✅ Signer address matches expected");

    // Test 2: Create attestation
    println!("\n[Test 2] Creating attestation...");
    let target_chain = "base-sepolia".to_string();
    // Use a test EVM address (the deployer wallet)
    let target_address = "0xff528c955a9b70e5edfdd65643163f93d72cdc38".to_string();

    env.set_gas(50_000_000_000u64); // 50 CSPR for the call
    let (attestation_id, signature) = contract.create_attestation(
        target_chain.clone(),
        target_address.clone(),
    );

    println!("Attestation ID: 0x{}", hex::encode(attestation_id));
    println!("Signature ({} bytes): 0x{}", signature.len(), hex::encode(&signature));
    assert_eq!(signature.len(), 65, "Signature should be 65 bytes");
    println!("✅ Attestation created successfully");

    // Test 3: Verify attestation stored
    println!("\n[Test 3] Verifying attestation stored...");
    let attestation = contract.get_attestation(attestation_id)
        .expect("Attestation should exist");

    println!("  Target chain: {}", attestation.target_chain);
    println!("  Target address: {}", attestation.target_address);
    println!("  Tier: {:?}", attestation.tier);
    println!("  Revoked: {}", attestation.revoked);
    assert!(!attestation.revoked, "Attestation should not be revoked");
    println!("✅ Attestation verified");

    // Test 4: Get user tier
    println!("\n[Test 4] Getting user tier...");
    let caller = env.caller();
    let tier = contract.get_user_tier(caller);
    println!("User tier: {:?}", tier);
    println!("✅ User tier retrieved");

    // Summary for EVM submission
    println!("\n=== EVM Submission Data ===");
    println!("To verify on Base Sepolia VeilVerifier:");
    println!("  Attestation ID: 0x{}", hex::encode(attestation_id));
    println!("  Signature: 0x{}", hex::encode(&signature));
    println!("\n=== All Tests Passed ===");
}
