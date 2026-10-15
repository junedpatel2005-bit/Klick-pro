module.exports = {
  apps: [
    {
      name: "klick-pro",
      script: "server.mjs",
      instances: 1, // Runs on single instance to keep local Socket.IO rooms synced, or scale via Redis adapter
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
