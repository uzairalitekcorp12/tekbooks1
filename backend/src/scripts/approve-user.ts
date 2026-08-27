import { connectDb } from '../config/db.js';
import { User } from '../models/index.js';
import { sendApprovalEmail } from '../services/email.js';

await connectDb();
const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error('Usage: npm run approve -- user@example.com');
  process.exit(1);
}

const user = await User.findOneAndUpdate(
  { email },
  { approvalStatus: 'APPROVED' },
  { new: true },
);

if (!user) {
  console.error('User not found');
  process.exit(1);
}

await sendApprovalEmail(user.email, true);
console.log(`Approved ${user.email}`);
process.exit(0);
