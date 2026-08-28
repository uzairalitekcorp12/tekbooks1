# Easy AWS S3 setup for the account owner

TekBooks needs only one private S3 bucket and one restricted IAM access-key pair. The developer needs exactly four values. Nothing else from the AWS account is required.

Do not give the developer the AWS login, root credentials, MFA code, billing access, or a key used by another application.

## The four values to provide

```dotenv
S3_REGION=ap-south-1
S3_BUCKET=the-exact-private-bucket-name
S3_ACCESS_KEY_ID=the-dedicated-IAM-access-key-ID
S3_SECRET_ACCESS_KEY=the-dedicated-IAM-secret-access-key
```

Send the completed four lines through a password manager or give them directly to the developer. Do not put them in GitHub, WhatsApp groups, screenshots, or public chat.

## Step 1: Protect the AWS account

1. Sign in to the AWS console as the account owner.
2. Enable MFA for the AWS root user.
3. Open **Billing and Cost Management → Budgets** and create a small monthly cost alert.
4. Never create or share a root access key.

Amazon S3 is usage-billed. The AWS account owner remains responsible for its storage, requests, transfer, old versions, and billing.

## Step 2: Create one private bucket

1. Open **S3 → Buckets → Create bucket**.
2. Select **General purpose**.
3. Enter a globally unique lowercase name, for example `tekbooks-prod-companyname-1234`.
4. Select a nearby AWS region and write down its code, for example `ap-south-1`.
5. Keep **Object Ownership** as **ACLs disabled / Bucket owner enforced**.
6. Keep all four **Block Public Access** settings enabled.
7. Keep default encryption as **SSE-S3**.
8. Leave versioning off for the lowest storage cost. Turn it on only if the account owner wants extra deletion recovery and accepts the added storage.
9. Select **Create bucket**.

Do not create a public bucket policy. TekBooks uses short-lived signed links while the bucket stays private.

## Step 3: Create the restricted permission policy

1. Open [tekbooks-s3-policy.template.json](./tekbooks-s3-policy.template.json).
2. Replace both occurrences of `REPLACE_WITH_BUCKET_NAME` with the exact new bucket name.
3. In AWS open **IAM → Policies → Create policy → JSON**.
4. Delete the example JSON in AWS and paste the edited policy.
5. Select **Next**, name it `TekBooksS3Only`, and create it.

This policy can list only that bucket and can read/write/delete only TekBooks files inside `users/`. It cannot manage AWS accounts, billing, IAM, public access, or other buckets.

## Step 4: Create the application user

1. Open **IAM → Users → Create user**.
2. Enter `tekbooks-vercel-storage`.
3. Do not enable AWS console access for this user.
4. Attach the existing `TekBooksS3Only` policy.
5. Finish creating the user.

## Step 5: Create the access key

1. Open the `tekbooks-vercel-storage` user.
2. Open **Security credentials**.
3. Under **Access keys**, select **Create access key**.
4. Choose **Application running outside AWS**.
5. Accept the acknowledgement and create the key.
6. AWS shows the secret only once. Copy both the access-key ID and secret now.

Fill the four-line form at the top with:

- `S3_REGION`: the bucket's region code;
- `S3_BUCKET`: the exact bucket name;
- `S3_ACCESS_KEY_ID`: the new access-key ID;
- `S3_SECRET_ACCESS_KEY`: the new secret access key.

That completes AWS setup. No S3 endpoint, public URL, CORS rule, CloudFront, Cognito, Lambda, website hosting, or additional AWS key is required.

If the key is ever exposed, deactivate/delete it, create a replacement for this same IAM user, and replace `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in local and Vercel configuration.

