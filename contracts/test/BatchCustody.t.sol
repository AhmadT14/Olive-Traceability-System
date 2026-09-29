// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParticipantRegistry} from "../src/ParticipantRegistry.sol";
import {BatchCustody} from "../src/BatchCustody.sol";

contract BatchCustodyTest is Test {
    ParticipantRegistry registry;
    BatchCustody custody;

    address admin = address(0xA11CE);
    address farmer = address(0xF1);
    address transporter1 = address(0x71);
    address transporter2 = address(0x72);
    address mill = address(0xE1);
    address storageFacility = address(0x51);
    address exporter = address(0xE2);
    address importer = address(0x12);
    address retailer = address(0x1E);

    function setUp() public {
        vm.prank(admin);
        registry = new ParticipantRegistry(admin);

        custody = new BatchCustody(address(registry));

        vm.startPrank(admin);
        registry.registerParticipant(farmer, registry.FARMER_ROLE());
        registry.registerParticipant(transporter1, registry.TRANSPORTER_ROLE());
        registry.registerParticipant(transporter2, registry.TRANSPORTER_ROLE());
        registry.registerParticipant(mill, registry.MILL_ROLE());
        registry.registerParticipant(storageFacility, registry.STORAGE_ROLE());
        registry.registerParticipant(exporter, registry.EXPORTER_ROLE());
        registry.registerParticipant(importer, registry.IMPORTER_ROLE());
        registry.registerParticipant(retailer, registry.RETAILER_ROLE());
        vm.stopPrank();
    }
}
