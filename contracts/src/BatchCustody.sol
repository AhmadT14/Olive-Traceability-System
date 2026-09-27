//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IParticipantRegistry.sol";

contract BatchCustody {
    IParticipantRegistry public participantRegistry;

    enum Status {
        None, // batch does not exist
        Created, // custody held, not listed, no pending handover
        Listed, // posted for open transporter pickup
        PendingHandover // named handover initiated, awaiting confirmReceipt
    }

    enum Stage {
        Farm, // batch created, not yet at a mill
        Mill, // received and processed at mill
        Storage, // received at storage facility
        Exporter, // received by exporter
        Importer, // received by importer
        Retailer // received by retailer — terminal stage
    }

    struct Batch {
        Status status;
        Stage stage;
        address custodian;
        address pendingTarget; // only meaningful when status == PendingHandover
    }

    mapping(string => Batch) public batches;

    event BatchCreated(
        string indexed batchId,
        address indexed farmer,
        bytes32 harvestDataHash
    );
    event BatchListed(
        string indexed batchId,
        address indexed custodian,
        bytes32 outgoingDataHash
    );
    event BatchClaimed(
        string indexed batchId,
        address indexed transporter,
        bytes32 intakeDataHash
    );
    event HandoverInitiated(
        string indexed batchId,
        address indexed currentCustodian,
        address indexed targetAddress,
        bytes32 outgoingDataHash
    );
    event ReceiptConfirmed(
        string indexed batchId,
        address indexed newCustodian,
        bytes32 intakeDataHash
    );

    constructor(IParticipantRegistry _participantRegistry) {
        participantRegistry = _participantRegistry;
    }
}
