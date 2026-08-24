const config = require('./src/config');
const { createApp, startCleanup } = require('./src/app');
const { migrate } = require('./src/migrate');
const { seed } = require('./src/seed');

async function main() {
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      await migrate();
      if (process.env.AUTO_SEED !== 'false') await seed();
    } catch (err) {
      console.error('Could not auto-migrate:', err.message);
      if (config.db.client === 'mysql') {
        console.error('Check DB_* in .env (Hostinger MySQL host, user, password, database).');
      } else {
        console.error('Could not open the SQLite file. Check DB_FILE and that Node is 22.5+.');
      }
      process.exit(1);
    }
  }
  const app = createApp();
  startCleanup();
  app.listen(config.port, () => {
    console.log(`${config.appName} running on ${config.appUrl} (port ${config.port})`);
    if (!config.stripe.secret) {
      console.log('Stripe keys not set — Demo Pay is enabled for local / first-run testing.');
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
