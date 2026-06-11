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
5. Open the service, select **Settings > Networking > Generate Domain**.

The generated Railway domain opens the standalone LPO form.
