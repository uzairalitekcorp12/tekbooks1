import mongoose from 'mongoose';

const { Schema } = mongoose;

const attachmentSchema = new Schema({
  name: String, url: String, key: String, mimeType: String, size: Number
}, { _id: false });

const businessSchema = new Schema({
  name: { type: String, default: '' },
  legalName: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  trn: { type: String, default: '' },
  vatPercent: { type: Number, default: 5 },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  currency: { type: String, default: 'AED' }
}, { _id: false });

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, lowercase: true, index: true, required: true },
  passwordHash: { type: String, required: true },
  emailVerified: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['PENDING','APPROVED','REJECTED'], default: 'PENDING', index: true },
  deviceId: { type: String, default: '' },
  deviceLabel: { type: String, default: '' },
  expoPushToken: { type: String, default: '' },
  profilePictureUrl: { type: String, default: '' },
  business: { type: businessSchema, default: () => ({}) },
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

const VerificationTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, lowercase: true, index: true },
  purpose: { type: String, enum: ['SIGNUP','PASSWORD_RESET','DEVICE_CHANGE'], index: true },
  codeHash: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, index: { expires: 0 } },
  consumedAt: Date
}, { timestamps: true });

const PartySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['CUSTOMER','SUPPLIER'], required: true, index: true },
  name: { type: String, required: true },
  email: String, phone: String, address: String, trn: String, notes: String
}, { timestamps: true });

const TransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['INCOME','EXPENSE'], required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, index: true },
  paymentMethod: { type: String, default: 'Bank Transfer', index: true },
  notes: String,
  date: { type: Date, required: true, index: true },
  partyId: { type: Schema.Types.ObjectId, ref: 'Party' },
  partyName: String,
  vatTreatment: { type: String, enum: ['TAXABLE','ZERO_RATED','EXEMPT'], default: 'TAXABLE' },
  vatPercent: { type: Number, default: 5 },
  vatAmount: { type: Number, default: 0 },
  attachment: attachmentSchema
}, { timestamps: true });

const InvoiceLineSchema = new Schema({ description: String, qty: Number, unitPrice: Number, vatPercent: Number, amount: Number }, { _id: false });
const PaymentSchema = new Schema({ amount: Number, date: Date, method: String, notes: String }, { timestamps: true });
const InvoiceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invoiceNumber: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  customerSnapshot: { name: String, email: String, phone: String, address: String, trn: String },
  issueDate: { type: Date, required: true }, dueDate: { type: Date, required: true, index: true },
  lines: [InvoiceLineSchema],
  subtotal: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, discountPercent: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 }, total: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 }, balance: { type: Number, default: 0 },
  status: { type: String, enum: ['UNPAID','PARTIAL','PAID'], default: 'UNPAID', index: true },
  notes: String, payments: [PaymentSchema], attachment: attachmentSchema
}, { timestamps: true });
InvoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });


const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { timestamps: true });

const IdempotencySchema = new Schema({
  userId: String, key: String, route: String, statusCode: Number, responseBody: Schema.Types.Mixed,
  expiresAt: { type: Date, index: { expires: 0 } }
}, { timestamps: true });
IdempotencySchema.index({ userId: 1, key: 1, route: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const VerificationToken = mongoose.models.VerificationToken || mongoose.model('VerificationToken', VerificationTokenSchema);
export const Party = mongoose.models.Party || mongoose.model('Party', PartySchema);
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
export const IdempotencyRecord = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', IdempotencySchema);
export const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
export { mongoose };
