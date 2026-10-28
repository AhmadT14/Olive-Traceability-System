import { getAddress } from "ethers";
import { registry } from "../chain/contracts.js";
import {
  decodeRegistryTx,
  hasAdminRole,
  hasRole,
  ROLES,
} from "../chain/reader.js";
import { config } from "../config.js";
import {
  AppError,
  badRequest,
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
import { parseOrThrow } from "../validation/parse.js";
import { profileDetailsSchemas } from "../validation/participant.schemas.js";

export async function prepareRoleChange(user, body) {
  const parsed = parseOrThrow(prepareRoleChangeSchema, body);
  const address = getAddress(parsed.data.address);
  const { role, action } = parsed.data;

  let profileDetails = {};
  if (action === "register") {
    const detailsResult = profileDetailsSchemas[role].safeParse(
      parsed.data.profile.details,
    );
    if (!detailsResult.success) {
      throw badRequest("invalid profile details", detailsResult.error.flatten());
    }
    profileDetails = detailsResult.data;
  }

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
      transaction: {
        to: config.REGISTRY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("registry read failed", err);
  }
}

export async function confirmRoleChange(user, body) {
  const parsed = parseOrThrow(confirmRoleChangeSchema, body);
  const address = getAddress(parsed.data.address);
  const { action, role, txHash } = parsed.data;

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
      const profile = parsed.data.profile;
      const profileDetails = profile.details ?? {};
      const profileValues = {
        walletAddress: address.toLowerCase(),
        name: profile.name,
        ...(profile.contactPhone === undefined
          ? {}
          : { contactPhone: profile.contactPhone }),
        ...(profile.email === undefined ? {} : { email: profile.email }),
        ...(profile.address === undefined ? {} : { address: profile.address }),
        ...(profile.location === undefined
          ? {}
          : { location: profile.location }),
        ...(profile.availability === undefined
          ? {}
          : { availability: profile.availability }),
        details: profileDetails,
      };
      const { walletAddress: _walletAddress, ...profileUpdates } =
        profileValues;

      await runInTransaction(async (exec) => {
        await participantRepository.insertIgnore(
          address.toLowerCase(),
          exec,
        );
        await participantRepository.upsertProfile(
          profileValues,
          profileUpdates,
          exec,
        );
      });
    }

    const activeRoles = await Promise.all(
      roleNames.map(async (name) => ((await hasRole(name, address)) ? name : null)),
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
