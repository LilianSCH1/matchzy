// Configuration PM2 : serveur Next autonome (dossier server/), secrets lus dans /home/matchzy/app/.env.
module.exports = {
  apps: [
    {
      name: "matchzy",
      script: "server.js",
      cwd: "/home/matchzy/app/server",
      // Le VPS n'a que 512 Mo : on borne le tas et on relance au-delà de 300 Mo.
      node_args: "--env-file=/home/matchzy/app/.env --max-old-space-size=192",
      max_memory_restart: "300M",
      env: { PORT: 3009, HOSTNAME: "127.0.0.1", NODE_ENV: "production" }
    }
  ]
};
