# Veil

## One Liner

A cross-chain identity protocol that cryptographically proves your Casper stake and reputation on EVM chains - without bridging any assets.

## Key Innovation Domains

- **Cross-Chain Identity**
- **Interoperability**
- **Zero-Knowledge Proofs**
- **Reputation Systems**
- **Sybil Resistance**

## Detailed Build Description

Veil is a cross-chain identity bridge that allows users to prove their Casper Network identity, stake amount, and reputation tier on EVM chains (like Ethereum) without moving any assets between chains.

### The Problem

Cross-chain identity is typically solved through asset bridges, which introduce:
- Bridge risk (hacks, exploits)
- Liquidity requirements
- High gas costs
- Complex user experience

Meanwhile, users who have built reputation on one chain can't leverage it on another.

### Our Solution

Veil creates cryptographic attestations of your Casper identity that can be verified on EVM chains. No assets move - only signed proofs of identity.

### How It Works

**On Casper (Attestation Creation):**
1. User calls `create_attestation()` with their target EVM address
2. Contract queries user's stake from the System Auction
3. Contract calculates user's tier based on stake amount
4. Contract creates an attestation with: stake, tier, account info, expiry
5. Contract signs the attestation with secp256k1 (Ethereum-compatible)
6. User receives attestation ID + signature

**Off-Chain (User Carries Proof):**
7. User takes the attestation + signature to the EVM chain

**On EVM (Verification):**
8. User submits attestation + signature to Veil Verifier contract
9. Verifier validates: signature matches Casper signer, not expired, not revoked, target address matches sender
10. Verifier stores verified identity on-chain
11. DApps can query the verifier to check any user's Casper tier and stake

### Tier System

| Tier | Stake Requirement | Benefits |
|------|-------------------|----------|
| **None** | < 100 CSPR | Basic access |
| **Bronze** | 100+ CSPR | Verified user status |
| **Silver** | 1,000+ CSPR | Enhanced trust score |
| **Gold** | 10,000+ CSPR | Premium access |
| **Platinum** | 100,000+ CSPR | Highest tier privileges |

### Technical Architecture

**Casper Side (Odra/Rust):**
- Attestation contract that queries stake and creates signed attestations
- secp256k1 signing for EVM compatibility
- Attestation storage and revocation

**EVM Side (Solidity):**
- Verifier contract that validates signatures
- Identity storage with tier information
- Query functions for DApp integration

**Security Features:**
- Attestations expire after 7 days
- One-time use (replay protection)
- User can revoke attestations
- No asset custody or bridge risk

### Use Cases

1. **DeFi Access Control**: Gate premium features based on Casper stake
2. **Governance**: Cross-chain voting weight based on Casper reputation
3. **Sybil Resistance**: Prove you're a real staker, not a bot
4. **Airdrops**: Target users based on cross-chain activity
5. **Reputation Portability**: Carry your Casper reputation to EVM DApps

### Why Veil?

The name "Veil" represents the cryptographic layer that protects your identity while still allowing you to prove specific attributes. Like a veil that conceals while revealing what matters - you prove your stake and tier without exposing your full identity or moving assets.

## Team

### Cipher Bonney
Backend and blockchain developer focused on building secure, scalable DeFi infrastructure. Experienced in Rust development and protocol-level integrations.

### Darth Stormer
Cross-chain protocol developer with expertise in cryptographic systems and interoperability solutions. Focused on building trustless bridges that prioritize security over convenience.

## Technology Stack Used

- [x] Odra Framework
- [ ] Native Casper Rust SDK
- [ ] CSPR.click
- [ ] CSPR.cloud
- [x] JavaScript/TypeScript SDK
- [ ] Python SDK
- [x] Other (Solidity for EVM Verifier Contract)
