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
10. Open `index.html`, click **Settings**, paste the URL, and save.

The script automatically creates:

- **LPO Masterlist**: one row per purchase order.
- **LPO Line Items**: one row per item, linked by Record ID and LPO Number.

## Running the local app

Double-click `index.html` to open it in a modern browser. Chrome or Microsoft Edge is recommended.

The first number is `GMSP/LPO/000261`. The browser increments the number after each new local save. Records remain in that browser profile, so avoid clearing site data. Google Sheets becomes the shared master list once configured.

## Delete password

The initial password is `GM@2026`. Change it in the app's **Settings** and set the same value in `Code.gs` if required, then redeploy the Apps Script.
