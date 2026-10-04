// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ParticipantRegistry} from "../src/ParticipantRegistry.sol";
import {BatchCustody} from "../src/BatchCustody.sol";

contract Deploy is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast();
        ParticipantRegistry registry = new ParticipantRegistry(admin);
        BatchCustody custody = new BatchCustody(address(registry));
        vm.stopBroadcast();

        console.log("REGISTRY_ADDRESS=", address(registry));
        console.log("BATCH_CUSTODY_ADDRESS=", address(custody));
    }
}
