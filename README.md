# Fish Tank Showdown

A 3D multiplayer browser game: one random player is a toy diver, everyone else is a sea creature in the tank. Everyone swims freely in 3D with their own third-person camera.

- **Everyone:** a Boost button with a meter that empties in about 1.5s and takes about 8s to refill.
- **Diver:** spear gun (3 hits kill), melee swing (2 hits kill), Flare (reveals hidden fish). Dodge bubble columns; the cave is too small to enter.
- **Animals:** bite (10 bites kill the diver), plus one ability each: Shark Frenzy, Clownfish Zoom, Pufferfish Puff Up, Octopus Ink, Turtle Shell, Eel Shock. Hide in seaweed, heal at the anemone, shelter in the cave.
- Rounds last 2:30 (the diver's air). Share the room link and friends join the same match.
- **Controls:** desktop uses the mouse to look (click to lock it), WASD to swim, Space/C for up/down, click to shoot or bite, right-click to swing, Shift to boost and E for the ability. Phones use a joystick, drag to look, and buttons. Bots fill in if you're alone.

## Run locally

```bash
npm install
npm run build
npm start          # http://localhost:2567
```

## Deploy

`render.yaml` deploys it as a Render web service (Node, WebSockets on `/ws`).

## Secrets

This repo is public. Keep API keys out of it:

- Put keys in environment variables only: `.env` locally (git-ignored, see `.env.example`), and Render > your service > **Environment** in production.
- Never put a key in `client/` or `shared/`. That code ships to every player's browser.
- `npm install` turns on a pre-commit hook (`.githooks/pre-commit`) that refuses commits containing key-shaped strings or `.env` / key files.
- GitHub Actions runs [gitleaks](https://github.com/gitleaks/gitleaks) on every push and pull request.
- In the GitHub repo settings, keep **Secret scanning** and **Push protection** turned on (Settings > Code security).
