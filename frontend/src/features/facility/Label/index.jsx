import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Button from "../../../components/Button";
import { ROLE_HOME } from "../../../auth/roles";
import { traceUrl } from "../flow";
import { TEXT } from "../strings";
import "./style.css";

const T = TEXT.label;

// A print view outside the app shell: QR code, batch ID and the public link.
export default function Label({ role }) {
  const { batchId } = useParams();
  const url = traceUrl(batchId);

  return (
    <div className="label-page">
      <div className="label">
        <p className="label__brand">{T.brand}</p>
        <QRCodeSVG value={url} size={220} marginSize={2} />
        <p className="label__scan">{T.scan}</p>
        <p className="label__batch">
          {T.batch} <strong>{batchId}</strong>
        </p>
        <p className="label__url">{url}</p>
      </div>
      <div className="label-page__actions">
        <Button onClick={() => window.print()}>{T.print}</Button>
        <Link to={ROLE_HOME[role]} className="button button--secondary">
          {T.back}
        </Link>
      </div>
    </div>
  );
}
