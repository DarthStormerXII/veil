use alloc::string::String;
use alloc::vec::Vec;
use odra::prelude::*;
use odra::casper_types::U512;
use odra::casper_types::bytesrepr::Bytes;
use sha3::{Keccak256, Digest};
use k256::ecdsa::SigningKey;

use crate::types::{Attestation, AttestationCreated, AttestationPayload, AttestationRevoked, Tier};

// Helper: left-pad bytes to 32 bytes
fn pad_left_32(data: &[u8]) -> [u8; 32] {
    let mut padded = [0u8; 32];
    let start = 32 - data.len();
    padded[start..].copy_from_slice(data);
    padded
}

// Helper: convert U512 to 32-byte big-endian array
fn u512_to_bytes32(value: &U512) -> [u8; 32] {
    let mut bytes = [0u8; 64];
    value.to_big_endian(&mut bytes);
    // Take the lower 32 bytes (U512 is 64 bytes but stake fits in U256)
    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes[32..64]);
    result
}

/// Veil Attestation Contract
/// Creates cryptographically signed attestations of user's Casper identity
/// that can be verified on EVM chains.
#[odra::module]
pub struct VeilAttestation {
    /// Attestation storage by ID
    attestations: Mapping<[u8; 32], Attestation>,
    /// User's attestation IDs
    user_attestations: Mapping<Address, Vec<[u8; 32]>>,
    /// User nonces for replay protection
    user_nonces: Mapping<Address, u64>,

    /// Signer private key (secp256k1)
    signer_private_key: Var<[u8; 32]>,
    /// Signer public key (uncompressed, 64 bytes)
    signer_public_key: Var<[u8; 64]>,

    /// Admin address
    admin: Var<Address>,

    /// Attestation validity period in seconds
    attestation_validity_secs: Var<u64>,
}

#[odra::module]
impl VeilAttestation {
    /// Initialize the contract
    #[odra(init)]
    pub fn init(&mut self, admin: Address, signer_private_key: [u8; 32]) {
        self.admin.set(admin);
        self.signer_private_key.set(signer_private_key);

        // Derive public key from private key using k256
        let signing_key = SigningKey::from_bytes(&signer_private_key.into())
            .expect("Invalid private key");
        let verifying_key = signing_key.verifying_key();
        let public_key_point = verifying_key.to_encoded_point(false);

        // Take 64 bytes (skip 0x04 prefix)
        let mut pubkey = [0u8; 64];
        pubkey.copy_from_slice(&public_key_point.as_bytes()[1..65]);
        self.signer_public_key.set(pubkey);

        // 7 days default validity
        self.attestation_validity_secs.set(7 * 24 * 60 * 60);
    }

    /// Create a new attestation for the caller
    pub fn create_attestation(
        &mut self,
        target_chain: String,
        target_address: String,
    ) -> ([u8; 32], Bytes) {
        let caller = self.env().caller();

        // Validate target address format
        assert!(
            target_address.starts_with("0x") && target_address.len() == 42,
            "Invalid EVM address format"
        );

        // Query user's stake
        let stake_amount = self.query_user_stake(caller);

        // Calculate tier based on stake
        let tier = self.calculate_tier(stake_amount);

        // Get and increment nonce
        let nonce = self.user_nonces.get(&caller).unwrap_or(0);
        self.user_nonces.set(&caller, nonce + 1);

        // Timestamps
        let now = self.env().get_block_time();
        let validity = self.attestation_validity_secs.get().unwrap_or(604800);
        let expires_at = now + (validity * 1000);

        // Create payload
        let payload = AttestationPayload {
            casper_address_hash: self.hash_address(caller),
            target_chain: target_chain.clone(),
            target_address: target_address.clone(),
            stake_amount,
            tier: tier as u8,
            account_age_days: 0, // Skipped for MVP
            created_at: now,
            expires_at,
            nonce,
        };

        // Encode and hash payload
        let encoded = self.abi_encode_payload(&payload);
        let attestation_id = self.keccak256(&encoded);

        // Sign the message
        let signature = self.sign_message(&attestation_id);

        // Store attestation
        let attestation = Attestation {
            id: attestation_id,
            casper_address: caller,
            target_chain: target_chain.clone(),
            target_address: target_address.clone(),
            stake_amount,
            tier,
            account_age_days: 0,
            created_at: now,
            expires_at,
            nonce,
            revoked: false,
        };

        self.attestations.set(&attestation_id, attestation);

        // Track user's attestations
        let mut user_atts = self.user_attestations.get(&caller).unwrap_or_default();
        user_atts.push(attestation_id);
        self.user_attestations.set(&caller, user_atts);

        // Emit event
        self.env().emit_event(AttestationCreated {
            id: attestation_id,
            casper_address: caller,
            target_chain,
            target_address,
            tier: tier as u8,
            expires_at,
        });

        (attestation_id, signature)
    }

    /// Revoke an attestation
    pub fn revoke_attestation(&mut self, attestation_id: [u8; 32]) {
        let caller = self.env().caller();

        let mut attestation = self.attestations.get(&attestation_id)
            .expect("Attestation not found");

        assert!(attestation.casper_address == caller, "Not your attestation");
        assert!(!attestation.revoked, "Already revoked");

        attestation.revoked = true;
        self.attestations.set(&attestation_id, attestation);

        self.env().emit_event(AttestationRevoked {
            id: attestation_id,
            casper_address: caller,
        });
    }

    // ============ VIEW FUNCTIONS ============

    /// Get attestation by ID
    pub fn get_attestation(&self, id: [u8; 32]) -> Option<Attestation> {
        self.attestations.get(&id)
    }

    /// Get all attestations for a user
    pub fn get_user_attestations(&self, user: Address) -> Vec<Attestation> {
        let ids = self.user_attestations.get(&user).unwrap_or_default();
        ids.iter()
            .filter_map(|id| self.attestations.get(id))
            .collect()
    }

    /// Get user's current tier
    pub fn get_user_tier(&self, user: Address) -> Tier {
        let stake = self.query_user_stake(user);
        self.calculate_tier(stake)
    }

    /// Get the signer's Ethereum-style address
    pub fn get_signer_address(&self) -> [u8; 20] {
        let pubkey = self.signer_public_key.get().expect("Signer not set");
        let hash = self.keccak256(&pubkey);
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&hash[12..32]);
        addr
    }

    /// Get ABI-encoded attestation data for EVM submission
    /// Returns (encoded_attestation, signature) that can be directly submitted to VeilVerifier
    pub fn get_attestation_for_evm(&self, id: [u8; 32]) -> Option<(Bytes, Bytes)> {
        let attestation = self.attestations.get(&id)?;

        // Reconstruct the payload
        let payload = AttestationPayload {
            casper_address_hash: self.hash_address(attestation.casper_address),
            target_chain: attestation.target_chain.clone(),
            target_address: attestation.target_address.clone(),
            stake_amount: attestation.stake_amount,
            tier: attestation.tier as u8,
            account_age_days: attestation.account_age_days,
            created_at: attestation.created_at,
            expires_at: attestation.expires_at,
            nonce: attestation.nonce,
        };

        // ABI encode
        let encoded = self.abi_encode_payload(&payload);

        // Sign
        let attestation_id = self.keccak256(&encoded);
        let signature = self.sign_message(&attestation_id);

        Some((Bytes::from(encoded), signature))
    }

    // ============ INTERNAL FUNCTIONS ============

    fn query_user_stake(&self, _user: Address) -> U512 {
        // TODO: Query System Auction for user's delegated stake
        // For MVP, return placeholder
        U512::zero()
    }

    fn calculate_tier(&self, stake_motes: U512) -> Tier {
        let stake_cspr = stake_motes / U512::from(1_000_000_000u64);

        if stake_cspr >= U512::from(100_000u64) {
            Tier::Platinum
        } else if stake_cspr >= U512::from(10_000u64) {
            Tier::Gold
        } else if stake_cspr >= U512::from(1_000u64) {
            Tier::Silver
        } else if stake_cspr >= U512::from(100u64) {
            Tier::Bronze
        } else {
            Tier::None
        }
    }

    fn hash_address(&self, address: Address) -> [u8; 32] {
        // Get the account hash bytes from the Address
        // Address in Odra wraps an AccountHash
        let bytes = address.to_string().into_bytes();
        self.keccak256(&bytes)
    }

    fn keccak256(&self, data: &[u8]) -> [u8; 32] {
        let mut hasher = Keccak256::new();
        hasher.update(data);
        let result = hasher.finalize();
        let mut output = [0u8; 32];
        output.copy_from_slice(&result);
        output
    }

    fn abi_encode_payload(&self, payload: &AttestationPayload) -> Vec<u8> {
        // Layout:
        // [0]    bytes32 casperAddressHash   - 32 bytes
        // [1]    offset to targetChain       - 32 bytes (pointer)
        // [2]    offset to targetAddress     - 32 bytes (pointer)
        // [3]    uint256 stake               - 32 bytes
        // [4]    uint8 tier (as uint256)     - 32 bytes
        // [5]    uint64 accountAgeDays       - 32 bytes
        // [6]    uint64 createdAt            - 32 bytes
        // [7]    uint64 expiresAt            - 32 bytes
        // [8]    uint64 nonce                - 32 bytes
        // [9+]   dynamic data for strings

        let mut encoded = Vec::new();

        // [0] bytes32 casperAddressHash
        encoded.extend_from_slice(&payload.casper_address_hash);

        // Calculate offsets for dynamic data
        // Head size = 9 slots × 32 bytes = 288 bytes
        let head_size = 9 * 32;
        let chain_offset = head_size;
        let chain_len = payload.target_chain.len();
        let chain_padded = ((chain_len + 31) / 32) * 32;
        let address_offset = chain_offset + 32 + chain_padded; // length slot + padded data

        // [1] offset to targetChain
        encoded.extend_from_slice(&pad_left_32(&chain_offset.to_be_bytes()));

        // [2] offset to targetAddress
        encoded.extend_from_slice(&pad_left_32(&address_offset.to_be_bytes()));

        // [3] uint256 stake - convert U512 to 32 bytes big-endian
        let stake_bytes = u512_to_bytes32(&payload.stake_amount);
        encoded.extend_from_slice(&stake_bytes);

        // [4] uint8 tier (encoded as uint256)
        encoded.extend_from_slice(&pad_left_32(&[payload.tier]));

        // [5] uint64 accountAgeDays
        encoded.extend_from_slice(&pad_left_32(&payload.account_age_days.to_be_bytes()));

        // [6] uint64 createdAt
        encoded.extend_from_slice(&pad_left_32(&payload.created_at.to_be_bytes()));

        // [7] uint64 expiresAt
        encoded.extend_from_slice(&pad_left_32(&payload.expires_at.to_be_bytes()));

        // [8] uint64 nonce
        encoded.extend_from_slice(&pad_left_32(&payload.nonce.to_be_bytes()));

        // Dynamic data: targetChain
        let chain_bytes = payload.target_chain.as_bytes();
        encoded.extend_from_slice(&pad_left_32(&chain_bytes.len().to_be_bytes()));
        encoded.extend_from_slice(chain_bytes);
        // Pad to 32-byte boundary
        let padding = chain_padded - chain_len;
        encoded.extend_from_slice(&alloc::vec![0u8; padding]);

        // Dynamic data: targetAddress
        let addr_bytes = payload.target_address.as_bytes();
        let addr_padded = ((addr_bytes.len() + 31) / 32) * 32;
        encoded.extend_from_slice(&pad_left_32(&addr_bytes.len().to_be_bytes()));
        encoded.extend_from_slice(addr_bytes);
        let addr_padding = addr_padded - addr_bytes.len();
        encoded.extend_from_slice(&alloc::vec![0u8; addr_padding]);

        encoded
    }

    fn sign_message(&self, message_hash: &[u8; 32]) -> Bytes {
        // Ethereum personal_sign prefix
        let prefix = b"\x19Ethereum Signed Message:\n32";
        let mut prefixed = Vec::with_capacity(prefix.len() + 32);
        prefixed.extend_from_slice(prefix);
        prefixed.extend_from_slice(message_hash);

        // Hash the prefixed message
        let eth_hash = self.keccak256(&prefixed);

        // Get private key and sign
        let private_key = self.signer_private_key.get().expect("Signer not set");
        let signing_key = SigningKey::from_bytes(&private_key.into()).expect("Invalid key");

        // Sign with recoverable signature
        let (signature, recovery_id) = signing_key
            .sign_prehash_recoverable(&eth_hash)
            .expect("Signing failed");

        // Return 65-byte signature: r (32) + s (32) + v (1)
        let mut sig_bytes = Vec::with_capacity(65);
        sig_bytes.extend_from_slice(&signature.to_bytes());
        sig_bytes.push(recovery_id.to_byte() + 27); // v = recovery_id + 27

        Bytes::from(sig_bytes)
    }
}
