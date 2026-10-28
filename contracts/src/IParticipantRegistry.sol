// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IParticipantRegistry {
    function hasRole(bytes32 role, address account) external view returns (bool);

    function FARMER_ROLE() external view returns (bytes32);
    function TRANSPORTER_ROLE() external view returns (bytes32);
    function MILL_ROLE() external view returns (bytes32);
    function STORAGE_ROLE() external view returns (bytes32);
    function EXPORTER_ROLE() external view returns (bytes32);
    function IMPORTER_ROLE() external view returns (bytes32);
    function RETAILER_ROLE() external view returns (bytes32);
}
