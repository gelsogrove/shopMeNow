const path = require('path')

module.exports = {
  apps: [
    {
      name: "echatbot-backend",
      script: "./dist/src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_file: path.join(__dirname, "../../.env"),
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      merge_logs: true,
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
    },
  ],
}
