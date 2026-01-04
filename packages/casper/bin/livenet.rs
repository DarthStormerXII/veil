//! Livenet deployment script for Veil Attestation contract
//!
//! Usage:
//!   cargo run --bin veil_attestation_livenet --features livenet

use odra::host::Deployer;
use odra::prelude::Addressable;

use veil_attestation::veil_attestation::{VeilAttestation, VeilAttestationInitArgs};

// Signer private key for attestation signing (secp256k1)
// This should match the expected signer in the EVM verifier contract
const SIGNER_PRIVATE_KEY: [u8; 32] = [
    0xac, 0x09, 0x74, 0xbe, 0xc3, 0x9a, 0x17, 0xe3,
    0x6b, 0xa4, 0xa6, 0xb4, 0xd2, 0x38, 0xff, 0x94,
    0x4b, 0xac, 0xb4, 0x78, 0xcb, 0xed, 0x5e, 0xfc,
    0xae, 0x78, 0x4d, 0x7b, 0xf4, 0xf2, 0xff, 0x80,
];

fn main() {
    println!("=== Veil Attestation Livenet Deployment ===\n");

    // Load the Casper livenet environment
    let env = odra_casper_livenet_env::env();

    // Get deployer account (from secret key in Odra.toml)
    let deployer = env.caller();
    println!("Deployer account: {:?}", deployer);

    // Deploy VeilAttestation
    println!("\nDeploying VeilAttestation...");
    let init_args = VeilAttestationInitArgs {
        admin: deployer.clone(),
        signer_private_key: SIGNER_PRIVATE_KEY,
    };

    env.set_gas(450_000_000_000u64); // 450 CSPR gas
    let contract = VeilAttestation::deploy(&env, init_args);
    let contract_address = contract.address();
    println!("VeilAttestation deployed at: {:?}", contract_address);

    // Get signer address
    let signer_address = contract.get_signer_address();
    println!("Signer Ethereum address: 0x{}", hex::encode(signer_address));

    // Summary
    println!("\n=== Deployment Complete ===");
    println!("Contract: {:?}", contract_address);
    println!("\nUpdate deployed-addresses.json with this address!");
}
