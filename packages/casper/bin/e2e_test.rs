//! End-to-End Cross-Chain Test
//!
//! This test performs the FULL cross-chain flow:
//! 1. Creates an attestation on Casper localnet
//! 2. Gets the ABI-encoded attestation data
//! 3. Submits it to local Anvil EVM
//! 4. Verifies the identity was stored correctly
//!
//! Prerequisites:
//!   - Casper localnet running (docker)
//!   - Anvil running on port 8545
//!   - VeilAttestation deployed on Casper
//!   - VeilVerifier deployed on Anvil
//!
//! Usage:
//!   cargo run --bin veil_attestation_e2e_test --features livenet

use std::str::FromStr;
use std::process::Command;
use odra::prelude::*;
use odra::host::HostRefLoader;
use veil_attestation::veil_attestation::VeilAttestation;

// VeilVerifier ABI for calling verifyAndStore
const VEIL_VERIFIER_ADDRESS: &str = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ANVIL_RPC: &str = "http://127.0.0.1:8545";
// Anvil account[1] - different from signer to test properly
const EVM_USER_PRIVATE_KEY: &str = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const EVM_USER_ADDRESS: &str = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

fn main() {
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║     VEIL IDENTITY BRIDGE - END-TO-END CROSS-CHAIN TEST      ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // ========== STEP 1: Connect to Casper Localnet ==========
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("STEP 1: Connecting to Casper Localnet");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let env = odra_casper_livenet_env::env();
    let contract_hash = "hash-51c2d7ae1adb41abeab6ea975d376c5a3c95323cb514c08112adbbea95b5501f";

    println!("  Contract: {}", contract_hash);

    let contract_address = Address::from_str(contract_hash)
        .expect("Invalid contract address");
    let mut contract = VeilAttestation::load(&env, contract_address);

    let signer_addr = contract.get_signer_address();
    println!("  Signer:   0x{}", hex::encode(signer_addr));
    println!("  ✓ Connected to Casper VeilAttestation\n");

    // ========== STEP 2: Create Attestation on Casper ==========
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("STEP 2: Creating Attestation on Casper");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let target_chain = "anvil-local".to_string();
    let target_address = EVM_USER_ADDRESS.to_lowercase();

    println!("  Target Chain:   {}", target_chain);
    println!("  Target Address: {}", target_address);

    env.set_gas(50_000_000_000u64);
    let (attestation_id, _initial_sig) = contract.create_attestation(
        target_chain.clone(),
        target_address.clone(),
    );

    println!("  Attestation ID: 0x{}", hex::encode(attestation_id));
    println!("  ✓ Attestation created on Casper\n");

    // ========== STEP 3: Get ABI-Encoded Data for EVM ==========
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("STEP 3: Getting ABI-Encoded Data for EVM");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let (encoded_attestation, signature) = contract.get_attestation_for_evm(attestation_id)
        .expect("Failed to get attestation for EVM");

    println!("  Encoded Attestation: {} bytes", encoded_attestation.len());
    println!("  Signature:           {} bytes", signature.len());

    let attestation_hex = hex::encode(&encoded_attestation);
    let signature_hex = hex::encode(&signature);

    println!("  ✓ Data ready for EVM submission\n");

    // ========== STEP 4: Submit to Local Anvil EVM ==========
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("STEP 4: Submitting to Local Anvil EVM");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    println!("  VeilVerifier: {}", VEIL_VERIFIER_ADDRESS);
    println!("  User:         {}", EVM_USER_ADDRESS);

    // Use cast to call the contract
    let output = Command::new("cast")
        .args([
            "send",
            VEIL_VERIFIER_ADDRESS,
            "verifyAndStore(bytes,bytes)",
            &format!("0x{}", attestation_hex),
            &format!("0x{}", signature_hex),
            "--rpc-url", ANVIL_RPC,
            "--private-key", EVM_USER_PRIVATE_KEY,
        ])
        .output()
        .expect("Failed to execute cast command");

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("  ✗ Transaction failed: {}", stderr);
        panic!("EVM transaction failed");
    }

    println!("  ✓ Transaction submitted successfully\n");

    // ========== STEP 5: Verify Identity on EVM ==========
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("STEP 5: Verifying Identity on EVM");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Check isVerified
    let is_verified = Command::new("cast")
        .args([
            "call",
            VEIL_VERIFIER_ADDRESS,
            "isVerified(address)(bool)",
            EVM_USER_ADDRESS,
            "--rpc-url", ANVIL_RPC,
        ])
        .output()
        .expect("Failed to call isVerified");

    let verified_result = String::from_utf8_lossy(&is_verified.stdout).trim().to_string();
    println!("  isVerified: {}", verified_result);

    // Check getTier
    let tier = Command::new("cast")
        .args([
            "call",
            VEIL_VERIFIER_ADDRESS,
            "getTier(address)(uint8)",
            EVM_USER_ADDRESS,
            "--rpc-url", ANVIL_RPC,
        ])
        .output()
        .expect("Failed to call getTier");

    let tier_result = String::from_utf8_lossy(&tier.stdout).trim().to_string();
    println!("  Tier:       {}", tier_result);

    // Check getStake
    let stake = Command::new("cast")
        .args([
            "call",
            VEIL_VERIFIER_ADDRESS,
            "getStake(address)(uint256)",
            EVM_USER_ADDRESS,
            "--rpc-url", ANVIL_RPC,
        ])
        .output()
        .expect("Failed to call getStake");

    let stake_result = String::from_utf8_lossy(&stake.stdout).trim().to_string();
    println!("  Stake:      {}", stake_result);

    // Verify results
    assert!(verified_result.contains("true"), "User should be verified!");

    println!("  ✓ Identity verified on EVM\n");

    // ========== SUCCESS ==========
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║              ✓ END-TO-END TEST PASSED                       ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  1. Created attestation on Casper localnet                   ║");
    println!("║  2. ABI-encoded attestation data                             ║");
    println!("║  3. Submitted to local Anvil EVM                             ║");
    println!("║  4. Verified identity stored correctly                       ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
}
