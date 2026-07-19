# React STL Viewer

A React application that fetches STL files from a FastAPI backend and displays them using Three.js and React Three Fiber.

## Features

- Fetch STL files from FastAPI endpoint
- 3D visualization with orbit controls
- Loading states

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Set `REACT_APP_API_BASE_URL` to your FastAPI backend URL, for example `http://YOUR_VPS_IP`
4. Start the development server: `npm start`

## Production Build

Set `REACT_APP_API_BASE_URL` in `.env`, then build the static frontend:

```bash
npm run build
```

Upload the generated `build/` directory to your VPS web root, for example `/var/www/boxgenerator`.

## GitHub Actions VPS Deploy

Add these repository secrets in GitHub under Settings -> Secrets and variables -> Actions:

- `REACT_APP_API_BASE_URL`: Backend URL used by the React build, for example `http://YOUR_VPS_IP`
- `VPS_HOST`: VPS IP address or domain
- `VPS_USERNAME`: SSH username
- `VPS_PASSWORD`: SSH password
- `VPS_TARGET_DIR`: Folder served by Nginx, for example `/var/www/boxgenerator`
- `VPS_PORT`: SSH port, usually `22`

## Usage

Fill in the generator fields, generate an STL, preview it in the viewer, then download it.
