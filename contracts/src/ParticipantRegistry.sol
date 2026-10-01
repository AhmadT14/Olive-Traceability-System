// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IParticipantRegistry.sol";

contract ParticipantRegistry is AccessControl, IParticipantRegistry {
    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    function hasRole(
        bytes32 role,
        address account
    ) public view override(AccessControl, IParticipantRegistry) returns (bool) {
        return super.hasRole(role, account);
    }

    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant MILL_ROLE = keccak256("MILL_ROLE");
    bytes32 public constant STORAGE_ROLE = keccak256("STORAGE_ROLE");
    bytes32 public constant EXPORTER_ROLE = keccak256("EXPORTER_ROLE");
    bytes32 public constant IMPORTER_ROLE = keccak256("IMPORTER_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    function registerParticipant(
        address wallet,
        bytes32 role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            role != DEFAULT_ADMIN_ROLE,
            "ParticipantRegistry: cannot assign admin role via registration"
        );
        _grantRole(role, wallet);
    }

    function revokeParticipant(
        address wallet,
        bytes32 role
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            role != DEFAULT_ADMIN_ROLE,
            "ParticipantRegistry: cannot revoke admin role via this function"
        );
        _revokeRole(role, wallet);
    }
}
