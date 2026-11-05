import { Link } from "react-router-dom";

/** The one STILL lockup in the admin app: sign-in, change password and the header (same as the console's sign-in). */
export function Brand({ to }: { to?: string }) {
  return (
    <div className="pa-brand">
      {to ? <Link to={to} className="pa-brand__name">STILL</Link> : <p className="pa-brand__name">STILL</p>}
      <p className="pa-brand__label">Platform admin</p>
    </div>
  );
}
