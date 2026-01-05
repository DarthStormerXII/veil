import pkg from "casper-js-sdk";
const { CasperClient, Keys, DeployUtil, RuntimeArgs, CLValueBuilder } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Network configurations
const NETWORKS = {
  localnet: {
    rpc: "http://localhost:11101/rpc",
    chainName: "casper-net-1",
  },
  testnet: {
    rpc: "https://node.testnet.casper.network/rpc",
    chainName: "casper-test",
  },
  mainnet: {
    rpc: "https://node.mainnet.casper.network/rpc",
    chainName: "casper",
  },
};

// Default payment for contract deployment (50 CSPR)
const DEPLOY_PAYMENT = 50_000_000_000n; // 50 CSPR in motes

async function deploy(network = "testnet") {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    console.error(`Unknown network: ${network}`);
    console.error(`Available networks: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
  }

  const client = new CasperClient(networkConfig.rpc);

  // Load wallet keys
  const keysDir = path.join(__dirname, "..", "..", "..", "keys");
  const secretKeyPath = path.join(keysDir, "test_secret_key.pem");

  if (!fs.existsSync(secretKeyPath)) {
    console.error(`Secret key not found at: ${secretKeyPath}`);
    process.exit(1);
  }

  // Load WASM file
  const wasmPath = path.join(__dirname, "..", "wasm", "VeilAttestation.wasm");
  if (!fs.existsSync(wasmPath)) {
    console.error(`WASM file not found at: ${wasmPath}`);
    console.error("Run: cargo odra build");
    process.exit(1);
  }

  const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
  const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(secretKeyPath);

  console.log("Contract Deployment:");
  console.log(`  Network: ${network} (${networkConfig.chainName})`);
  console.log(`  RPC: ${networkConfig.rpc}`);
  console.log(`  Deployer: ${keyPair.publicKey.toHex()}`);
  console.log(`  Contract: VeilAttestation.wasm (${wasmBytes.length} bytes)`);
  console.log(`  Payment: ${Number(DEPLOY_PAYMENT) / 1_000_000_000} CSPR`);

  // Create deploy parameters
  const deployParams = new DeployUtil.DeployParams(
    keyPair.publicKey,
    networkConfig.chainName,
    1,  // gas price multiplier
    1800000  // TTL in ms (30 minutes)
  );

  // Runtime args for contract installation (Odra contracts require package_hash_key_name)
  const runtimeArgs = RuntimeArgs.fromMap({
    odra_cfg_package_hash_key_name: CLValueBuilder.string("veil_attestation_package_hash"),
    odra_cfg_allow_key_override: CLValueBuilder.bool(true),
    odra_cfg_is_upgradable: CLValueBuilder.bool(true),
  });

  // Create module bytes deploy
  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
    wasmBytes,
    runtimeArgs
  );

  const payment = DeployUtil.standardPayment(DEPLOY_PAYMENT);
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  console.log("\nSending deploy...");

  try {
    const deployHash = await client.putDeploy(signedDeploy);
    console.log(`\nDeploy submitted successfully!`);
    console.log(`  Deploy Hash: ${deployHash}`);

    if (network === "testnet") {
      console.log(`  View on explorer: https://testnet.cspr.live/deploy/${deployHash}`);
    } else if (network === "mainnet") {
      console.log(`  View on explorer: https://cspr.live/deploy/${deployHash}`);
    }

    console.log("\nWaiting for deploy to be processed (this may take 2-3 minutes)...");

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      try {
        const deployInfo = await client.getDeploy(deployHash);
        if (deployInfo && deployInfo[1] && deployInfo[1].execution_results && deployInfo[1].execution_results.length > 0) {
          const result = deployInfo[1].execution_results[0].result;
          if (result.Success) {
            console.log("\n\nDeployment completed successfully!");

            // Try to extract contract package hash from execution results
            const effects = result.Success.effect;
            if (effects && effects.transforms) {
              for (const transform of effects.transforms) {
                if (transform.transform && transform.transform.WriteContract) {
                  console.log(`\nContract Hash: ${transform.key}`);
                }
                if (transform.key && transform.key.includes("hash-")) {
                  // This might be our contract package hash
                  console.log(`  Key: ${transform.key}`);
                }
              }
            }

            console.log(`\nDeploy Hash: ${deployHash}`);
            console.log("\nIMPORTANT: Update deployed-addresses.json with the contract hash");
            console.log("You can find the contract package hash in the deploy details on the explorer.");
            return deployHash;
          } else if (result.Failure) {
            console.error("\n\nDeployment failed:", result.Failure.error_message);
            process.exit(1);
          }
        }
      } catch (e) {
        // Deploy not found yet, continue waiting
      }

      process.stdout.write(".");
    }

    console.log("\n\nTimeout waiting for deploy confirmation.");
    console.log("The deploy may still be processing. Check the explorer for status.");
    console.log(`Deploy Hash: ${deployHash}`);
    return deployHash;
  } catch (error) {
    console.error("\nError sending deploy:", error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const network = args[0] || "testnet";

deploy(network).catch(console.error);
