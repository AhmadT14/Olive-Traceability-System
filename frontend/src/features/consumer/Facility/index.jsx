import { getParticipantProfile } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { shortAddress } from "../../../utils/format";
import { useLanguage } from "../language/useLanguage";
import "./style.css";

// Facility name (and location) for a wallet. The address stays in the tooltip.
export default function Facility({ address, withLocation = false }) {
  const { text: TEXT } = useLanguage();
  const { data, loading } = useAsync(
    () => getParticipantProfile(address),
    address || null,
  );
  if (!address) return null;
  // "Registered participant" is only for a wallet that really has no name.
  if (loading && !data) {
    return (
      <span className="facility" title={address}>
        <span className="facility__name">...</span>
      </span>
    );
  }

  const name =
    (data && data.name) ||
    `${TEXT.trace.unknownFacility} ${shortAddress(address)}`;
  return (
    <span className="facility" title={address}>
      <bdi className="facility__name">{name}</bdi>
      {withLocation && data && data.location && (
        <bdi className="facility__location">{data.location}</bdi>
      )}
    </span>
  );
}
