# React STL Viewer

A React application that fetches STL files from a FastAPI backend and displays them using Three.js and React Three Fiber.

## Features

- Fetch STL files from FastAPI endpoint
- 3D visualization with orbit controls
- Loading states

## Setup

1. Install dependencies: `npm install`
2. Start the development server: `npm start`

## Usage

Click the "Load STL" button to fetch and display the STL file.

Note: Update the `fetchSTL` function in `App.js` with your actual FastAPI endpoint URL.