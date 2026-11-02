import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  confirmRoleChange,
  getParticipantProfile,
  getParticipantRoles,
  prepareRoleChange,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { PARTICIPANT_ROLES, roleLabel } from "../../../auth/roles";
import Card from "../../../components/Card";
import Field from "../../../components/Field";
import Button from "../../../components/Button";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import { shortAddress } from "../../../utils/format";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";
import "./style.css";

const F = TEXT.form;
const R = TEXT.register;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Profile fields of the register form, with the API names. `address` is the
// postal address, so its input gets another id than the wallet field.
const PROFILE_FIELDS = [
  { name: "name", label: R.name, hint: R.nameHint },
  { name: "location", label: R.location, hint: R.locationHint },
  { name: "contactPhone", label: R.contactPhone, type: "tel" },
  { name: "email", label: R.email, type: "email" },
  { name: "address", label: R.postal, hint: R.contactHint },
];
const inputId = (name) => `profile-${name}`;

// Empty fields are left out: the API checks the format of those it gets.
function buildProfile(values) {
  const profile = {};
  for (const { name } of PROFILE_FIELDS) {
    const value = String(values[name] ?? "").trim();
    if (value) profile[name] = value;
  }
  return profile;
}

function Done({ mode, name, role, onAnother }) {
  const T = TEXT[mode];
  return (
    <Card page title={T.doneTitle}>
      <p>{T.done(name, roleLabel(role))}</p>
      {mode === "register" && <p>{R.signIn}</p>}
      <div className="form-page__links">
        <Link to="/admin/participants">{F.toParticipants}</Link>
        <Button variant="secondary" onClick={onAnother}>
          {T.another}
        </Button>
      </div>
    </Card>
  );
}

// Register (grant a role and save the profile) or revoke a role. Both are
// prepare, sign, then confirm with the same address, role and action.
export default function RoleChange({ mode }) {
  const T = TEXT[mode];
  const [params] = useSearchParams();
  const [wallet, setWallet] = useState(() => params.get("address") || "");
  const [role, setRole] = useState(() => params.get("role") || "");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [doneName, setDoneName] = useState("");
  const flow = useTxFlow({
    key: `admin-${mode}`,
    prepare: prepareRoleChange,
    save: confirmRoleChange,
  });

  // A confirm waiting for retry shows the kept payload: it is what gets sent.
  const kept = flow.pending ? flow.pending.payload : null;
  const address = kept ? kept.address : wallet.trim();
  const lookup = ADDRESS.test(address) ? address : null;
  const roles = useAsync(() => getParticipantRoles(lookup), lookup);
  const profile = useAsync(() => getParticipantProfile(lookup), lookup);
  const current = (roles.data && roles.data.roles) || [];
  const known = profile.data;

  // Name and location start from the saved profile until the admin edits them.
  const prefill =
    mode === "register" && known
      ? Object.fromEntries(
          [
            ["name", known.name],
            ["location", known.location],
          ].filter(([, v]) => v),
        )
      : {};
  const profileValues = kept ? kept.profile || {} : { ...prefill, ...values };

  const options = mode === "register" ? PARTICIPANT_ROLES : current;
  const chosen = kept
    ? kept.role
    : role || (mode === "revoke" && current.length === 1 ? current[0] : "");
  const displayName =
    (mode === "register" && String(profileValues.name || "").trim()) ||
    (known && known.name) ||
    shortAddress(address);

  const serverErrors = (flow.error && flow.error.fieldErrors) || {};
  const fieldErrors = { ...serverErrors, ...errors };
  const locked = flow.busy || Boolean(kept);
  const nothingToRevoke =
    mode === "revoke" && roles.data && current.length === 0;

  function validate() {
    const next = {};
    if (!ADDRESS.test(address)) next.address = F.badWallet;
    if (!chosen) next.role = F.pickRole;
    else if (mode === "register" && current.includes(chosen)) {
      next.role = F.alreadyHas;
    }
    if (mode === "register") {
      if (!String(profileValues.name || "").trim()) next.name = R.needName;
      const email = String(profileValues.email || "").trim();
      if (email && !EMAIL.test(email)) next.email = R.badEmail;
    }
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    if (mode === "revoke" && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setDoneName(displayName);

    // One payload for prepare and confirm.
    const payload = { address, role: chosen, action: mode };
    if (mode === "register") payload.profile = buildProfile(profileValues);
    await flow.run(payload);
  }

  function startAnother() {
    flow.reset();
    setWallet("");
    setRole("");
    setValues({});
    setErrors({});
    setConfirming(false);
    roles.reload();
    profile.reload();
  }

  if (flow.step === "done" && flow.result) {
    return (
      <Done
        mode={mode}
        name={doneName || shortAddress(flow.result.address)}
        role={flow.result.role}
        onAnother={startAnother}
      />
    );
  }

  return (
    <Card page title={T.title}>
      <p className="form-page__intro">{T.intro}</p>
      <form onSubmit={submit} noValidate>
        <Field
          label={F.wallet}
          name="address"
          hint={F.walletHint}
          error={fieldErrors.address}
        >
          <input
            id="address"
            value={address}
            onChange={(e) => {
              setWallet(e.target.value);
              setConfirming(false);
            }}
            disabled={locked}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        {lookup && (roles.loading || profile.loading) && (
          <Loading text={F.checking} />
        )}
        <ErrorMessage error={roles.error} onRetry={roles.reload} />
        {lookup && roles.data && !profile.loading && (
          <dl className="form-page__facts">
            <dt>{F.known}</dt>
            <dd>{known && known.name ? known.name : F.unknown}</dd>
            <dt>{F.currentRoles}</dt>
            <dd>
              {current.length ? current.map(roleLabel).join(", ") : F.noRoles}
            </dd>
          </dl>
        )}

        {nothingToRevoke ? (
          <p className="role-change__note">{TEXT.revoke.nothing}</p>
        ) : (
          <Field
            label={F.role}
            name="role"
            error={fieldErrors.role}
            hint={mode === "revoke" && !lookup ? F.walletFirst : undefined}
          >
            <select
              id="role"
              value={chosen}
              onChange={(e) => {
                setRole(e.target.value);
                setConfirming(false);
              }}
              disabled={locked || (mode === "revoke" && !roles.data)}
            >
              <option value="">{F.choose}</option>
              {options.map((r) => {
                const has = mode === "register" && current.includes(r);
                return (
                  <option key={r} value={r} disabled={has}>
                    {has ? `${roleLabel(r)} (${F.hasRole})` : roleLabel(r)}
                  </option>
                );
              })}
            </select>
          </Field>
        )}

        {mode === "register" && (
          <fieldset className="role-change__profile" disabled={locked}>
            <legend>{R.profile}</legend>
            {PROFILE_FIELDS.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                name={inputId(f.name)}
                hint={f.hint}
                error={fieldErrors[f.name]}
              >
                <input
                  id={inputId(f.name)}
                  type={f.type || "text"}
                  value={profileValues[f.name] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...prefill,
                      ...v,
                      [f.name]: e.target.value,
                    }))
                  }
                />
              </Field>
            ))}
          </fieldset>
        )}

        {confirming && (
          <div className="role-change__confirm" role="alert">
            <p className="role-change__confirm-title">
              {TEXT.revoke.confirmTitle}
            </p>
            <p>{TEXT.revoke.confirm(displayName, roleLabel(chosen))}</p>
          </div>
        )}

        {!kept && !nothingToRevoke && (
          <div className="form-page__links">
            <Button
              type="submit"
              variant={confirming ? "danger" : "primary"}
              disabled={locked}
            >
              {locked
                ? F.working
                : confirming
                  ? TEXT.revoke.confirmYes
                  : T.submit}
            </Button>
            {confirming && (
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {TEXT.revoke.cancel}
              </Button>
            )}
          </div>
        )}
      </form>

      <TxProgress flow={flow} />
    </Card>
  );
}
