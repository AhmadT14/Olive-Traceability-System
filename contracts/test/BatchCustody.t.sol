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

    function test_CreateBatch_Success() public {
        bytes32 harvestHash = keccak256("harvest-data-1"); // Stand-in for a hash the backend would compute from real farm_records data; contract only stores it opaquely

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);

        (
            BatchCustody.Status status,
            BatchCustody.Stage stage,
            address custodian,
            address pendingTarget
        ) = custody.batches("BATCH-001");

        assertEq(uint8(status), uint8(BatchCustody.Status.Created));
        assertEq(uint8(stage), uint8(BatchCustody.Stage.Farm));
        assertEq(custodian, farmer);
        assertEq(pendingTarget, address(0));
    }

    function test_CreateBatch_RevertsIfNotFarmer() public {
        bytes32 harvestHash = keccak256("harvest-data-1");

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: caller is not a farmer");
        custody.createBatch("BATCH-001", harvestHash);
    }

    function test_CreateBatch_RevertsIfBatchIdAlreadyExists() public {
        bytes32 harvestHash = keccak256("harvest-data-1");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);

        vm.prank(farmer);
        vm.expectRevert("BatchCustody: batch already exists");
        custody.createBatch("BATCH-001", harvestHash);
    }

    function test_CreateBatch_EmitsEvent() public {
        bytes32 harvestHash = keccak256("harvest-data-1");

        vm.expectEmit(true, true, false, true);
        emit BatchCustody.BatchCreated("BATCH-001", farmer, harvestHash);

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);
    }
}
