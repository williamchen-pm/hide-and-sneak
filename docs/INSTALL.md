# Install Hide & Sneak (developer mode)

Most people should install from the [Chrome Web Store](https://chromewebstore.google.com/detail/hide-sneak/nglcphjdboglekojonbglleceicdlchc). To run it from source (for development or testing), load it straight from this folder.

## Load the extension

1. Open Chrome.
2. In the address bar, type `chrome://extensions` and press **Enter**.
3. In the top-right corner of that page, turn on **Developer mode**.
4. In the top-left, click **Load unpacked**.
5. In the folder picker, go to `D:\claude-extension-control\extension` and click **Select Folder**. (Select the `extension` folder itself, not the project folder above it.)
6. "Hide & Sneak" appears in the list, and its Rules & activity page opens in a new tab.
7. Pin it to the toolbar: click the **puzzle-piece icon** to the right of the address bar, find **Hide & Sneak**, and click the **pin** next to it.

## Use it

1. Click the **Hide & Sneak** shield in the toolbar.
2. Turn on **Agent Mode**. Open tabs are protected right away, without reloading. The toolbar badge turns red.
3. Hand your task to Claude in Chrome as usual.
4. When Claude is done, click the shield again and turn **Agent Mode** off. Locked fields unlock immediately, so any work already filled in stays. Reload a page to see its hidden text again.

## Add protected pages or words

1. Click the shield, then click **Rules & activity log** at the bottom.
2. Under **Protected pages**, enter one URL pattern per line (for example, `https://www.amazon.com/cpe/yourpayments/*`) and click **Save**.
3. Under **Protected words and phrases**, enter one phrase per line and click **Save**.

## Update after code changes

1. Go to `chrome://extensions`.
2. On the Hide & Sneak card, click the **circular reload arrow**.
3. Reload any open pages you want to test.

## Try the job-application demo locally

1. Press the **Windows key**, type `PowerShell`, and press **Enter**.
2. Run `cd D:\claude-extension-control`
3. Run `powershell -ExecutionPolicy Bypass -File .\spike\serve.ps1 -Root .`
4. In Chrome, open `http://localhost:8000/demo/job-application.html`.
5. Use the **Turn protection off / on** button at the top to compare. The demo runs the extension's own code, so it works even without the extension installed.

## Run the tests

- **Unit tests** (no install needed; Node 18+): from `D:\claude-extension-control`, run `npm test`.
- **End-to-end test** (loads the extension in Chromium):
  1. From `D:\claude-extension-control`, run `npm i -D playwright` and then `npx playwright install chromium`.
  2. In one terminal: `cd tests\e2e` and `python -m http.server 8765`.
  3. In a second terminal, from the project folder: `node tests/e2e/run.js`.
