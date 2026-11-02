import AddressChip from "../AddressChip";

// Short, copyable transaction hash. There is no block explorer for Anvil.
export default function TxLink({ hash, ...text }) {
  return <AddressChip address={hash} {...text} />;
}
