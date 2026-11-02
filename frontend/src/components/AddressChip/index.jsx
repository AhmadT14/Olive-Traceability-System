import { useState } from "react";
import { shortAddress } from "../../utils/format";
import "./style.css";

// Shows a name (or a short address when there is no name). The full value is
// in the tooltip and the copy button copies it.
export default function AddressChip({
  address,
  name,
  copyText = "Copy",
  copiedText = "Copied",
}) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <span className="address-chip" title={address}>
      <bdi className="address-chip__label">{name || shortAddress(address)}</bdi>
      <button
        type="button"
        className="address-chip__copy"
        onClick={copy}
        aria-label={`${copyText} ${address}`}
      >
        {copied ? copiedText : copyText}
      </button>
    </span>
  );
}
