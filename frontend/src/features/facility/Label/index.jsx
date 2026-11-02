import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Button from "../../../components/Button";
import { traceUrl } from "../flow";
import { TEXT } from "../strings";
import "./style.css";

const T = TEXT.label;

// A print view outside the app shell: QR code, batch ID and the public link.
export default function Label({ role }) {
  const { batchId } = useParams();
  const url = traceUrl(batchId);

  return (
    <main className="label-page">
      <div className="label">
        <h1 className="label__brand">{T.brand}</h1>
        <QRCodeSVG value={url} size={220} marginSize={2} title={T.scan} />
        <p className="label__scan">{T.scan}</p>
        <p className="label__batch">
          {T.batch} <strong>{batchId}</strong>
        </p>
        <p className="label__url">{url}</p>
      </div>
      <div className="label-page__actions">
        <Button onClick={() => window.print()}>{T.print}</Button>
        <Link to={`/${role}/inbox`} className="button button--secondary">
          {T.back}
        </Link>
      </div>
    </main>
  );
}
