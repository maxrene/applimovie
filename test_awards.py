from playwright.sync_api import sync_playwright
import time
import subprocess

proc = subprocess.Popen(["python", "-m", "http.server", "3000"])
time.sleep(1)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}"))
    page.goto("http://localhost:3000/awards.html")
    time.sleep(3)
    browser.close()

proc.terminate()
