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

    constructor(IParticipantRegistry _participantRegistry) {
        participantRegistry = _participantRegistry;
    }
}
