// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VeilVerifier.sol";

contract DeployVeilVerifier is Script {
    function run() external {
        // Get signer address from env or use default test key
        address casperSigner = vm.envOr(
            "CASPER_SIGNER_ADDRESS",
            address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
        );

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        VeilVerifier verifier = new VeilVerifier(casperSigner);

        console.log("VeilVerifier deployed to:", address(verifier));
        console.log("Casper signer address:", casperSigner);

        vm.stopBroadcast();
    }
}
