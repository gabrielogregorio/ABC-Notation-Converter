import { APPS } from "../app/registry";
import type { RouteName } from "../app/router";
import { useTranslate } from "../i18n/i18n";

// Module switcher. Doubles as a bottom tab bar on mobile (see global.css). Home
// is reachable through the brand mark, so the nav only lists the three tools.
export function Nav({
  route,
  navigate,
}: {
  route: RouteName;
  navigate: (r: RouteName) => void;
}) {
  const translate = useTranslate();
  return (
    <nav className="nav" aria-label={translate("launcher.allApps")}>
      {APPS.map((app) => (
        <button
          key={app.id}
          type="button"
          className={`nav-tab${route === app.route ? " active" : ""}`}
          onClick={() => navigate(app.route)}
          aria-current={route === app.route ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            {app.icon}
          </span>
          <span className="nav-label">{translate(app.nameKey)}</span>
        </button>
      ))}
    </nav>
  );
}
