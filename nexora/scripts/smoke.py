from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5179"
OUT = Path("dist")
OUT.mkdir(exist_ok=True)
errors: list[str] = []


def visit(page, path: str, expect: str | None = None) -> None:
    res = page.goto(BASE + path, wait_until="domcontentloaded")
    if res is None or res.status >= 400:
        errors.append(f"{path} status {getattr(res, 'status', None)}")
    if expect:
        loc = page.get_by_text(expect).first
        if not loc.is_visible():
            errors.append(f'{path} missing "{expect}"')


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        visit(page, "/", "Are you 18 or over")
        page.get_by_role("button", name="I am 18+").click()
        page.get_by_role("heading", name="The sharpest line in sport.").wait_for()
        page.screenshot(path=str(OUT / "smoke-home.png"))

        page.locator("button.odds").first.click()
        page.get_by_text("Bet slip").wait_for()
        page.screenshot(path=str(OUT / "smoke-slip.png"))

        for path, text in [
            ("/live", "Live betting"),
            ("/sports", "All sports"),
            ("/sports/football", "Football"),
            ("/event/epl_ars_liv", "Match Winner"),
            ("/casino", "Casino. Visual only"),
            ("/promotions", "Promotions"),
            ("/results", "Scores & settlement"),
            ("/leaderboards", "Leaderboards"),
            ("/help", "Help Centre"),
            ("/responsible-gambling", "Responsible gambling"),
            ("/about", "About Nexora"),
        ]:
            visit(page, path, text)

        visit(page, "/login", "Log in")
        page.get_by_role("button", name="Continue").click()
        page.get_by_text("Two-factor").wait_for()
        page.get_by_role("button", name="Verify").click()
        page.get_by_text("Hello, Alex").wait_for()
        page.screenshot(path=str(OUT / "smoke-account.png"))

        visit(page, "/wallet", "Balances")
        page.get_by_role("button", name="Deposit").click()
        page.get_by_role("button", name="Credit wallet").click()
        page.get_by_text("Deposit complete").first.wait_for(timeout=5000)

        page.goto(BASE + "/admin", wait_until="domcontentloaded")
        page.get_by_text("Admin only").wait_for()

        page.goto(BASE + "/account", wait_until="domcontentloaded")
        page.get_by_role("button", name="Log out").click()

        visit(page, "/login", "Log in")
        page.locator('input[type="email"]').fill("admin@nexora.demo")
        page.locator('input[type="password"]').fill("admin1234")
        page.get_by_role("button", name="Continue").click()
        page.get_by_role("button", name="Verify").click()
        page.goto(BASE + "/admin", wait_until="domcontentloaded")
        page.get_by_text("Operations").wait_for()
        page.screenshot(path=str(OUT / "smoke-admin.png"))

        mobile = browser.new_page(viewport={"width": 375, "height": 812})
        mobile.on("pageerror", lambda err: errors.append(f"mobile pageerror: {err}"))
        mobile.goto(BASE + "/", wait_until="domcontentloaded")
        gate = mobile.get_by_role("button", name="I am 18+")
        if gate.is_visible():
            gate.click()
        mobile.get_by_text("Home").first.wait_for()
        mobile.screenshot(path=str(OUT / "smoke-mobile.png"))
        mobile.get_by_role("button", name="Slip").click()
        mobile.get_by_text("Bet slip").wait_for()
        mobile.close()
        browser.close()

    if errors:
        print("SMOKE FAIL")
        for e in errors:
            print(" -", e)
        raise SystemExit(1)
    print("SMOKE OK")


if __name__ == "__main__":
    main()
