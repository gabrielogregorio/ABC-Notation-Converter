import { useHashRoute } from "./app/router";
import { useTranslate } from "./i18n/i18n";
import { TopBar } from "./shell/TopBar";
import { Nav } from "./shell/Nav";
import { Launcher } from "./shell/Launcher";
import { Converter } from "./modules/converter/Converter";
import { Tuner } from "./modules/tuner/Tuner";
import { Metronome } from "./modules/metronome/Metronome";
import { Practice } from "./modules/practice/Practice";
import { WhistleMark } from "./shell/WhistleMark";

export function App() {
  const [route, navigate] = useHashRoute();
  const translate = useTranslate();

  return (
    <div className="shell">
      <header className="site-head">
        <div className="head-inner">
          <button type="button" className="brand" onClick={() => navigate("home")}>
            <WhistleMark />
            <span className="brand-text">
              <span className="brand-name">Music Lab</span>
              <span className="brand-tag">{translate("app.tagline")}</span>
            </span>
          </button>
          <TopBar />
        </div>
        <Nav route={route} navigate={navigate} />
      </header>

      <main className="site-main">
        {route === "home" && <Launcher navigate={navigate} />}
        {route === "converter" && <Converter />}
        {route === "tuner" && <Tuner />}
        {route === "metronome" && <Metronome />}
        {route === "practice" && <Practice />}
      </main>

      <footer className="site-foot">
        <p>
          <span>{translate("footer.invite")}</span>{" "}
          <a
            href="https://github.com/gabrielogregorio/music-lab"
            rel="noopener"
            target="_blank"
            className="gh-link"
          >
            {translate("footer.link")}
          </a>
        </p>
      </footer>
    </div>
  );
}
