// End-to-end check of a running stack. It signs real transactions with
// Anvil's dev wallets and walks one batch through every stage, then exercises
// the profile, availability, job-board and admin routes.
//
//   docker compose up --build      (in the repo root, wait until it settles)
//   npm run test:e2e               (in backend/)
//
// Settings, all optional:
//   API_URL  the backend         (default http://localhost:3000)
//   RPC_URL  the Anvil node      (default http://127.0.0.1:8545)
//
// Each run creates its own batch, so it can be repeated. Anything it changes
// on a profile is put back at the end. It only works against the seeded demo
// stack (Anvil accounts 0-7), never a real network.
import { HDNodeWallet, JsonRpcProvider, Wallet } from "ethers";

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const MNEMONIC = "test test test test test test test test test test test junk";

const ACCOUNT = {
  ADMIN: 0,
  FARMER: 1,
  MILL: 2,
  TRANSPORTER: 3,
  STORAGE: 4,
  EXPORTER: 5,
  IMPORTER: 6,
  RETAILER: 7,
};

// cacheTimeout -1: ethers otherwise reuses a nonce it fetched a moment ago.
const provider = new JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: -1 });
const privateKey = (role) =>
  HDNodeWallet.fromPhrase(
    MNEMONIC,
    undefined,
    `m/44'/60'/0'/0/${ACCOUNT[role]}`,
  ).privateKey;
const address = (role) => new Wallet(privateKey(role)).address;

// ---- tiny assertion helpers ------------------------------------------------

let failures = 0;
function check(label, condition, detail = "") {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) {
    failures += 1;
    if (detail) console.log(`       ${detail}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = text;
  try {
    json = JSON.parse(text);
  } catch {
    // leave the raw text
  }
  return { status: response.status, body: json };
}

// ---- sessions and the prepare -> sign -> save workflow ----------------------

const sessions = {};
async function as(role) {
  if (!sessions[role]) {
    const wallet = new Wallet(privateKey(role), provider);
    const nonce = await api("POST", "/auth/nonce", {
      body: { address: wallet.address },
    });
    const signature = await wallet.signMessage(nonce.body.message);
    const login = await api("POST", "/auth/login", {
      body: { address: wallet.address, signature },
    });
    if (login.status !== 200) {
      throw new Error(`login as ${role} failed: ${JSON.stringify(login.body)}`);
    }
    sessions[role] = { ...login.body, wallet };
  }
  return sessions[role];
}

const call = async (role, method, path, body) =>
  api(method, path, { token: (await as(role)).token, body });

// Prepares a transaction, signs and sends it from the role's wallet, then
// saves the record. Throws on any unexpected status so a broken step stops the
// run with the reason instead of cascading into confusing failures.
async function step(label, role, preparePath, body, savePath, extraSave = {}) {
  const session = await as(role);
  const prepared = await api("POST", preparePath, {
    token: session.token,
    body,
  });
  if (prepared.status !== 200) {
    throw new Error(
      `${label}: prepare ${prepared.status} ${JSON.stringify(prepared.body)}`,
    );
  }

  const nonce = await provider.getTransactionCount(
    session.wallet.address,
    "latest",
  );
  const tx = await session.wallet.sendTransaction({
    to: prepared.body.transaction.to,
    data: prepared.body.transaction.data,
    value: 0,
    nonce,
  });
  await tx.wait();

  // Everything except the routing fields is the record that was hashed.
  const {
    batchId: _batchId,
    destinationAddress: _destination,
    targetAddress: _target,
    ...record
  } = body;
  const saved = await api("POST", savePath, {
    token: session.token,
    body: { txHash: tx.hash, ...record, ...extraSave },
  });
  if (saved.status !== 201) {
    throw new Error(
      `${label}: save ${saved.status} ${JSON.stringify(saved.body)}`,
    );
  }
}

const ids = (response, key) => (response.body[key] ?? []).map((b) => b.batchId);

// ---- the run ---------------------------------------------------------------

async function sessionAndPublicProfile() {
  console.log("\n# login and public profile");
  const farmer = await as("FARMER");
  const admin = await as("ADMIN");
  check("farmer is not an admin, admin is", !farmer.isAdmin && admin.isAdmin);

  const seconds = (Date.parse(farmer.expiresAt) - Date.now()) / 1000;
  check(
    "token expiry is about an hour away",
    seconds > 3000 && seconds <= 3600,
  );

  const me = await call("FARMER", "GET", "/auth/me");
  check(
    "/auth/me returns roles, isAdmin and the same expiry",
    me.status === 200 &&
      me.body.roles.includes("FARMER") &&
      me.body.isAdmin === false &&
      me.body.expiresAt === farmer.expiresAt,
  );

  const publicProfile = await api(
    "GET",
    `/participants/${address("MILL")}/profile`,
  );
  check(
    "public profile shows name, location and roles only",
    publicProfile.status === 200 &&
      publicProfile.body.name === "Al-Salam Olive Mill" &&
      publicProfile.body.roles.includes("MILL") &&
      !("email" in publicProfile.body) &&
      !("contactPhone" in publicProfile.body),
    JSON.stringify(publicProfile.body),
  );
  check(
    "public profile: unknown wallet 404, malformed 400",
    (
      await api(
        "GET",
        "/participants/0x0000000000000000000000000000000000000001/profile",
      )
    ).status === 404 &&
      (await api("GET", "/participants/nope/profile")).status === 400,
  );
}

async function supplyChain(batchId) {
  console.log(`\n# supply chain, batch ${batchId}`);

  const olivePickup = {
    truck_details: "Truck 7",
    quantity_picked_up: 100,
    loading_details: "loaded",
    transport_conditions: "cool",
    pickup_condition: "good",
    olive_condition: "fresh",
  };
  const oilPickup = {
    truck_details: "Truck 7",
    quantity_picked_up: 100,
    loading_details: "loaded",
    transport_conditions: "cool",
    oil_condition: "good",
    packaging_condition: "sealed",
  };
  const oliveDelivery = {
    quantity_delivered: 99.5,
    unloading_details: "unloaded",
    transport_conditions: "cool",
    olive_condition: "fresh",
  };
  const oilDelivery = {
    quantity_delivered: 99.5,
    unloading_details: "unloaded",
    transport_conditions: "cool",
    oil_condition: "good",
    packaging_condition: "sealed",
  };
  const leg = async (kind, toRole) => {
    const olive = kind === "olive";
    await step(
      `${kind} claim`,
      "TRANSPORTER",
      "/batches/prepare-claim",
      { batchId, ...(olive ? olivePickup : oilPickup) },
      `/batches/${batchId}/transporter-claim`,
    );
    await step(
      `${kind} handover`,
      "TRANSPORTER",
      "/batches/prepare-handover",
      {
        batchId,
        targetAddress: address(toRole),
        ...(olive ? oliveDelivery : oilDelivery),
      },
      `/batches/${batchId}/transporter-handover`,
    );
  };

  const destinations = await call("FARMER", "GET", "/destinations?role=MILL");
  check(
    "farmer can pick the mill by name",
    destinations.body.destinations?.some(
      (d) => d.name === "Al-Salam Olive Mill",
    ),
    JSON.stringify(destinations.body),
  );

  await step(
    "farm create",
    "FARMER",
    "/batches/prepare",
    {
      batchId,
      destinationAddress: address("MILL"),
      harvest_date: "2026-10-01",
      location: "Nablus",
      olive_type: "Nabali",
      quantity: 1200.5,
      cultivation_method: "organic",
    },
    "/batches",
    { batchId },
  );
  check("farmer created and listed the batch", true);

  let farmerBatches = await call("FARMER", "GET", "/me/batches");
  check(
    "farmer sees it under listedByMe",
    ids(farmerBatches, "listedByMe").includes(batchId),
  );

  const openJobs = await call("TRANSPORTER", "GET", "/transporter-jobs");
  check(
    "open job board shows it as available",
    openJobs.body.jobs?.some(
      (j) => j.batchId === batchId && j.status === "available",
    ),
  );
  const ownJobs = async () =>
    (await call("TRANSPORTER", "GET", "/transporter-jobs?mine=true")).body.jobs;
  check(
    "transporter has no job for this batch yet",
    !(await ownJobs()).some((j) => j.batchId === batchId),
  );

  await leg("olive", "MILL");

  check(
    "own job is found after handover (handover_pending)",
    (await ownJobs()).find((j) => j.batchId === batchId)?.status ===
      "handover_pending",
    JSON.stringify(await ownJobs()),
  );
  check(
    "mill sees it awaitingMyConfirmation",
    ids(
      await call("MILL", "GET", "/me/batches"),
      "awaitingMyConfirmation",
    ).includes(batchId),
  );
  check(
    "transporter still holds it until the mill confirms",
    ids(await call("TRANSPORTER", "GET", "/me/batches"), "holding").includes(
      batchId,
    ),
  );

  await step(
    "mill receipt",
    "MILL",
    "/batches/prepare-receipt",
    {
      batchId,
      arrival_condition: "ok",
      quantity_received: 99.5,
      olive_quality: "A",
      storage_condition: "cool",
    },
    `/batches/${batchId}/mill-intake`,
  );
  check(
    "completed job drops off the transporter's list",
    !(await ownJobs()).some((j) => j.batchId === batchId),
  );
  check(
    "mill now holds the batch",
    ids(await call("MILL", "GET", "/me/batches"), "holding").includes(batchId),
  );

  await step(
    "mill listing",
    "MILL",
    "/batches/prepare-listing",
    {
      batchId,
      destinationAddress: address("STORAGE"),
      pressing_date: "2026-10-05",
      extraction_method: "cold",
      output_quantity: 20,
      oil_quality: "extra virgin",
      packaging_details: "bottled",
      qr_code_reference: `QR-${batchId}`,
    },
    `/batches/${batchId}/mill-outgoing`,
  );
  await leg("oil", "STORAGE");
  await step(
    "storage receipt",
    "STORAGE",
    "/batches/prepare-receipt",
    {
      batchId,
      quantity_received: 19.9,
      storage_start_date: "2026-10-08",
      expected_duration: 90,
      conditions: "cool",
      product_condition: "good",
    },
    `/batches/${batchId}/receipt`,
  );
  await step(
    "storage listing",
    "STORAGE",
    "/batches/prepare-storage-listing",
    {
      batchId,
      destinationAddress: address("EXPORTER"),
      quantity_released: 19.9,
      storage_end_date: "2026-12-01",
      product_condition: "good",
      packaging_condition: "sealed",
      loading_details: "pallet",
    },
    `/batches/${batchId}/storage-outgoing`,
  );
  await leg("oil", "EXPORTER");
  await step(
    "exporter receipt",
    "EXPORTER",
    "/batches/prepare-receipt",
    {
      batchId,
      quantity_received: 19.8,
      shipment_arrival_details: "arrived",
      received_product_details: "ok",
      product_condition: "good",
    },
    `/batches/${batchId}/receipt`,
  );
  await step(
    "exporter listing",
    "EXPORTER",
    "/batches/prepare-exporter-listing",
    {
      batchId,
      destinationAddress: address("IMPORTER"),
      quantity_shipped: 19.8,
      shipment_details: "container",
      product_condition: "good",
      packaging_condition: "sealed",
    },
    `/batches/${batchId}/exporter-outgoing`,
  );
  await leg("oil", "IMPORTER");
  await step(
    "importer receipt",
    "IMPORTER",
    "/batches/prepare-receipt",
    {
      batchId,
      quantity_received: 19.7,
      shipment_arrival_details: "arrived",
      received_product_details: "ok",
      product_condition: "good",
    },
    `/batches/${batchId}/receipt`,
  );
  await step(
    "importer listing",
    "IMPORTER",
    "/batches/prepare-importer-listing",
    {
      batchId,
      destinationAddress: address("RETAILER"),
      quantity_shipped: 19.7,
      shipment_details: "van",
      product_condition: "good",
      packaging_condition: "sealed",
    },
    `/batches/${batchId}/importer-outgoing`,
  );
  await leg("oil", "RETAILER");
  await step(
    "retailer receipt",
    "RETAILER",
    "/batches/prepare-receipt",
    {
      batchId,
      quantity_received: 19.6,
      final_receipt_details: "on the shelf",
      product_condition: "good",
    },
    `/batches/${batchId}/receipt`,
  );

  const chain = await api("GET", `/batches/${batchId}/chain`);
  check(
    "batch ends at the retailer",
    chain.body.stage === "Retailer" &&
      chain.body.custodian.toLowerCase() === address("RETAILER").toLowerCase(),
    JSON.stringify(chain.body),
  );
  const verify = await api("GET", `/batches/${batchId}/verify`);
  const statuses = (verify.body.events ?? []).map((e) => e.integrity.status);
  check(
    "every one of the 20 events verifies against the chain",
    verify.body.integrityStatus === "verified" &&
      statuses.length === 20 &&
      statuses.every((s) => s === "verified"),
    `${verify.body.integrityStatus}: ${statuses.join(",")}`,
  );
}

async function availabilityRules(batchId) {
  console.log("\n# availability");
  const setAvailability = (role, availability) =>
    call(role, "PATCH", "/me/availability", { availability });
  const listsMill = async () =>
    (
      await call("FARMER", "GET", "/destinations?role=MILL")
    ).body.destinations.some(
      (d) => d.address.toLowerCase() === address("MILL").toLowerCase(),
    );

  const farm = {
    batchId: `${batchId}-AV`,
    destinationAddress: address("MILL"),
    harvest_date: "2026-10-01",
    location: "Nablus",
    olive_type: "Nabali",
  };

  try {
    await setAvailability("MILL", "unavailable");
    check("unavailable mill is hidden from the dropdown", !(await listsMill()));
    const refused = await call("FARMER", "POST", "/batches/prepare", farm);
    check(
      "creating a batch for an unavailable mill is refused (409)",
      refused.status === 409 && /unavailable/.test(refused.body.error),
      JSON.stringify(refused.body),
    );
  } finally {
    await setAvailability("MILL", "available");
  }
  check(
    "mill is back in the dropdown and accepted again",
    (await listsMill()) &&
      (await call("FARMER", "POST", "/batches/prepare", farm)).status === 200,
  );

  // An unavailable transporter cannot claim, and an unavailable facility
  // cannot stop a delivery that is already on its way.
  await step(
    "availability farm",
    "FARMER",
    "/batches/prepare",
    farm,
    "/batches",
    {
      batchId: farm.batchId,
    },
  );
  const pickup = {
    batchId: farm.batchId,
    truck_details: "Truck 7",
    quantity_picked_up: 100,
    pickup_condition: "good",
    olive_condition: "fresh",
  };
  try {
    await setAvailability("TRANSPORTER", "unavailable");
    const refused = await call(
      "TRANSPORTER",
      "POST",
      "/batches/prepare-claim",
      pickup,
    );
    check(
      "unavailable transporter cannot claim (409)",
      refused.status === 409 && /unavailable/.test(refused.body.error),
      JSON.stringify(refused.body),
    );
  } finally {
    await setAvailability("TRANSPORTER", "available");
  }
  await step(
    "availability claim",
    "TRANSPORTER",
    "/batches/prepare-claim",
    pickup,
    `/batches/${farm.batchId}/transporter-claim`,
  );
  try {
    await setAvailability("MILL", "unavailable");
    const handover = await call(
      "TRANSPORTER",
      "POST",
      "/batches/prepare-handover",
      {
        batchId: farm.batchId,
        targetAddress: address("MILL"),
        quantity_delivered: 99,
        olive_condition: "fresh",
      },
    );
    check(
      "a delivery already in transit is not blocked",
      handover.status === 200,
      JSON.stringify(handover.body),
    );
  } finally {
    await setAvailability("MILL", "available");
  }
}

async function createdBatches(batchId) {
  console.log("\n# farmer's created batches");
  const list = await call("FARMER", "GET", "/me/batches/created");
  const batches = list.body.batches ?? [];
  const main = batches.find((b) => b.batchId === batchId);
  const newer = batches.find((b) => b.batchId === `${batchId}-AV`);

  check("the list answers 200", list.status === 200, JSON.stringify(list.body));
  check(
    "a batch that has travelled to the retailer is still in the farmer's list",
    main?.stage === "Retailer",
    JSON.stringify(main),
  );
  check(
    "each entry has its harvest date, creation block and ISO creation time",
    main?.harvestDate === "2026-10-01" &&
      Number.isInteger(main.createdBlock) &&
      !Number.isNaN(Date.parse(main.createdAt)),
    JSON.stringify(main),
  );
  check(
    "newest first: the later batch is listed before the earlier one",
    newer && batches.indexOf(newer) < batches.indexOf(main),
    batches.map((b) => `${b.batchId}@${b.createdBlock}`).join(", "),
  );
  check(
    "the list is sorted by creation block, newest first",
    batches.every(
      (b, i) => i === 0 || batches[i - 1].createdBlock >= b.createdBlock,
    ),
  );
  check(
    "a batch the transporter has claimed shows its live state, held by the transporter",
    newer?.stage === "Farm" &&
      newer.custodian.toLowerCase() === address("TRANSPORTER").toLowerCase(),
    JSON.stringify(newer),
  );
  check(
    "only farmers can ask (mill 403), and a token is required (401)",
    (await call("MILL", "GET", "/me/batches/created")).status === 403 &&
      (await api("GET", "/me/batches/created")).status === 401,
  );
}

async function profilesAndAdmin() {
  console.log("\n# profiles and admin directory");
  const original = (await call("MILL", "GET", "/me/profile")).body.profile;
  try {
    const patched = await call("MILL", "PATCH", "/me/profile", {
      name: "Al-Salam Mill (e2e)",
      contactPhone: "+970 59 999 9999",
      details: { processingCapacity: 7000 },
    });
    check(
      "editing a profile changes the sent fields and keeps the rest",
      patched.status === 200 &&
        patched.body.profile.name === "Al-Salam Mill (e2e)" &&
        patched.body.profile.email === original.email &&
        patched.body.profile.details.processingCapacity === 7000 &&
        patched.body.profile.details.facilityName ===
          original.details.facilityName,
      JSON.stringify(patched.body),
    );
    check(
      "the new name shows on the public profile",
      (await api("GET", `/participants/${address("MILL")}/profile`)).body
        .name === "Al-Salam Mill (e2e)",
    );
    check(
      "an empty body, a bad email and bad details are all 422",
      (await call("MILL", "PATCH", "/me/profile", {})).status === 422 &&
        (await call("MILL", "PATCH", "/me/profile", { email: "nope" }))
          .status === 422 &&
        (
          await call("MILL", "PATCH", "/me/profile", {
            details: { facilityName: 123 },
          })
        ).status === 422,
    );
    check(
      "availability only accepts available or unavailable",
      (
        await call("MILL", "PATCH", "/me/availability", {
          availability: "busy",
        })
      ).status === 422,
    );
  } finally {
    await call("MILL", "PATCH", "/me/profile", {
      name: original.name,
      contactPhone: original.contactPhone ?? "",
      details: original.details,
    });
  }

  check(
    "a wallet with no profile gets 404, not a crash (admin has none)",
    (await call("ADMIN", "GET", "/me/profile")).status === 404,
  );

  const directory = await call("ADMIN", "GET", "/admin/participants");
  const byName = Object.fromEntries(
    (directory.body.participants ?? []).map((p) => [p.name, p]),
  );
  check(
    "admin directory lists all seven demo participants with roles",
    directory.status === 200 &&
      Object.keys(byName).length >= 7 &&
      byName["Al-Salam Olive Mill"]?.roles.includes("MILL") &&
      byName["Green Table Market"]?.roles.includes("RETAILER"),
    JSON.stringify(directory.body).slice(0, 200),
  );
  check(
    "admin directory: 403 for a non-admin, 401 without a token",
    (await call("FARMER", "GET", "/admin/participants")).status === 403 &&
      (await api("GET", "/admin/participants")).status === 401,
  );
}

async function main() {
  const health = await api("GET", "/health").catch(() => null);
  if (health?.status !== 200) {
    console.error(
      `The backend at ${API_URL} is not answering. Start the stack first ` +
        "(docker compose up --build) and wait for it to settle.",
    );
    process.exit(2);
  }

  const batchId = `E2E-${Date.now()}`;
  await sessionAndPublicProfile();
  await supplyChain(batchId);
  await availabilityRules(batchId);
  await createdBatches(batchId);
  await profilesAndAdmin();

  console.log(
    failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nStopped: ${err.message}`);
  process.exit(1);
});
