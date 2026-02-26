module.exports = {
  apps: [
    {
      name: 'supamock',
      script: 'dist/index.js',
      watch: false,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'development', PORT: 3210 },
      env_production: { NODE_ENV: 'production', PORT: 3210 },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10
    }
  ]
};
