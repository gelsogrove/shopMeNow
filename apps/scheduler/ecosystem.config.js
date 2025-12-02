const path = require('path')

module.exports = {
  apps: [
    {
      name: 'echatbot-scheduler',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1,  // Solo 1 istanza per evitare job duplicati
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: path.join(__dirname, "../../.env"),
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
}
