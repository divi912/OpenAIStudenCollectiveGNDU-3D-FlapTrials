module.exports = {
  apps: [{
    name: 'flap-trials', script: 'dist/server/index.js', instances: 1, exec_mode: 'fork',
    time: true, watch: false, kill_timeout: 30000,
    env: { NODE_ENV: 'production', PORT: 2567, MAX_ROOMS: 10 },
  }],
};
