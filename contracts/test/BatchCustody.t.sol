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

    function test_PostForPickup_Success() public {
        bytes32 harvestHash = keccak256("harvest-data-1");
        bytes32 outgoingHash = keccak256("outgoing-data-1");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);

        vm.prank(farmer);
        custody.postForPickup("BATCH-001", outgoingHash);

        (
            BatchCustody.Status status,
            BatchCustody.Stage stage,
            address custodianAddr,
            address pendingTarget
        ) = custody.batches("BATCH-001");

        assertEq(uint8(status), uint8(BatchCustody.Status.Listed));
        assertEq(uint8(stage), uint8(BatchCustody.Stage.Farm));
        assertEq(custodianAddr, farmer);
        assertEq(pendingTarget, address(0));
    }

    function test_PostForPickup_RevertsIfNotCustodian() public {
        bytes32 harvestHash = keccak256("harvest-data-1");
        bytes32 outgoingHash = keccak256("outgoing-data-1");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: caller is not current custodian");
        custody.postForPickup("BATCH-001", outgoingHash);
    }

    function test_PostForPickup_RevertsIfNotFound() public {
        bytes32 outgoingHash = keccak256("outgoing-data-1");

        vm.prank(farmer);
        vm.expectRevert("BatchCustody: batch not found");
        custody.postForPickup("BATCH-DOES-NOT-EXIST", outgoingHash);
    }

    function test_PostForPickup_RevertsIfAlreadyListed() public {
        bytes32 harvestHash = keccak256("harvest-data-1");
        bytes32 outgoingHash = keccak256("outgoing-data-1");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", harvestHash);

        vm.prank(farmer);
        custody.postForPickup("BATCH-001", outgoingHash);

        vm.prank(farmer);
        vm.expectRevert("BatchCustody: batch not in a listable state");
        custody.postForPickup("BATCH-001", outgoingHash);
    }

    function test_PostForPickup_RevertsIfAtFinalStage() public {
        bytes32 h = keccak256("data");
        _walkToRetailer("BATCH-001", h);

        vm.prank(retailer);
        vm.expectRevert("BatchCustody: batch already at final stage");
        custody.postForPickup("BATCH-001", h);
    }

    function test_Retailer_CannotPostForPickup() public {
        bytes32 h = keccak256("data");
        _walkToRetailer("BATCH-001", h);

        vm.prank(retailer);
        vm.expectRevert("BatchCustody: batch already at final stage");
        custody.postForPickup("BATCH-001", h);
    }

    function _walkToRetailer(string memory batchId, bytes32 h) internal {
        vm.prank(farmer);
        custody.createBatch(batchId, h);
        vm.prank(farmer);
        custody.postForPickup(batchId, h);
        vm.prank(transporter1);
        custody.claimBatch(batchId, h);
        vm.prank(transporter1);
        custody.initiateHandover(batchId, mill, h);
        vm.prank(mill);
        custody.confirmReceipt(batchId, h);

        vm.prank(mill);
        custody.postForPickup(batchId, h);
        vm.prank(transporter1);
        custody.claimBatch(batchId, h);
        vm.prank(transporter1);
        custody.initiateHandover(batchId, storageFacility, h);
        vm.prank(storageFacility);
        custody.confirmReceipt(batchId, h);

        vm.prank(storageFacility);
        custody.postForPickup(batchId, h);
        vm.prank(transporter1);
        custody.claimBatch(batchId, h);
        vm.prank(transporter1);
        custody.initiateHandover(batchId, exporter, h);
        vm.prank(exporter);
        custody.confirmReceipt(batchId, h);

        vm.prank(exporter);
        custody.postForPickup(batchId, h);
        vm.prank(transporter1);
        custody.claimBatch(batchId, h);
        vm.prank(transporter1);
        custody.initiateHandover(batchId, importer, h);
        vm.prank(importer);
        custody.confirmReceipt(batchId, h);

        vm.prank(importer);
        custody.postForPickup(batchId, h);
        vm.prank(transporter1);
        custody.claimBatch(batchId, h);
        vm.prank(transporter1);
        custody.initiateHandover(batchId, retailer, h);
        vm.prank(retailer);
        custody.confirmReceipt(batchId, h);
    }

    function test_ClaimBatch_Success() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);

        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        (
            BatchCustody.Status status,
            BatchCustody.Stage stage,
            address custodianAddr,
            address pendingTarget
        ) = custody.batches("BATCH-001");

        assertEq(uint8(status), uint8(BatchCustody.Status.Created));
        assertEq(uint8(stage), uint8(BatchCustody.Stage.Farm));
        assertEq(custodianAddr, transporter1);
        assertEq(pendingTarget, address(0));
    }

    function test_ClaimBatch_RevertsIfNotTransporter() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);

        vm.prank(mill);
        vm.expectRevert("BatchCustody: caller is not a transporter");
        custody.claimBatch("BATCH-001", h);
    }

    function test_ClaimBatch_RevertsIfNotListed() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: batch not listed for pickup");
        custody.claimBatch("BATCH-001", h);
    }

    function test_ClaimBatch_RevertsIfAlreadyClaimed() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);

        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter2);
        vm.expectRevert("BatchCustody: batch not listed for pickup");
        custody.claimBatch("BATCH-001", h);
    }

    function test_InitiateHandover_Success() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);

        (
            BatchCustody.Status status,
            BatchCustody.Stage stage,
            address custodianAddr,
            address pendingTarget
        ) = custody.batches("BATCH-001");

        assertEq(uint8(status), uint8(BatchCustody.Status.PendingHandover));
        assertEq(uint8(stage), uint8(BatchCustody.Stage.Farm));
        assertEq(custodianAddr, transporter1);
        assertEq(pendingTarget, mill);
    }

    function test_InitiateHandover_RevertsIfNotTransporter() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);
        vm.prank(mill);
        custody.confirmReceipt("BATCH-001", h);

        vm.prank(mill);
        vm.expectRevert("BatchCustody: caller is not a transporter");
        custody.initiateHandover("BATCH-001", storageFacility, h);
    }

    function test_InitiateHandover_RevertsIfNotCustodian() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter2);
        vm.expectRevert("BatchCustody: caller is not current custodian");
        custody.initiateHandover("BATCH-001", mill, h);
    }

    function test_InitiateHandover_RevertsIfNotFound() public {
        bytes32 h = keccak256("data");

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: batch not found");
        custody.initiateHandover("BATCH-DOES-NOT-EXIST", mill, h);
    }

    function test_InitiateHandover_RevertsIfNotHeld() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: batch not in a handover-ready state");
        custody.initiateHandover("BATCH-001", storageFacility, h);
    }

    function test_InitiateHandover_RevertsIfinvalidTargetRole() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: target is not the next stage");
        custody.initiateHandover("BATCH-001", exporter, h);
    }

    function test_InitiateHandover_CannotTargetfarmer() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: target is not the next stage");
        custody.initiateHandover("BATCH-001", farmer, h);
    }

    function test_InitiateHandover_CannottargetTransporter() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(transporter1);
        vm.expectRevert("BatchCustody: target is not the next stage");
        custody.initiateHandover("BATCH-001", transporter2, h);
    }

    function test_ConfirmReceipt_Success() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);

        vm.prank(mill);
        custody.confirmReceipt("BATCH-001", h);

        (
            BatchCustody.Status status,
            BatchCustody.Stage stage,
            address custodianAddr,
            address pendingTarget
        ) = custody.batches("BATCH-001");

        assertEq(uint8(status), uint8(BatchCustody.Status.Created));
        assertEq(uint8(stage), uint8(BatchCustody.Stage.Mill));
        assertEq(custodianAddr, mill);
        assertEq(pendingTarget, address(0));
    }

    function test_ConfirmReceipt_RevertsIfNotPending() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);

        vm.prank(mill);
        vm.expectRevert("BatchCustody: batch not pending handover");
        custody.confirmReceipt("BATCH-001", h);
    }

    function test_ConfirmReceipt_RevertsIfNotPendingTarget() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);

        vm.prank(storageFacility);
        vm.expectRevert("BatchCustody: caller is not the pending target");
        custody.confirmReceipt("BATCH-001", h);
    }

    function test_ConfirmReceipt_AdvancesStageCorrectly() public {
        bytes32 h = keccak256("data");

        vm.prank(farmer);
        custody.createBatch("BATCH-001", h);
        vm.prank(farmer);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", mill, h);
        vm.prank(mill);
        custody.confirmReceipt("BATCH-001", h);

        (
            ,
            BatchCustody.Stage stageAfterMill,
            address custodianAfterMill,

        ) = custody.batches("BATCH-001");
        assertEq(uint8(stageAfterMill), uint8(BatchCustody.Stage.Mill));
        assertEq(custodianAfterMill, mill);

        vm.prank(mill);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", storageFacility, h);
        vm.prank(storageFacility);
        custody.confirmReceipt("BATCH-001", h);

        (
            ,
            BatchCustody.Stage stageAfterStorage,
            address custodianAfterStorage,

        ) = custody.batches("BATCH-001");
        assertEq(uint8(stageAfterStorage), uint8(BatchCustody.Stage.Storage));
        assertEq(custodianAfterStorage, storageFacility);

        vm.prank(storageFacility);
        custody.postForPickup("BATCH-001", h);
        vm.prank(transporter1);
        custody.claimBatch("BATCH-001", h);
        vm.prank(transporter1);
        custody.initiateHandover("BATCH-001", exporter, h);
        vm.prank(exporter);
        custody.confirmReceipt("BATCH-001", h);

        (
            ,
            BatchCustody.Stage stageAfterExporter,
            address custodianAfterExporter,

        ) = custody.batches("BATCH-001");
        assertEq(uint8(stageAfterExporter), uint8(BatchCustody.Stage.Exporter));
        assertEq(custodianAfterExporter, exporter);
    }
}
