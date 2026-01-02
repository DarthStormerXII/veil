# Veil - Cross-Chain Identity - Technical Specification
## Claude Code Implementation Guide

**Target:** Casper Network 2.0 Testnet + EVM Testnet (Sepolia)  
**Frameworks:** Odra (Rust) + Solidity  
**Track:** Interoperability ($2,500)  

---

## 1. What We're Building

A cross-chain identity protocol where:
1. User creates attestation on Casper proving their stake/age/tier
2. Attestation is cryptographically signed by contract
3. User submits attestation to EVM chain
4. EVM verifier validates signature and stores verified identity
5. dApps query verifier to check user's Casper identity

**Key Innovation:** Proves identity WITHOUT bridging any assets. No bridge risk, no liquidity needed.

---

## 2. MVP Scope (Build This Only)

| Feature | Include | Exclude |
|---------|---------|---------|
| Create attestation on Casper | ✅ | |
| Query stake from System Auction | ✅ | |
| Calculate tier | ✅ | |
| Sign attestation (secp256k1) | ✅ | Ed25519 (complex on EVM) |
| Verify on EVM (Sepolia) | ✅ | |
| Store verified identity | ✅ | |
| Query functions | ✅ | |
| Revoke attestation | ✅ | |
| Range proofs | | ✅ (skip) |
| Multi-chain verifiers | | ✅ (skip) |
| Relayer service | | ✅ (skip - manual) |

---

## 3. Architecture Overview

```
CASPER NETWORK                           EVM NETWORK (Sepolia)
═══════════════                          ════════════════════

┌─────────────────────┐                  ┌─────────────────────┐
│  Veil Attestation    │                  │   Veil Verifier      │
│  Contract (Odra)    │                  │   Contract (Sol)    │
│                     │                  │                     │
│  - Query stake      │   attestation    │  - Verify signature │
│  - Calculate tier   │  ────────────►   │  - Store identity   │
│  - Sign attestation │   (user carries) │  - Query functions  │
│  - Store records    │                  │                     │
└─────────────────────┘                  └─────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────────┐                  ┌─────────────────────┐
│   System Auction    │                  │   Consuming dApps   │
│   (query stake)     │                  │   (query identity)  │
└─────────────────────┘                  └─────────────────────┘
```

---

## 4. Casper Contract (Odra)

### 4.1 Data Structures

```rust
// types.rs
use odra::prelude::*;
use odra::casper_types::{U512, U256, PublicKey};

#[odra::odra_type]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    None = 0,
    Bronze = 1,     // 100+ CSPR, 30+ days
    Silver = 2,     // 1,000+ CSPR, 90+ days  
    Gold = 3,       // 10,000+ CSPR, 180+ days
    Platinum = 4,   // 100,000+ CSPR, 365+ days
    Validator = 5,  // Active validator
}

#[odra::odra_type]
pub struct Attestation {
    pub id: [u8; 32],              // keccak256 hash
    pub casper_address: Address,
    pub target_chain: String,       // "ethereum", "sepolia"
    pub target_address: String,     // "0x..." EVM address
    pub stake_amount: U512,         // In motes
    pub tier: Tier,
    pub account_age_days: u64,
    pub created_at: u64,            // Block timestamp
    pub expires_at: u64,            // Expiry timestamp
    pub nonce: u64,
    pub revoked: bool,
}

#[odra::odra_type]
pub struct AttestationPayload {
    // This is what gets signed and sent to EVM
    pub casper_address_hash: [u8; 32],  // keccak256(casper_address)
    pub target_chain: String,
    pub target_address: String,
    pub stake_amount: U512,
    pub tier: u8,
    pub account_age_days: u64,
    pub created_at: u64,
    pub expires_at: u64,
    pub nonce: u64,
}
```

### 4.2 Main Contract

```rust
// veil_attestation.rs
use odra::{prelude::*, Var, Mapping, Address};
use odra::casper_types::{U512, U256, PublicKey};

#[odra::module]
pub struct VeilAttestation {
    // Attestation storage
    attestations: Mapping<[u8; 32], Attestation>,
    user_attestations: Mapping<Address, Vec<[u8; 32]>>,
    user_nonces: Mapping<Address, u64>,
    
    // Signing key (secp256k1 for EVM compatibility)
    // In production: use HSM or secure key management
    signer_private_key: Var<[u8; 32]>,
    signer_public_key: Var<[u8; 64]>,  // Uncompressed secp256k1
    
    // Admin
    admin: Var<Address>,
    
    // Config
    attestation_validity_secs: Var<u64>,  // Default: 7 days
}

#[odra::module]
impl VeilAttestation {
    #[odra(init)]
    pub fn init(
        &mut self,
        admin: Address,
        signer_private_key: [u8; 32],
    ) {
        self.admin.set(admin);
        self.signer_private_key.set(signer_private_key);
        
        // Derive public key from private key
        // NOTE: You'll need secp256k1 library
        let public_key = derive_public_key(&signer_private_key);
        self.signer_public_key.set(public_key);
        
        // 7 days default validity
        self.attestation_validity_secs.set(7 * 24 * 60 * 60);
    }

    /// Create a new attestation
    pub fn create_attestation(
        &mut self,
        target_chain: String,
        target_address: String,  // Must be valid EVM address "0x..."
    ) -> ([u8; 32], Vec<u8>) {  // Returns (attestation_id, signature)
        let caller = self.env().caller();
        
        // Validate target address format
        require!(
            target_address.starts_with("0x") && target_address.len() == 42,
            "Invalid EVM address format"
        );
        
        // Query user's stake from System Auction
        let stake_amount = self.query_user_stake(caller);
        
        // Calculate account age
        // NOTE: Getting actual account age requires indexer or estimation
        // For MVP, we can use a simplified approach
        let account_age_days = self.estimate_account_age(caller);
        
        // Calculate tier
        let tier = self.calculate_tier(stake_amount, account_age_days);
        
        // Get nonce
        let nonce = self.user_nonces.get(&caller).unwrap_or(0);
        self.user_nonces.set(&caller, nonce + 1);
        
        // Timestamps
        let now = self.env().get_block_time();
        let validity = self.attestation_validity_secs.get_or_default();
        let expires_at = now + (validity * 1000);  // Convert to ms
        
        // Create attestation payload for signing
        let payload = AttestationPayload {
            casper_address_hash: keccak256(&caller.to_bytes()),
            target_chain: target_chain.clone(),
            target_address: target_address.clone(),
            stake_amount,
            tier: tier as u8,
            account_age_days,
            created_at: now,
            expires_at,
            nonce,
        };
        
        // Encode payload (ABI-compatible for EVM)
        let encoded = self.abi_encode_payload(&payload);
        
        // Hash the encoded payload
        let message_hash = keccak256(&encoded);
        
        // Sign with secp256k1 (Ethereum-compatible)
        let signature = self.sign_message(&message_hash);
        
        // Create attestation ID
        let attestation_id = message_hash;
        
        // Store attestation
        let attestation = Attestation {
            id: attestation_id,
            casper_address: caller,
            target_chain,
            target_address,
            stake_amount,
            tier,
            account_age_days,
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
            target_chain: payload.target_chain,
            target_address: payload.target_address,
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
        
        require!(attestation.casper_address == caller, "Not your attestation");
        require!(!attestation.revoked, "Already revoked");
        
        attestation.revoked = true;
        self.attestations.set(&attestation_id, attestation);
        
        self.env().emit_event(AttestationRevoked {
            id: attestation_id,
            casper_address: caller,
        });
    }

    // ============ VIEW FUNCTIONS ============

    pub fn get_attestation(&self, id: [u8; 32]) -> Option<Attestation> {
        self.attestations.get(&id)
    }

    pub fn get_user_attestations(&self, user: Address) -> Vec<Attestation> {
        let ids = self.user_attestations.get(&user).unwrap_or_default();
        ids.iter()
            .filter_map(|id| self.attestations.get(id))
            .collect()
    }

    pub fn get_user_tier(&self, user: Address) -> Tier {
        let stake = self.query_user_stake(user);
        let age = self.estimate_account_age(user);
        self.calculate_tier(stake, age)
    }

    pub fn get_signer_address(&self) -> [u8; 20] {
        // Return Ethereum-style address derived from public key
        let pubkey = self.signer_public_key.get().expect("Signer not set");
        let hash = keccak256(&pubkey);
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&hash[12..32]);
        addr
    }

    // ============ INTERNAL FUNCTIONS ============

    fn query_user_stake(&self, user: Address) -> U512 {
        // Query System Auction for user's total delegated amount
        // This aggregates across all validators
        
        let auction_hash = ContractHash::from_formatted_str(
            "hash-93d923e336b20a4c4ca14d592b60e5bd3fe330775618290104f9beb326db7ae2"
        ).expect("Invalid auction hash");
        
        // Note: Actual implementation depends on auction API
        // May need to query each validator separately
        // For MVP, can use a simplified approach
        
        // Placeholder - implement based on actual auction API
        U512::zero()
    }

    fn estimate_account_age(&self, user: Address) -> u64 {
        // Getting actual account creation date requires indexer
        // For MVP: Can use a default or require user to provide proof
        // OR: Just skip age requirement and focus on stake
        
        // Placeholder - return 0 or implement with indexer
        0
    }

    fn calculate_tier(&self, stake_motes: U512, age_days: u64) -> Tier {
        // Convert to CSPR (1 CSPR = 1e9 motes)
        let stake_cspr = stake_motes / U512::from(1_000_000_000u64);
        
        // Check thresholds (both stake AND age must meet requirement)
        if stake_cspr >= U512::from(100_000u64) && age_days >= 365 {
            Tier::Platinum
        } else if stake_cspr >= U512::from(10_000u64) && age_days >= 180 {
            Tier::Gold
        } else if stake_cspr >= U512::from(1_000u64) && age_days >= 90 {
            Tier::Silver
        } else if stake_cspr >= U512::from(100u64) && age_days >= 30 {
            Tier::Bronze
        } else {
            Tier::None
        }
    }

    fn abi_encode_payload(&self, payload: &AttestationPayload) -> Vec<u8> {
        // ABI encode for EVM compatibility
        // Format: abi.encodePacked(...)
        
        let mut encoded = Vec::new();
        
        // casper_address_hash (bytes32)
        encoded.extend_from_slice(&payload.casper_address_hash);
        
        // target_chain (string - length prefixed)
        let chain_bytes = payload.target_chain.as_bytes();
        encoded.extend_from_slice(&(chain_bytes.len() as u32).to_be_bytes());
        encoded.extend_from_slice(chain_bytes);
        
        // target_address (string)
        let addr_bytes = payload.target_address.as_bytes();
        encoded.extend_from_slice(&(addr_bytes.len() as u32).to_be_bytes());
        encoded.extend_from_slice(addr_bytes);
        
        // stake_amount (uint256 - big endian)
        encoded.extend_from_slice(&payload.stake_amount.to_bytes_be());
        
        // tier (uint8)
        encoded.push(payload.tier);
        
        // account_age_days (uint64)
        encoded.extend_from_slice(&payload.account_age_days.to_be_bytes());
        
        // created_at (uint64)
        encoded.extend_from_slice(&payload.created_at.to_be_bytes());
        
        // expires_at (uint64)
        encoded.extend_from_slice(&payload.expires_at.to_be_bytes());
        
        // nonce (uint64)
        encoded.extend_from_slice(&payload.nonce.to_be_bytes());
        
        encoded
    }

    fn sign_message(&self, message_hash: &[u8; 32]) -> Vec<u8> {
        let private_key = self.signer_private_key.get().expect("Signer not set");
        
        // Sign with secp256k1 using Ethereum's signing scheme
        // Returns 65 bytes: r (32) + s (32) + v (1)
        
        // NOTE: Need secp256k1 library
        // Example using k256 crate:
        /*
        use k256::ecdsa::{SigningKey, signature::Signer};
        
        let signing_key = SigningKey::from_bytes(&private_key).unwrap();
        let (signature, recovery_id) = signing_key
            .sign_prehash_recoverable(message_hash)
            .unwrap();
        
        let mut sig_bytes = signature.to_bytes().to_vec();
        sig_bytes.push(recovery_id.to_byte() + 27);  // Ethereum v value
        sig_bytes
        */
        
        // Placeholder
        vec![0u8; 65]
    }
}
```

### 4.3 Events

```rust
#[odra::event]
pub struct AttestationCreated {
    pub id: [u8; 32],
    pub casper_address: Address,
    pub target_chain: String,
    pub target_address: String,
    pub tier: u8,
    pub expires_at: u64,
}

#[odra::event]
pub struct AttestationRevoked {
    pub id: [u8; 32],
    pub casper_address: Address,
}
```

---

## 5. EVM Verifier Contract (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VeilVerifier is Ownable {
    using ECDSA for bytes32;

    // Tier enum matching Casper contract
    enum Tier { None, Bronze, Silver, Gold, Platinum, Validator }

    // Verified identity struct
    struct VerifiedIdentity {
        bytes32 casperAddressHash;
        Tier tier;
        uint256 stake;          // In motes (1 CSPR = 1e9)
        uint64 accountAgeDays;
        uint64 verifiedAt;
        uint64 expiresAt;
    }

    // Casper attestation signer address (derived from secp256k1 pubkey)
    address public casperSigner;

    // Verified users
    mapping(address => VerifiedIdentity) public verifiedUsers;
    
    // Used attestations (prevent replay)
    mapping(bytes32 => bool) public usedAttestations;
    
    // Revoked attestations
    mapping(bytes32 => bool) public revokedAttestations;

    // Events
    event IdentityVerified(
        address indexed user,
        bytes32 casperAddressHash,
        Tier tier,
        uint256 stake
    );
    event AttestationRevoked(bytes32 indexed attestationId);
    event SignerUpdated(address newSigner);

    constructor(address _casperSigner) Ownable(msg.sender) {
        casperSigner = _casperSigner;
    }

    /**
     * @notice Verify attestation and store identity
     * @param attestation ABI-encoded attestation data
     * @param signature 65-byte secp256k1 signature (r, s, v)
     */
    function verifyAndStore(
        bytes calldata attestation,
        bytes calldata signature
    ) external returns (bool) {
        // Decode attestation
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
        ) = abi.decode(attestation, (
            bytes32, string, string, uint256, uint8, uint64, uint64, uint64, uint64
        ));

        // Compute attestation ID (hash of attestation)
        bytes32 attestationId = keccak256(attestation);

        // Check not already used
        require(!usedAttestations[attestationId], "Attestation already used");
        
        // Check not revoked
        require(!revokedAttestations[attestationId], "Attestation revoked");

        // Check not expired
        require(block.timestamp * 1000 < expiresAt, "Attestation expired");

        // Check target address matches sender
        require(
            _compareStrings(targetAddress, _addressToString(msg.sender)),
            "Target address mismatch"
        );

        // Verify signature
        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == casperSigner, "Invalid signature");

        // Mark as used
        usedAttestations[attestationId] = true;

        // Store verified identity
        verifiedUsers[msg.sender] = VerifiedIdentity({
            casperAddressHash: casperAddressHash,
            tier: Tier(tier),
            stake: stake,
            accountAgeDays: accountAgeDays,
            verifiedAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });

        emit IdentityVerified(msg.sender, casperAddressHash, Tier(tier), stake);

        return true;
    }

    /**
     * @notice Verify attestation without storing (for one-time checks)
     */
    function verify(
        bytes calldata attestation,
        bytes calldata signature
    ) external view returns (bool, Tier, uint256) {
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
        ) = abi.decode(attestation, (
            bytes32, string, string, uint256, uint8, uint64, uint64, uint64, uint64
        ));

        bytes32 attestationId = keccak256(attestation);

        if (usedAttestations[attestationId]) return (false, Tier.None, 0);
        if (revokedAttestations[attestationId]) return (false, Tier.None, 0);
        if (block.timestamp * 1000 >= expiresAt) return (false, Tier.None, 0);

        bytes32 messageHash = keccak256(attestation);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        
        if (recovered != casperSigner) return (false, Tier.None, 0);

        return (true, Tier(tier), stake);
    }

    // ============ VIEW FUNCTIONS ============

    function getTier(address user) external view returns (Tier) {
        VerifiedIdentity memory identity = verifiedUsers[user];
        if (identity.expiresAt < block.timestamp * 1000) {
            return Tier.None;
        }
        return identity.tier;
    }

    function getStake(address user) external view returns (uint256) {
        return verifiedUsers[user].stake;
    }

    function isVerified(address user) external view returns (bool) {
        VerifiedIdentity memory identity = verifiedUsers[user];
        return identity.expiresAt > block.timestamp * 1000;
    }

    function getVerifiedIdentity(address user) external view returns (VerifiedIdentity memory) {
        return verifiedUsers[user];
    }

    // ============ ADMIN FUNCTIONS ============

    function updateSigner(address newSigner) external onlyOwner {
        casperSigner = newSigner;
        emit SignerUpdated(newSigner);
    }

    function revokeAttestation(bytes32 attestationId) external onlyOwner {
        revokedAttestations[attestationId] = true;
        emit AttestationRevoked(attestationId);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
```

---

## 6. Critical Implementation Notes

### 6.1 Signing Key Management

**⚠️ IMPORTANT:**

For MVP/hackathon, you can hardcode a test private key. For production:
- Use HSM or secure enclave
- Implement key rotation
- Consider multisig

```rust
// Test key generation (DO NOT USE IN PRODUCTION)
fn generate_test_keypair() -> ([u8; 32], [u8; 64]) {
    use k256::ecdsa::SigningKey;
    use rand::rngs::OsRng;
    
    let signing_key = SigningKey::random(&mut OsRng);
    let private_key: [u8; 32] = signing_key.to_bytes().into();
    let public_key = signing_key.verifying_key().to_encoded_point(false);
    let pubkey_bytes: [u8; 64] = public_key.as_bytes()[1..65].try_into().unwrap();
    
    (private_key, pubkey_bytes)
}
```

### 6.2 Querying Stake from System Auction

**CHALLENGE:** The System Auction doesn't have a simple "get total stake for user" function. You need to:

1. Query the auction's `bids` (for validators)
2. Query `delegators` for each validator
3. Aggregate

**WORKAROUND FOR MVP:**
- Accept user-provided stake amount
- Verify on-chain via indexer call
- OR: Query a specific validator's delegation

```rust
// Simplified approach for MVP
fn query_stake_for_validator(&self, user: Address, validator: PublicKey) -> U512 {
    let auction_hash = get_auction_hash();
    
    runtime::call_contract::<U512>(
        auction_hash,
        "get_delegator_stake",
        runtime_args! {
            "delegator" => user,
            "validator" => validator,
        },
    )
}
```

### 6.3 Account Age Problem

**CHALLENGE:** Casper doesn't store account creation timestamp on-chain.

**WORKAROUNDS:**
1. **Skip age requirement for MVP** - just use stake
2. **Require user to provide proof** - signed message from specific block
3. **Use indexer API** - query external service

**RECOMMENDED FOR MVP:** Focus on stake-based tiers only, ignore age.

```rust
fn calculate_tier_stake_only(&self, stake_motes: U512) -> Tier {
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
```

---

## 7. ABI Encoding Format

For EVM compatibility, the attestation must be ABI-encoded. Use this exact format:

```solidity
// Solidity decode format
abi.decode(attestation, (
    bytes32,  // casperAddressHash
    string,   // targetChain
    string,   // targetAddress  
    uint256,  // stake (motes)
    uint8,    // tier
    uint64,   // accountAgeDays
    uint64,   // createdAt
    uint64,   // expiresAt
    uint64    // nonce
))
```

**In Rust, encode as:**
```rust
fn abi_encode(&self, payload: &AttestationPayload) -> Vec<u8> {
    use ethabi::{encode, Token};
    
    encode(&[
        Token::FixedBytes(payload.casper_address_hash.to_vec()),
        Token::String(payload.target_chain.clone()),
        Token::String(payload.target_address.clone()),
        Token::Uint(payload.stake_amount.into()),
        Token::Uint(payload.tier.into()),
        Token::Uint(payload.account_age_days.into()),
        Token::Uint(payload.created_at.into()),
        Token::Uint(payload.expires_at.into()),
        Token::Uint(payload.nonce.into()),
    ])
}
```

---

## 8. Test Scenarios

### Casper Contract:

| Test | Expected |
|------|----------|
| Create attestation with valid stake | Returns attestation ID + signature |
| Create attestation with 0 stake | Tier = None |
| Revoke own attestation | Success |
| Revoke other's attestation | Revert |
| Get attestation by ID | Returns correct data |

### EVM Verifier:

| Test | Expected |
|------|----------|
| Verify valid attestation | Success, identity stored |
| Verify expired attestation | Revert "expired" |
| Verify wrong target address | Revert "mismatch" |
| Verify invalid signature | Revert "invalid signature" |
| Verify used attestation | Revert "already used" |
| Query tier for verified user | Returns correct tier |
| Query tier for unverified user | Returns None |

---

## 9. Frontend Integration

```typescript
// Casper side - Create attestation
const { attestationId, signature } = await casperContract.create_attestation(
  "sepolia",  // target chain
  "0x1234..." // user's EVM address
);

// Encode attestation for EVM
const attestationBytes = ethers.AbiCoder.defaultAbiCoder().encode(
  ["bytes32", "string", "string", "uint256", "uint8", "uint64", "uint64", "uint64", "uint64"],
  [casperAddressHash, targetChain, targetAddress, stake, tier, age, created, expires, nonce]
);

// EVM side - Verify
const evmContract = new ethers.Contract(verifierAddress, abi, signer);
await evmContract.verifyAndStore(attestationBytes, signature);

// Query verified identity
const tier = await evmContract.getTier(userAddress);
const isVerified = await evmContract.isVerified(userAddress);
```

---

## 10. Deployment

### Casper (Testnet):
```bash
# 1. Generate signer keypair
# 2. Deploy with signer private key
# 3. Note contract hash and signer address
```

### EVM (Sepolia):
```bash
# 1. Deploy with Casper signer address
npx hardhat run scripts/deploy.js --network sepolia

# 2. Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <SIGNER_ADDRESS>
```

---

## 11. Dependencies

### Casper (Cargo.toml):
```toml
[dependencies]
odra = "1.0"
k256 = "0.13"      # secp256k1 signing
sha3 = "0.10"      # keccak256
ethabi = "18.0"    # ABI encoding
```

### EVM (package.json):
```json
{
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0"
  }
}
```

---

**FOCUS:** Get Casper attestation creation + EVM verification working. Skip account age for MVP.
