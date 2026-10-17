import { Router } from "express";
import { isAddress, getAddress } from "ethers";
import { z } from "zod";
import { db } from "../db/db.js";
import { participantProfiles, participants } from "../db/schema.js";
import {
  decodeRegistryTx,
  hasAdminRole,
  hasRole,
  ROLES,
} from "../chain/reader.js";
import { registry } from "../chain/contracts.js";
import { config } from "../config.js";
import { requireAuth } from "../auth/middleware.js";

const router = Router();
const roleNames = Object.keys(ROLES);
const prepareRoleChangeSchema = z.object({
  address: z.string().refine(isAddress, "must be a valid wallet address"),
  role: z.enum(roleNames),
  action: z.enum(["register", "revoke"]),
});
const roleChangeIdentity = {
  address: z.string().refine(isAddress, "must be a valid wallet address"),
  role: z.enum(roleNames),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
};
const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contactPhone: z.string().max(64).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().optional(),
  location: z.string().max(255).optional(),
});
const confirmRoleChangeSchema = z.discriminatedUnion("action", [
  z.object({
    ...roleChangeIdentity,
    action: z.literal("register"),
    profile: profileSchema,
  }),
  z.object({
    ...roleChangeIdentity,
    action: z.literal("revoke"),
  }),
]);

router.post(
  "/admin/participants/prepare-role-change",
  requireAuth,
  async (req, res) => {
    const parsed = prepareRoleChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }

    const address = getAddress(parsed.data.address);
    const { role, action } = parsed.data;

    try {
      if (!(await hasAdminRole(req.user.address))) {
        return res.status(403).json({ error: "caller is not a registry admin" });
      }

      const alreadyHasRole = await hasRole(role, address);
      if (action === "register" && alreadyHasRole) {
        return res.status(409).json({ error: "participant already has this role" });
      }
      if (action === "revoke" && !alreadyHasRole) {
        return res.status(409).json({ error: "participant does not have this role" });
      }

      const functionName = action === "register" ? "registerParticipant" : "revokeParticipant";
      const data = registry.interface.encodeFunctionData(functionName, [
        address,
        ROLES[role],
      ]);

      return res.json({
        address,
        role,
        action,
        transaction: {
          to: config.REGISTRY_ADDRESS,
          data,
          value: "0x0",
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "registry read failed" });
    }
  },
);

router.post(
  "/admin/participants/confirm-role-change",
  requireAuth,
  async (req, res) => {
    const parsed = confirmRoleChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }

    const address = getAddress(parsed.data.address);
    const { action, role, txHash } = parsed.data;

    try {
      if (!(await hasAdminRole(req.user.address))) {
        return res.status(403).json({ error: "caller is not a registry admin" });
      }

      const decoded = await decodeRegistryTx(txHash);
      if (!decoded?.success) {
        return res.status(404).json({ error: "transaction not found or failed" });
      }

      const eventName = action === "register" ? "RoleGranted" : "RoleRevoked";
      const roleEvent = decoded.events.find(
        (event) =>
          event.name === eventName &&
          String(event.args.role).toLowerCase() === ROLES[role].toLowerCase() &&
          event.args.account?.toLowerCase() === address.toLowerCase() &&
          event.args.sender?.toLowerCase() === req.user.address.toLowerCase(),
      );
      if (!roleEvent) {
        return res.status(409).json({
          error: `transaction has no matching ${eventName} event from caller`,
        });
      }

      const roleActive = await hasRole(role, address);
      if (roleActive !== (action === "register")) {
        return res.status(409).json({ error: "on-chain role state does not match the action" });
      }

      if (action === "register") {
        const profile = parsed.data.profile;
        const profileValues = {
          walletAddress: address.toLowerCase(),
          name: profile.name,
          ...(profile.contactPhone === undefined ? {} : { contactPhone: profile.contactPhone }),
          ...(profile.email === undefined ? {} : { email: profile.email }),
          ...(profile.address === undefined ? {} : { address: profile.address }),
          ...(profile.location === undefined ? {} : { location: profile.location }),
        };
        const { walletAddress: _walletAddress, ...profileUpdates } = profileValues;

        await db.transaction(async (tx) => {
          await tx
            .insert(participants)
            .values({ walletAddress: address.toLowerCase() })
            .onConflictDoNothing();
          await tx
            .insert(participantProfiles)
            .values(profileValues)
            .onConflictDoUpdate({
              target: participantProfiles.walletAddress,
              set: profileUpdates,
            });
        });
      }

      const activeRoles = await Promise.all(
        roleNames.map(async (name) => (await hasRole(name, address) ? name : null)),
      );
      return res.json({
        address,
        action,
        role,
        txHash,
        roles: activeRoles.filter(Boolean),
        profileStored: action === "register",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "role change confirmation failed" });
    }
  },
);

export default router;
