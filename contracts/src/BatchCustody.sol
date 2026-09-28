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

    function createBatch(
        string memory batchId,
        bytes32 harvestDataHash
    ) external {
        require(
            participantRegistry.hasRole(
                participantRegistry.FARMER_ROLE(),
                msg.sender
            ),
            "BatchCustody: caller is not a farmer"
        );
        require(
            batches[batchId].status == Status.None,
            "BatchCustody: batch already exists"
        );

        batches[batchId] = Batch({
            status: Status.Created,
            stage: Stage.Farm,
            custodian: msg.sender,
            pendingTarget: address(0)
        });

        emit BatchCreated(batchId, msg.sender, harvestDataHash);
    }

    function postForPickup(
        string memory batchId,
        bytes32 outgoingDataHash
    ) external {
        require(
            batches[batchId].status != Status.None,
            "BatchCustody: batch not found"
        );
        require(
            batches[batchId].custodian == msg.sender,
            "BatchCustody: caller is not current custodian"
        );
        require(
            batches[batchId].status == Status.Created,
            "BatchCustody: batch not in a listable state"
        );
        require(
            batches[batchId].stage != Stage.Retailer,
            "BatchCustody: batch already at final stage"
        );

        batches[batchId].status = Status.Listed;

        emit BatchListed(batchId, msg.sender, outgoingDataHash);
    }

    function claimBatch(
        string memory batchId,
        bytes32 intakeDataHash
    ) external {
        require(
            participantRegistry.hasRole(
                participantRegistry.TRANSPORTER_ROLE(),
                msg.sender
            ),
            "BatchCustody: caller is not a transporter"
        );
        require(
            batches[batchId].status == Status.Listed,
            "BatchCustody: batch not listed for pickup"
        );
        batches[batchId].status = Status.Created;
        batches[batchId].custodian = msg.sender;

        emit BatchClaimed(batchId, msg.sender, intakeDataHash);
    }

    constructor(IParticipantRegistry _participantRegistry) {
        participantRegistry = _participantRegistry;
    }
}
