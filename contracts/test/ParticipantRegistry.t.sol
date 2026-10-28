//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ParticipantRegistry.sol";

contract ParticipantRegistryTest is Test {
    ParticipantRegistry registry;

    address admin = makeAddr("admin");
    address farmer = makeAddr("farmer");

    function setUp() public {
        registry = new ParticipantRegistry(admin);
    }

    function test_AdminCanRegisterFarmer() public {
        bytes32 farmerRole = registry.FARMER_ROLE();

        vm.prank(admin);
        registry.registerParticipant(farmer, farmerRole);

        assertTrue(registry.hasRole(farmerRole, farmer));
    }

    function test_NonAdminCannotRegisterFarmer() public {
        bytes32 farmerRole = registry.FARMER_ROLE();

        vm.prank(farmer);
        vm.expectRevert();
        registry.registerParticipant(farmer, farmerRole);
    }

    function test_AdminCanRevokeFarmer() public {
        bytes32 farmerRole = registry.FARMER_ROLE();

        vm.prank(admin);
        registry.registerParticipant(farmer, farmerRole);

        vm.prank(admin);
        registry.revokeParticipant(farmer, farmerRole);

        assertFalse(registry.hasRole(farmerRole, farmer));
    }

    function test_NonAdminCannotRevokeFarmer() public {
        bytes32 farmerRole = registry.FARMER_ROLE();

        vm.prank(admin);
        registry.registerParticipant(farmer, farmerRole);

        vm.prank(farmer);
        vm.expectRevert();
        registry.revokeParticipant(farmer, farmerRole);

        assertTrue(registry.hasRole(farmerRole, farmer));
    }

    function test_CannotRegisterAsAdminRole() public {
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();

        vm.prank(admin);
        vm.expectRevert("ParticipantRegistry: cannot assign admin role via registration");
        registry.registerParticipant(farmer, adminRole);
    }

    function test_CannotRevokeAdminRole() public {
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();

        vm.prank(admin);
        vm.expectRevert("ParticipantRegistry: cannot revoke admin role via this function");
        registry.revokeParticipant(admin, adminRole);
    }

    function test_MultipleParticipantsCanHoldSameRole() public {
        address transporterA = makeAddr("transporterA");
        address transporterB = makeAddr("transporterB");
        bytes32 transporterRole = registry.TRANSPORTER_ROLE();

        vm.prank(admin);
        registry.registerParticipant(transporterA, transporterRole);

        vm.prank(admin);
        registry.registerParticipant(transporterB, transporterRole);

        assertTrue(registry.hasRole(transporterRole, transporterA));
        assertTrue(registry.hasRole(transporterRole, transporterB));
    }

    function test_ConstructorGrantsAdminToMinistryNotDeployer() public view {
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();

        assertTrue(registry.hasRole(adminRole, admin));
        assertFalse(registry.hasRole(adminRole, address(this)));
    }
}
