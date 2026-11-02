import { getParticipantProfile } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { isZeroAddress } from "../../utils/format";
import AddressChip from "../AddressChip";

// Facility name for a wallet address, with the address in the tooltip.
export default function ParticipantName({ address }) {
  const empty = isZeroAddress(address);
  const { data, loading } = useAsync(
    () => getParticipantProfile(address),
    empty ? null : address,
  );
  if (empty) return <span>None</span>;
  // No address flashes before the name arrives.
  if (loading && !data) return <span title={address}>...</span>;
  return <AddressChip address={address} name={data && data.name} />;
}
