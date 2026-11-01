import { useState } from "react";
import {
  getMyProfile,
  readableError,
  updateMyAvailability,
  updateMyProfile,
} from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { useAsync } from "../../../hooks/useAsync";
import { roleLabel } from "../../../auth/roles";
import { PROFILE_DETAILS } from "../../../forms/profileFields";
import Card from "../../../components/Card";
import Field from "../../../components/Field";
import Button from "../../../components/Button";
import Badge from "../../../components/Badge";
import AddressChip from "../../../components/AddressChip";
import { Loading, ErrorMessage } from "../../../components/State";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";
import "./style.css";

const P = TEXT.profile;
const A = TEXT.availability;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared profile fields with their API names. `address` is the postal
// address.
const BASE_FIELDS = [
  { name: "name", label: P.name, hint: P.nameHint },
  { name: "location", label: P.location, hint: P.locationHint },
  { name: "contactPhone", label: P.contactPhone, type: "tel" },
  { name: "email", label: P.email, type: "email" },
  { name: "address", label: P.postal, hint: P.contactHint, type: "textarea" },
];

const asText = (value) =>
  value === null || value === undefined ? "" : String(value);

// Only the fields that differ from the stored profile are sent.
function changedFields(stored, form, detailFields) {
  const body = {};
  for (const { name } of BASE_FIELDS) {
    const value = asText(form[name]).trim();
    if (value !== asText(stored[name])) body[name] = value;
  }
  const details = {};
  for (const { name } of detailFields) {
    const value = asText(form[name]).trim();
    if (value !== asText(stored.details[name])) details[name] = value;
  }
  if (Object.keys(details).length) body.details = details;
  return body;
}

function Input({ field, value, onChange, disabled }) {
  const props = {
    id: field.name,
    value,
    disabled,
    onChange: (e) => onChange(field.name, e.target.value),
  };
  if (field.type === "textarea") return <textarea rows={3} {...props} />;
  return <input type={field.type || "text"} maxLength={field.max} {...props} />;
}

function Availability({ me, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isTransporter = me.roles.includes("TRANSPORTER");
  const unavailable = me.profile.availability === "unavailable";

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      await updateMyAvailability(unavailable ? "available" : "unavailable");
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={A.title}>
      <p className="settings__status">
        {unavailable ? (
          <Badge tone="warning">{A.unavailable}</Badge>
        ) : (
          <Badge tone="success">{A.available}</Badge>
        )}
      </p>
      <p className="form-page__intro">
        {isTransporter ? A.transporter : A.facility}
      </p>
      <Button variant="secondary" onClick={toggle} disabled={saving}>
        {saving ? A.working : unavailable ? A.makeAvailable : A.makeUnavailable}
      </Button>
      <ErrorMessage error={error} />
    </Card>
  );
}

function ProfileForm({ me, onSaved }) {
  const stored = { ...me.profile, details: me.profile.details || {} };
  const role = me.roles[0];
  const detailFields = (role && PROFILE_DETAILS[role]) || [];
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const form = {
    ...Object.fromEntries(
      BASE_FIELDS.map((f) => [f.name, asText(stored[f.name])]),
    ),
    ...Object.fromEntries(
      detailFields.map((f) => [f.name, asText(stored.details[f.name])]),
    ),
    ...edits,
  };
  const serverErrors =
    (result && result.error && result.error.fieldErrors) || {};
  const fieldErrors = { ...serverErrors, ...errors };

  function change(name, value) {
    setEdits((e) => ({ ...e, [name]: value }));
    setResult(null);
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = P.needName;
    const email = form.email.trim();
    if (email && !EMAIL.test(email)) next.email = P.badEmail;
    if (!email && stored.email) next.email = P.emailKept;
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = changedFields(stored, form, detailFields);
    if (!Object.keys(body).length) {
      setResult({ message: P.nothing });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      await updateMyProfile(body);
      setEdits({});
      setResult({ message: P.saved });
      onSaved();
    } catch (err) {
      setResult({ error: readableError(err) });
    } finally {
      setSaving(false);
    }
  }

  const field = (f) => (
    <Field
      key={f.name}
      label={f.label}
      name={f.name}
      hint={f.hint}
      error={fieldErrors[f.name]}
    >
      <Input
        field={f}
        value={form[f.name]}
        onChange={change}
        disabled={saving}
      />
    </Field>
  );

  return (
    <Card title={P.title}>
      <p className="form-page__intro">{P.intro}</p>
      <form onSubmit={submit} noValidate>
        {BASE_FIELDS.map(field)}
        {detailFields.length > 0 && (
          <fieldset className="settings__details" disabled={saving}>
            <legend>{P.details}</legend>
            {me.roles.length > 1 && (
              <p className="form-page__hint">{P.detailsFor(roleLabel(role))}</p>
            )}
            {detailFields.map(field)}
          </fieldset>
        )}
        <div className="form-page__links">
          <Button type="submit" disabled={saving}>
            {saving ? P.saving : P.save}
          </Button>
        </div>
        {result && result.message && (
          <p className="settings__saved" role="status">
            {result.message}
          </p>
        )}
        {result && result.error && (
          <p className="settings__error" role="alert">
            {result.error.message}
          </p>
        )}
      </form>
    </Card>
  );
}

// Profile and Settings for every signed in role (GET and PATCH /me/profile,
// PATCH /me/availability).
export default function Settings() {
  const { session } = useAuth();
  const me = useAsync(getMyProfile, session.address);
  const noProfile = me.error && me.error.status === 404;
  const isAdmin = session.roles.includes("admin");
  // Availability only matters for those who can be chosen or claim jobs.
  const showAvailability = me.data && me.data.roles.some((r) => r !== "FARMER");

  return (
    <div className="settings">
      <h1 className="settings__title">{TEXT.title}</h1>

      {me.loading && !me.data && <Loading text={TEXT.loading} />}
      {noProfile && (
        <Card>
          <p>{isAdmin ? TEXT.adminNoProfile : TEXT.noProfile}</p>
        </Card>
      )}
      {!noProfile && <ErrorMessage error={me.error} onRetry={me.reload} />}

      {me.data && (
        <>
          <Card title={TEXT.account.title}>
            <dl className="form-page__facts">
              <dt>{TEXT.account.wallet}</dt>
              <dd>
                <AddressChip address={me.data.address} />
              </dd>
              <dt>{TEXT.account.roles}</dt>
              <dd>
                {me.data.roles.length
                  ? me.data.roles.map(roleLabel).join(", ")
                  : TEXT.account.noRoles}
              </dd>
            </dl>
          </Card>
          {showAvailability && (
            <Availability me={me.data} onChanged={me.reload} />
          )}
          <ProfileForm key={me.data.address} me={me.data} onSaved={me.reload} />
        </>
      )}
    </div>
  );
}
