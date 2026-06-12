# Green Motors LPO - Google Sheets Setup

The local form saves every LPO in the browser first. Complete these steps once to also send every save, edit, and delete to a Google Sheets master list.

1. Create a blank Google Sheet named **Green Motors LPO Masterlist**.
2. In the Sheet, open **Extensions > Apps Script**.
3. Replace the editor contents with the contents of `Code.gs`.
4. In `Code.gs`, change `DELETE_PASSWORD` if you changed the app's delete password.
5. Click **Deploy > New deployment**.
6. Select **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone** (or the broadest option permitted by your Google Workspace administrator).
9. Click **Deploy**, authorize the script, and copy the Web App URL ending in `/exec`.
10. Open the Railway service and select **Variables**.
11. Add a variable named `GOOGLE_APPS_SCRIPT_URL`.
12. Paste the Apps Script Web App URL ending in `/exec` as its value.
13. Allow Railway to redeploy.

The hosted app uses this shared Railway variable. Users do not need to configure the Google Apps Script URL in their own browsers.

The script automatically creates:

- **LPO Masterlist**: one row per purchase order.
- **LPO Line Items**: one row per item, linked by Record ID and LPO Number.

## Running the local app

Double-click `index.html` to open it in a modern browser. Chrome or Microsoft Edge is recommended. The local file version still uses the URL entered through its own **Settings** screen.

The first number is `GMSP/LPO/000261`. In the Railway version, Google Apps Script checks the master list and assigns the final unique number while holding a script lock. Browser-local records are retained only as a convenience; Google Sheets is the shared master list.

## Delete password

The initial password is `GM@2026`. Change it in the app's **Settings** and set the same value in `Code.gs` if required, then redeploy the Apps Script.
