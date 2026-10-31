import { z } from "zod";

// Response contracts. Routes pass one of these to handle(), which validates
// the service output before it is serialised. Validation never mutates or
// replaces the payload - the original object is still what gets sent - so
// adding a schema cannot silently drop fields the frontend relies on.
//
// A mismatch is a backend bug, so it is reported as a 500 rather than leaking
// a partially shaped response to the client.

const timestamp = z.union([z.date(), z.string()]);
const nullableTimestamp = z.union([z.date(), z.string(), z.null()]);
const jsonObject = z.record(z.string(), z.unknown());
const roles = z.array(z.string());

const transactionSchema = z.object({
  to: z.string(),
  data: z.string(),
  value: z.string(),
});

export const chainBatchSchema = z.object({
  batchId: z.string(),
  status: z.string(),
  stage: z.string(),
  custodian: z.string(),
  pendingTarget: z.string(),
  destination: z.string(),
});

export const participantRolesResponseSchema = z.object({
  address: z.string(),
  roles,
});

export const sessionSchema = participantRolesResponseSchema.extend({
  isAdmin: z.boolean(),
  expiresAt: z.string(),
});

export const nonceResponseSchema = z.object({
  address: z.string(),
  nonce: z.string(),
  message: z.string(),
});

export const loginResponseSchema = sessionSchema.extend({
  token: z.string(),
});

export const chainBatchResponseSchema = chainBatchSchema;

export const historyResponseSchema = z.object({
  batchId: z.string(),
  events: z.array(
    z.object({
      name: z.string(),
      txHash: z.string(),
      blockNumber: z.number(),
      args: z.record(z.string(), z.string()),
      details: z.union([
        z.null(),
        z.object({
          type: z.string(),
          payloadVersion: z.number(),
          recordedAt: timestamp,
          values: jsonObject,
        }),
      ]),
    }),
  ),
});

const integritySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("verified"),
    onChainHash: z.string(),
    computedHash: z.string(),
  }),
  z.object({
    status: z.literal("hash_mismatch"),
    onChainHash: z.string(),
    computedHash: z.string(),
  }),
  z.object({ status: z.literal("event_not_found_on_chain") }),
  z.object({
    status: z.literal("unverifiable"),
    reason: z.string(),
  }),
  z.object({
    status: z.literal("metadata_mismatch"),
    expectedEvent: z.string(),
  }),
]);

export const verificationResponseSchema = z.object({
  batch: chainBatchSchema,
  integrityStatus: z.enum(["verified", "mismatch", "incomplete"]),
  events: z.array(
    z.object({
      txHash: z.string(),
      contractEvent: z.string(),
      detailsType: z.string(),
      payloadVersion: z.number(),
      recordedAt: timestamp,
      details: jsonObject,
      integrity: integritySchema,
    }),
  ),
});

export const transactionResponseSchema = z.object({
  hash: z.string(),
  success: z.boolean(),
  blockNumber: z.number(),
  events: z.array(
    z.object({
      name: z.string(),
      args: z.record(z.string(), z.string()),
    }),
  ),
});

// Both the farm-batch and every stage-listing write return this shape.
export const writeAckSchema = z.object({
  batchId: z.string(),
  txHash: z.string(),
});

export const claimAckSchema = z.object({
  batchId: z.string(),
  txHash: z.string(),
  transporter: z.string(),
  productType: z.enum(["olive", "oil"]),
});

export const handoverAckSchema = z.object({
  batchId: z.string(),
  txHash: z.string(),
  targetAddress: z.string(),
  productType: z.enum(["olive", "oil"]),
});

export const receiptAckSchema = z.object({
  batchId: z.string(),
  txHash: z.string(),
  stage: z.string(),
});

const destinationSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  role: z.string(),
});

export const destinationsResponseSchema = z.object({
  role: z.string(),
  destinations: z.array(destinationSchema),
});

export const batchDestinationsResponseSchema = z.object({
  batchId: z.string(),
  stage: z.string(),
  role: z.string(),
  destinations: z.array(destinationSchema),
});

const jobPartySchema = z.object({
  name: z.string().nullable(),
  role: z.string().nullable(),
  roles,
});

export const jobsResponseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      status: z.string(),
      batchId: z.string(),
      stage: z.string(),
      source: jobPartySchema,
      destination: jobPartySchema.extend({ address: z.string() }),
      outgoingDetails: z.union([z.null(), jsonObject]),
      createdAt: nullableTimestamp,
    }),
  ),
});

export const preparedBatchResponseSchema = z.object({
  batchId: z.string(),
  destinationAddress: z.string(),
  destinationRole: z.string(),
  dataHash: z.string(),
  transaction: transactionSchema,
});

export const preparedClaimResponseSchema = z.object({
  batchId: z.string(),
  productType: z.enum(["olive", "oil"]),
  dataHash: z.string(),
  transaction: transactionSchema,
});

export const preparedHandoverResponseSchema = z.object({
  batchId: z.string(),
  targetAddress: z.string(),
  productType: z.enum(["olive", "oil"]),
  dataHash: z.string(),
  transaction: transactionSchema,
});

export const preparedReceiptResponseSchema = z.object({
  batchId: z.string(),
  dataHash: z.string(),
  transaction: transactionSchema,
});

export const roleChangePreparedResponseSchema = z.object({
  address: z.string(),
  role: z.string(),
  action: z.enum(["register", "revoke"]),
  transaction: transactionSchema,
});

export const roleChangeConfirmedResponseSchema = z.object({
  address: z.string(),
  action: z.enum(["register", "revoke"]),
  role: z.string(),
  txHash: z.string(),
  roles,
  profileStored: z.boolean(),
});

export const publicProfileResponseSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  location: z.string().nullable(),
  roles,
});

const profileFieldsSchema = z.object({
  name: z.string().nullable(),
  contactPhone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  location: z.string().nullable(),
  availability: z.string().nullable(),
  details: jsonObject,
});

export const myProfileResponseSchema = z.object({
  address: z.string(),
  roles,
  profile: profileFieldsSchema,
});

export const availabilityResponseSchema = z.object({
  address: z.string(),
  availability: z.string(),
});

export const myBatchesResponseSchema = z.object({
  holding: z.array(chainBatchSchema),
  listedByMe: z.array(chainBatchSchema),
  awaitingMyConfirmation: z.array(chainBatchSchema),
});

export const adminParticipantsResponseSchema = z.object({
  participants: z.array(
    z.object({
      address: z.string(),
      name: z.string().nullable(),
      location: z.string().nullable(),
      availability: z.string().nullable(),
      roles,
    }),
  ),
});

export const createdBatchesResponseSchema = z.object({
  batches: z.array(
    chainBatchSchema.extend({
      harvestDate: z.string().nullable(),
      createdBlock: z.number(),
      createdAt: z.string(),
    }),
  ),
});
