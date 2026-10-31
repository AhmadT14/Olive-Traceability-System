import { QRCodeSVG } from "qrcode.react";
import { labelPath, traceUrl } from "../flow";
import { TEXT } from "../strings";
import "./style.css";

const T = TEXT.list;

// A small QR of the public page, with a link to the printable label.
export default function QrPreview({ role, batchId, hint = T.qrHint }) {
  return (
    <div className="qr-preview">
      <QRCodeSVG value={traceUrl(batchId)} size={128} marginSize={2} />
      <div>
        <p className="qr-preview__title">{T.qrTitle}</p>
        <p className="form-page__hint">{hint}</p>
        <a href={labelPath(role, batchId)} target="_blank" rel="noreferrer">
          {T.printLabel}
        </a>
      </div>
    </div>
  );
}
