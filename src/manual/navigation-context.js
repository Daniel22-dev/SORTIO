// Manual launch context: the central AI Studio viewer owns embedded navigation.
const studioUrl = "https://daniel22-dev.github.io/AI-Studio-GHRAB/";
const embedded = window.parent !== window;
const fromStudio = new URLSearchParams(location.search).get("from") === "studio";
const back = [...document.querySelectorAll("a")].find(a => /Zpět do aplikace/.test(a.textContent || ""));
if (embedded) {
  if (back) back.hidden = true;
  // The parent viewer owns PDF actions; never show a second print-to-PDF shortcut.
  document.querySelectorAll('button[onclick*="window.print"],button[title*="Vytisknout"]').forEach(b => b.hidden = true);
} else if (fromStudio && back) {
  back.href = studioUrl + "manualy/";
  back.title = "Vrátit se do centra manuálů";
  back.textContent = "← Zpět na manuály";
}
if (!embedded) {
  const home = document.createElement("a");
  home.href = studioUrl;
  home.textContent = "AI Studio";
  home.setAttribute("aria-label", "Přejít do AI Studia");
  home.className = back?.className || "";
  home.style.cssText = "display:inline-flex;align-items:center;padding:10px 14px;margin-left:8px;border:1px solid currentColor;border-radius:10px;color:inherit;text-decoration:none;font-weight:750";
  const header = back?.parentElement || document.querySelector("header");
  header?.append(home);
}
