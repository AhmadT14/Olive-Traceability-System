import Card from "../../../components/Card";
import { ROLE_LABELS } from "../../../auth/roles";

export default function RolePlaceholder({ role }) {
  return (
    <Card title={`${ROLE_LABELS[role]} area`}>
      <p>
        This page is empty for now. The real screens arrive in later phases.
      </p>
    </Card>
  );
}
