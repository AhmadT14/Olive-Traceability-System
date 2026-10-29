import { getParticipantProfile } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { shortAddress } from "../../../utils/format";
import { TEXT } from "../strings";
import "./style.css";

// Facility name (and location) for a wallet. The address stays in the tooltip.
export default function Facility({ address, withLocation = false }) {
  const { data } = useAsync(
    () => getParticipantProfile(address),
    address || null,
  );
  if (!address) return null;

  const name =
    (data && data.name) ||
    `${TEXT.trace.unknownFacility} ${shortAddress(address)}`;
  return (
    <span className="facility" title={address}>
      <span className="facility__name">{name}</span>
      {withLocation && data && data.location && (
        <span className="facility__location">{data.location}</span>
      )}
    </span>
  );
}
