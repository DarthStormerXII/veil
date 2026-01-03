use alloc::string::String;
use odra::prelude::*;
use odra::casper_types::U512;

/// Tier levels based on stake amount
#[odra::odra_type]
#[derive(Copy, Default)]
pub enum Tier {
    #[default]
    None = 0,
    Bronze = 1,     // 100+ CSPR
    Silver = 2,     // 1,000+ CSPR
    Gold = 3,       // 10,000+ CSPR
    Platinum = 4,   // 100,000+ CSPR
    Validator = 5,  // Active validator
}

/// Attestation record stored on Casper
#[odra::odra_type]
pub struct Attestation {
    pub id: [u8; 32],
    pub casper_address: Address,
    pub target_chain: String,
    pub target_address: String,
    pub stake_amount: U512,
    pub tier: Tier,
    pub account_age_days: u64,
    pub created_at: u64,
    pub expires_at: u64,
    pub nonce: u64,
    pub revoked: bool,
}

/// Payload that gets signed and sent to EVM
#[odra::odra_type]
pub struct AttestationPayload {
    pub casper_address_hash: [u8; 32],
    pub target_chain: String,
    pub target_address: String,
    pub stake_amount: U512,
    pub tier: u8,
    pub account_age_days: u64,
    pub created_at: u64,
    pub expires_at: u64,
    pub nonce: u64,
}

/// Event emitted when attestation is created
#[odra::event]
pub struct AttestationCreated {
    pub id: [u8; 32],
    pub casper_address: Address,
    pub target_chain: String,
    pub target_address: String,
    pub tier: u8,
    pub expires_at: u64,
}

/// Event emitted when attestation is revoked
#[odra::event]
pub struct AttestationRevoked {
    pub id: [u8; 32],
    pub casper_address: Address,
}
