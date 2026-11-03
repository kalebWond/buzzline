# Deploying to Render (free)

Buzzline runs as one Render web service on the free plan. The Node server serves the built web app,
the API and the WebSocket on the port Render gives it, and Render provides HTTPS on an `onrender.com` address.
The settings live in [`render.yaml`](../render.yaml).

## First deploy

1. Push `main` to GitHub.
2. Sign up at <https://dashboard.render.com> with your GitHub account.
3. **New → Blueprint**, pick the `buzzline` repo, and apply it. Render reads `render.yaml` and creates the `buzzline` service.
   If Render asks you to connect GitHub, give it access to this repo (private repos work too).
4. Wait for the first build to finish (a few minutes). The service page shows the address, e.g. `https://buzzline.onrender.com`.
   If `buzzline` is already taken, Render adds a suffix.

Open `https://<your-address>/host` on the big screen. Players use the same address on their phones; the lobby shows it.

If you'd rather not use a Blueprint, **New → Web Service** with the same settings works:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instance type | Free |

## Updating

Every push to `main` deploys automatically. A deploy restarts the server, which **ends any game in progress**, so push between games.

## Free plan behaviour

- **It sleeps after 15 minutes without traffic.** The next visit wakes it, which takes about a minute.
  Open `/host` a minute or two before you play. Once a game is running, the WebSocket traffic keeps it awake.
- **Sleeping or restarting ends live games**, because games are kept in memory.
- **750 free hours a month**, which is enough for one service.
- **Keep it to one instance.** Two instances would not share games.

## Idle connections

The server pings every connected client every 30 seconds (a WebSocket ping frame, not a game message),
so Render's proxy doesn't close sockets that go quiet, such as players waiting in the lobby.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Build fails | The **Logs** tab of the deploy. Run `npm ci && npm run build` locally to reproduce |
| Deploy never goes live | The health check at `/api/health` must answer. Check that the server log shows `serving web app from …/web/dist` |
| Page loads but the game never connects | Browser console errors for `/ws`, and the service **Logs** tab |
| First load takes a minute | Expected on the free plan after it has slept |
