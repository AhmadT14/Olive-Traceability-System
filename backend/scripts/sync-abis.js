import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "../contracts/out";
const dest = "src/chain/abis";

fs.mkdirSync(dest, { recursive: true });

for (const name of ["BatchCustody", "ParticipantRegistry"]) {
  const file = path.join(outDir, `${name}.sol`, `${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(
    path.join(dest, `${name}.json`),
    JSON.stringify(artifact.abi, null, 2),
  );
}

console.log("ABIs synced");
