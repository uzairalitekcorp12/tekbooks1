const args = process.argv.slice(2);
const email = args.find(arg => !arg.startsWith('--'))?.trim().toLowerCase();
const username = args.filter(arg => !arg.startsWith('--'))[1]?.trim().toLowerCase();
const databaseName = args.find(arg => arg.startsWith('--db='))?.slice('--db='.length).trim();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{1,31}@tekbooks$/;

if (!email || !username || !usernamePattern.test(username)) {
  console.error('Usage: npm run user:set-username -- user@example.com admin@tekbooks [--db=tekbooks_dev]');
  process.exit(1);
}

if (databaseName) process.env.MONGODB_DB_NAME = databaseName;

const [{ connectDb }, { User, mongoose }] = await Promise.all([
  import('../config/db.js'),
  import('../models/index.js')
]);

try {
  await connectDb();
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found in ${process.env.MONGODB_DB_NAME || 'the configured database'}.`);
    process.exitCode = 1;
  } else {
    const conflict = await User.exists({ username, _id: { $ne: user._id } });
    if (conflict) {
      console.error(`Username ${username} is already assigned to another user.`);
      process.exitCode = 1;
    } else {
      user.username = username;
      await user.save();
      console.log(`Assigned username ${username} to ${email}. The password was not changed.`);
    }
  }
} finally {
  await mongoose.disconnect().catch(() => {});
}
