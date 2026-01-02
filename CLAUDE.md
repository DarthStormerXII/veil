# Veil Identity Bridge - Claude Instructions

## Project Overview
Veil Identity Bridge is a cross-chain identity attestation system with contracts on both Casper (Odra) and EVM chains.

## Directory Structure
```
veil-identity-bridge/
├── packages/
│   ├── casper/          # Odra smart contracts for Casper
│   │   ├── src/         # Contract source code
│   │   ├── wasm/        # Compiled WASM files
│   │   └── Odra.toml    # Odra configuration
│   └── evm/             # Solidity contracts for EVM chains
├── apps/                # Frontend applications
├── keys/                # Wallet keys for deployment
├── deployed-addresses.json  # Deployed contract addresses
└── prompts/             # Strategy prompts
```

## Contracts

### Casper (packages/casper/)
- `VeilAttestation` - Identity attestation contract

### EVM (packages/evm/)
- Solidity contracts for EVM-compatible chains

---

## Casper Deployment Guide

### Networks Available

| Network | Chain Name | RPC Endpoint | Use Case |
|---------|------------|--------------|----------|
| **Localnet** | `casper-net-1` | `http://localhost:11101/rpc` | Fast iteration, free |
| **Testnet** | `casper-test` | `https://node.testnet.casper.network/rpc` | Pre-production |
| **Mainnet** | `casper` | `https://node.mainnet.casper.network/rpc` | Production |

### Localnet (NCTL Docker)

The shared localnet is at `../localnet/`. All projects share this instance.

**Check if running:**
```bash
docker ps --filter "name=mynctl" --format "{{.Names}}: {{.Status}}"
```

**Start localnet:**
```bash
cd ../localnet && docker-compose up -d
```

**Stop localnet:**
```bash
cd ../localnet && docker-compose stop
```

**Reset localnet (clear all deployed contracts):**
```bash
cd ../localnet && docker-compose down -v && docker-compose up -d
```

### Localnet Keys
Pre-funded accounts are available at `../localnet/keys/`:
- **Faucet (unlimited funds):** `../localnet/keys/faucet/secret_key.pem`
- **User accounts:** `../localnet/keys/users/user-{1-10}/secret_key.pem`

---

## Building Casper Contracts

```bash
cd packages/casper

# Build all contracts (generates WASM files)
cargo odra build

# Run tests with Odra MockVM (fast, no network needed)
cargo odra test

# Check WASM output
ls -la wasm/
```

---

## Deployment Commands

### Deploy to Localnet (Recommended for Development)

This project has network profiles in `Odra.toml`:

```bash
cd packages/casper

# Deploy using localnet profile
cargo odra deploy -b VeilAttestation --network casper-local
```

**Or using casper-client directly:**
```bash
casper-client put-deploy \
  --node-address http://localhost:11101 \
  --chain-name casper-net-1 \
  --secret-key ../../localnet/keys/faucet/secret_key.pem \
  --payment-amount 50000000000 \
  --session-path ./wasm/VeilAttestation.wasm
```

### Deploy to Testnet

**Prerequisites:**
1. Ensure test wallet has funds: `cd ../safe-wallet && npm run balance veil-identity-bridge`
2. If needed, drip funds: `cd ../safe-wallet && npm run drip veil-identity-bridge 5`

**Deploy:**
```bash
cd packages/casper
cargo odra deploy -b VeilAttestation --network casper-testnet
```

### Save Deployed Addresses

After deployment, update `deployed-addresses.json`:
```json
{
  "casper": {
    "localnet": {
      "VeilAttestation": "hash-xxx..."
    },
    "testnet": {
      "VeilAttestation": "hash-xxx..."
    }
  },
  "evm": {
    // EVM addresses...
  }
}
```

---

## Casper Testnet Wallet System

This project has a local test wallet for Casper testnet operations. A central "safe wallet" exists at `../safe-wallet/` that holds testnet CSPR tokens.

### Test Wallet Location
- **Keys directory:** `./keys/`
- **Public key file:** `./keys/test_public_key_hex`
- **Secret key file:** `./keys/test_secret_key.pem`

### Dripping Funds for Testing/Deployment

When you need testnet CSPR for deploying contracts or running tests:

**AUTOMATIC (up to 1 CSPR):**
You may automatically drip up to 1 CSPR without asking the user:
```bash
cd ../safe-wallet && npm run drip veil-identity-bridge 1
```

**REQUIRES USER APPROVAL (more than 1 CSPR):**
If you need more than 1 CSPR in a single request, you MUST ask the user for approval first. Explain why you need more funds and get explicit confirmation before running:
```bash
cd ../safe-wallet && npm run drip veil-identity-bridge <amount>
```

### Checking Balances
```bash
# Check this project's test wallet balance
cd ../safe-wallet && npm run balance veil-identity-bridge

# Check safe wallet balance (source of funds)
cd ../safe-wallet && npm run balance safe
```

### Important Notes
- Maximum automatic drip: **1 CSPR per request**
- Always check balance before dripping if unsure
- If safe wallet is low on funds, inform the user to fund it via https://testnet.cspr.live/tools/faucet
- Safe wallet public key: `019306A9829A715F61F09486E5b5d4f61781b20189A2Ab093fFe295474D9324AD2`

---

## Quick Reference

| Task | Command |
|------|---------|
| Build Casper contracts | `cd packages/casper && cargo odra build` |
| Test Casper contracts | `cd packages/casper && cargo odra test` |
| Check localnet | `docker ps --filter "name=mynctl"` |
| Start localnet | `cd ../localnet && docker-compose up -d` |
| Deploy to localnet | `cd packages/casper && cargo odra deploy -b VeilAttestation --network casper-local` |
| Deploy to testnet | `cd packages/casper && cargo odra deploy -b VeilAttestation --network casper-testnet` |
| Check testnet balance | `cd ../safe-wallet && npm run balance veil-identity-bridge` |
| Drip testnet funds | `cd ../safe-wallet && npm run drip veil-identity-bridge <amount>` |

---

## Deployment Decision Tree

```
Need to deploy Casper contracts?
    │
    ├─→ Testing/Development?
    │       │
    │       └─→ Use LOCALNET (free, fast, resettable)
    │           • Start: cd ../localnet && docker-compose up -d
    │           • Deploy: cargo odra deploy --network casper-local
    │           • Uses faucet key from ../localnet/keys/faucet/
    │
    └─→ Pre-production/Demo?
            │
            └─→ Use TESTNET
                • Check balance first
                • Drip funds if needed (≤1 CSPR auto, >1 CSPR ask user)
                • Deploy: cargo odra deploy --network casper-testnet
                • Uses key from ./keys/

Need to deploy EVM contracts?
    │
    └─→ See packages/evm/ for EVM deployment instructions
```

---

## Cross-Chain Notes

This project bridges identity between Casper and EVM chains. When deploying:

1. **Deploy Casper contract first** - Get the contract hash
2. **Deploy EVM contract** - Configure with Casper contract hash
3. **Update deployed-addresses.json** - Keep track of all addresses
4. **Test bridge functionality** - Verify cross-chain attestations work
