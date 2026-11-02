import { getAddress } from "ethers";
import { provider, registry } from "../chain/contracts.js";
import {
  decodeRegistryTx,
  hasAdminRole,
  hasRole,
  ROLES,
} from "../chain/reader.js";
import { config } from "../config.js";
import { simulateTransaction } from "../chain/simulate.js";
import {
  AppError,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import * as participantRepository from "../repositories/participant.repository.js";
import { runInTransaction } from "../repositories/unitOfWork.js";
import {
  confirmRoleChangeSchema,
  prepareRoleChangeSchema,
  roleNames,
} from "../validation/admin.schemas.js";
import { parseBody } from "../validation/parse.js";
import { readRoles } from "./participant.service.js";
import { buildRoleProfile } from "./roleProfile.js";

const prepareTransaction = (user, to, data) =>
  simulateTransaction(provider, config.CHAIN_ID, user.address, {
    to,
    data,
    value: "0x0",
  });

export async function prepareRoleChange(user, body) {
  const parsed = parseBody(prepareRoleChangeSchema, body);
  const address = getAddress(parsed.address);
  const { role, action } = parsed;

  try {
    if (!(await hasAdminRole(user.address))) {
      throw forbidden("caller is not a registry admin");
    }

    const alreadyHasRole = await hasRole(role, address);
    if (action === "register" && alreadyHasRole) {
      throw conflict("participant already has this role");
    }
    if (action === "revoke" && !alreadyHasRole) {
      throw conflict("participant does not have this role");
    }

    const functionName =
      action === "register" ? "registerParticipant" : "revokeParticipant";
    const data = registry.interface.encodeFunctionData(functionName, [
      address,
      ROLES[role],
    ]);

    return {
      address,
      role,
      action,
      transaction: await prepareTransaction(
        user,
        config.REGISTRY_ADDRESS,
        data,
      ),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("registry read failed", err);
  }
}

export async function confirmRoleChange(user, body) {
  const parsed = parseBody(confirmRoleChangeSchema, body);
  const address = getAddress(parsed.address);
  const { action, role, txHash } = parsed;

  try {
    if (!(await hasAdminRole(user.address))) {
      throw forbidden("caller is not a registry admin");
    }

    const decoded = await decodeRegistryTx(txHash);
    if (!decoded?.success) {
      throw notFound("transaction not found or failed");
    }

    const eventName = action === "register" ? "RoleGranted" : "RoleRevoked";
    const roleEvent = decoded.events.find(
      (event) =>
        event.name === eventName &&
        String(event.args.role).toLowerCase() === ROLES[role].toLowerCase() &&
        event.args.account?.toLowerCase() === address.toLowerCase() &&
        event.args.sender?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!roleEvent) {
      throw conflict(
        `transaction has no matching ${eventName} event from caller`,
      );
    }

    const roleActive = await hasRole(role, address);
    if (roleActive !== (action === "register")) {
      throw conflict("on-chain role state does not match the action");
    }

    if (action === "register") {
      const { values: profileValues, updates: profileUpdates } =
        buildRoleProfile(address, role, parsed.profile);

      await runInTransaction(async (exec) => {
        await participantRepository.insertIgnore(address.toLowerCase(), exec);
        await participantRepository.upsertProfile(
          profileValues,
          profileUpdates,
          exec,
        );
      });
    }

    const activeRoles = await Promise.all(
      roleNames.map(async (name) =>
        (await hasRole(name, address)) ? name : null,
      ),
    );

    return {
      address,
      action,
      role,
      txHash,
      roles: activeRoles.filter(Boolean),
      profileStored: action === "register",
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("role change confirmation failed", err);
  }
}

// The admin's directory: every participant the backend has a record for, with
// the roles they hold on chain right now. A participant whose roles were all
// revoked still appears, with an empty list, so they can be registered again.
export async function listParticipants(user) {
  try {
    if (!(await hasAdminRole(user.address))) {
      throw forbidden("caller is not a registry admin");
    }

    const rows = await participantRepository.listDirectory();
    const roles = await Promise.all(rows.map((row) => readRoles(row.address)));

    return {
      participants: rows.map((row, index) => ({
        address: row.address,
        name: row.name ?? null,
        location: row.location ?? null,
        availability: row.availability ?? null,
        roles: roles[index],
      })),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("participant directory lookup failed", err);
  }
}
