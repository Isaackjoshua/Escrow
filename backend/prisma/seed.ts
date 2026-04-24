import { PrismaClient, Role, KycStatus, TransactionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Escrow255 database...');

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // ─── Users ────────────────────────────────────────────────────────────────
  const [admin, merchant1, merchant2, customer1, customer2] = await Promise.all([
    prisma.user.upsert({
      where: { phone: '+255700000001' },
      update: {},
      create: {
        name: 'Admin User',
        phone: '+255700000001',
        email: 'admin@escrow255.co.tz',
        hashedPassword: await hash('Admin@1234'),
        role: Role.ADMIN,
        kycStatus: KycStatus.APPROVED,
        nationalId: '19800101100001',
      },
    }),
    prisma.user.upsert({
      where: { phone: '+255712000001' },
      update: {},
      create: {
        name: 'Juma Electronics',
        phone: '+255712000001',
        email: 'juma@electronicsbora.co.tz',
        hashedPassword: await hash('Merchant@1234'),
        role: Role.MERCHANT,
        kycStatus: KycStatus.APPROVED,
        nationalId: '19850215200001',
        brelaNumber: 'BRN/2020/0001234',
      },
    }),
    prisma.user.upsert({
      where: { phone: '+255712000002' },
      update: {},
      create: {
        name: 'Fatuma Fashion Store',
        phone: '+255712000002',
        email: 'fatuma@fashionstore.co.tz',
        hashedPassword: await hash('Merchant@1234'),
        role: Role.MERCHANT,
        kycStatus: KycStatus.APPROVED,
        nationalId: '19900320300001',
        brelaNumber: 'BRN/2019/0005678',
      },
    }),
    prisma.user.upsert({
      where: { phone: '+255754000001' },
      update: {},
      create: {
        name: 'Hassan Mwamba',
        phone: '+255754000001',
        email: 'hassan@gmail.com',
        hashedPassword: await hash('Customer@1234'),
        role: Role.CUSTOMER,
        kycStatus: KycStatus.APPROVED,
        nationalId: '19920510400001',
      },
    }),
    prisma.user.upsert({
      where: { phone: '+255754000002' },
      update: {},
      create: {
        name: 'Amina Saleh',
        phone: '+255754000002',
        email: 'amina@gmail.com',
        hashedPassword: await hash('Customer@1234'),
        role: Role.CUSTOMER,
        kycStatus: KycStatus.PENDING,
        nationalId: '19951220500001',
      },
    }),
  ]);

  console.log('✅ Users created:', [admin, merchant1, merchant2, customer1, customer2].map((u) => u.name));

  // ─── Transactions ─────────────────────────────────────────────────────────
  const txPending = await prisma.transaction.create({
    data: {
      customerId: customer1.id,
      merchantId: merchant1.id,
      amount: new Decimal(350000),
      platformFee: new Decimal(8750),
      currency: 'TZS',
      agreementDescription: 'Purchase of Samsung Galaxy A55 smartphone. Merchant to deliver within 3 days to Kariakoo. Item must be brand new, sealed box with full warranty.',
      inspectionWindowHours: 48,
      status: TransactionStatus.PENDING,
      productPhotos: [],
    },
  });

  const inspectionDeadline = new Date();
  inspectionDeadline.setHours(inspectionDeadline.getHours() + 36);

  const txHeld = await prisma.transaction.create({
    data: {
      customerId: customer1.id,
      merchantId: merchant2.id,
      amount: new Decimal(120000),
      platformFee: new Decimal(3000),
      currency: 'TZS',
      agreementDescription: 'Custom kitenge dress — blue and gold print. Size 14. To be ready within 5 days. Delivery to Msasani Peninsula.',
      inspectionWindowHours: 72,
      status: TransactionStatus.HELD,
      inspectionDeadline,
      otpVerified: true,
      productPhotos: [],
    },
  });

  const txDisputed = await prisma.transaction.create({
    data: {
      customerId: customer2.id,
      merchantId: merchant1.id,
      amount: new Decimal(85000),
      platformFee: new Decimal(2125),
      currency: 'TZS',
      agreementDescription: 'Xiaomi Redmi Note 13 phone. Second-hand, good condition. Delivery to Ubungo Bus Terminal.',
      inspectionWindowHours: 24,
      status: TransactionStatus.DISPUTED,
      otpVerified: true,
      productPhotos: [],
    },
  });

  const txReleased = await prisma.transaction.create({
    data: {
      customerId: customer2.id,
      merchantId: merchant2.id,
      amount: new Decimal(55000),
      platformFee: new Decimal(1375),
      currency: 'TZS',
      agreementDescription: 'Ladies handbag — genuine leather, brown. Delivered and confirmed.',
      inspectionWindowHours: 48,
      status: TransactionStatus.RELEASED,
      otpVerified: true,
      releasedAt: new Date(),
      productPhotos: [],
    },
  });

  const txCancelled = await prisma.transaction.create({
    data: {
      customerId: customer1.id,
      merchantId: merchant1.id,
      amount: new Decimal(200000),
      platformFee: new Decimal(5000),
      currency: 'TZS',
      agreementDescription: 'Gaming laptop — HP Victus. Cancelled before deposit.',
      inspectionWindowHours: 48,
      status: TransactionStatus.CANCELLED,
      productPhotos: [],
    },
  });

  console.log('✅ Transactions created: PENDING, HELD, DISPUTED, RELEASED, CANCELLED');

  // ─── Dispute ──────────────────────────────────────────────────────────────
  await prisma.dispute.create({
    data: {
      transactionId: txDisputed.id,
      raisedBy: customer2.id,
      reason: 'Phone was delivered but the screen has a crack and the merchant claimed it was in "good condition". Requesting refund.',
      evidenceUrls: [],
      status: 'UNDER_REVIEW',
    },
  });

  // ─── Delivery (for HELD tx) ───────────────────────────────────────────────
  await prisma.delivery.create({
    data: {
      transactionId: txHeld.id,
      courierName: 'G4S Tanzania',
      trackingNumber: 'G4S-TZ-2024-001',
      otpCode: '123456',
      deliveredAt: new Date(),
    },
  });

  // ─── Milestones (for HELD tx) ─────────────────────────────────────────────
  await prisma.milestone.createMany({
    data: [
      { transactionId: txHeld.id, title: 'Fabric Purchase', description: 'Merchant buys fabric and materials', amount: new Decimal(40000), order: 0, status: 'COMPLETED', confirmedAt: new Date() },
      { transactionId: txHeld.id, title: 'Cutting & Sewing', description: 'Dress cut and sewn to customer measurements', amount: new Decimal(60000), order: 1, status: 'IN_PROGRESS' },
      { transactionId: txHeld.id, title: 'Delivery', description: 'Dress delivered to customer', amount: new Decimal(20000), order: 2, status: 'PENDING' },
    ],
  });

  // ─── Rating ───────────────────────────────────────────────────────────────
  await prisma.rating.create({
    data: {
      transactionId: txReleased.id,
      ratedBy: customer2.id,
      ratedUser: merchant2.id,
      score: 5,
      comment: 'Excellent quality handbag! Fast delivery and exactly as described. Highly recommended.',
    },
  });

  // ─── Notifications ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: customer1.id, message: 'Welcome to Escrow255! Your account is ready.', type: 'SYSTEM' },
      { userId: customer1.id, message: `New escrow transaction of TZS 350,000 created. Awaiting deposit.`, type: 'TRANSACTION', metadata: { transactionId: txPending.id } },
      { userId: merchant1.id, message: `New order received from Hassan Mwamba — TZS 350,000.`, type: 'TRANSACTION', metadata: { transactionId: txPending.id } },
      { userId: merchant2.id, message: 'Your KYC has been approved! You can now receive escrow payments.', type: 'SYSTEM' },
    ],
  });

  // ─── Audit logs ───────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { transactionId: txPending.id, action: 'TRANSACTION_CREATED', actorId: customer1.id, metadata: { amount: '350000' } },
      { transactionId: txHeld.id, action: 'FUNDS_DEPOSITED', actorId: customer1.id, metadata: { amount: '120000' } },
      { transactionId: txReleased.id, action: 'FUNDS_RELEASED', actorId: customer2.id, metadata: { amount: '53625' } },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('\n📋 Test credentials (password applies to all):');
  console.log('   Admin:      +255700000001 / Admin@1234');
  console.log('   Merchant 1: +255712000001 / Merchant@1234');
  console.log('   Merchant 2: +255712000002 / Merchant@1234');
  console.log('   Customer 1: +255754000001 / Customer@1234');
  console.log('   Customer 2: +255754000002 / Customer@1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
