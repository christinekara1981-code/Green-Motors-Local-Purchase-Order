# Deploy Green Motors LPO

## GitHub

Create a repository named `green-motors-lpo`, then upload:

- `.gitignore`
- `package.json`
- `railway.json`
- `server.js`
- the complete `outputs` folder

## Railway

1. In Railway, select **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select `green-motors-lpo`.
4. Railway detects `package.json` and runs `npm start`.
5. Open the service and select **Variables**.
6. Add `GOOGLE_APPS_SCRIPT_URL` with the deployed Google Apps Script Web App URL ending in `/exec`.
7. Select **Settings > Networking > Generate Domain**.

The generated Railway domain opens the standalone LPO form.

The Google Apps Script URL is configured once in Railway. All users of the Railway link then save through the same server connection into the same Google Sheet.
