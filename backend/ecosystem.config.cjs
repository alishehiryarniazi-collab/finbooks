// PM2 process configuration for the FinBooks API.
// Usage on the server:  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "finbooks-api",
      script: "dist/src/server.js",
      // Single instance suits a 1 GB (t3.micro) box: Node is async and handles many
      // concurrent requests on one process, and RAM — not CPU — is the limit here.
      // On a 2 GB+ instance, switch to cluster mode for a 2nd CPU + zero-downtime reloads:
      //   exec_mode: "cluster", instances: 2   (or "max")
      instances: 1,
      exec_mode: "fork",
      // Auto-recover if a memory leak ever pushes the process too high (keeps the box healthy).
      max_memory_restart: "350M",
      // Restart on crash, but back off if it keeps failing (avoids a tight crash loop).
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
