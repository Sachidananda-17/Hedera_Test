# Hedera Account Keys Guide

## Setting Up Your .env File

1. **Create the .env file**
   ```bash
   mkdir -p apps/backend/config
   touch apps/backend/config/.env
   ```

2. **Add Your Credentials**
   From your Hedera Portal (portal.hedera.com):

   ```env
   HEDERA_OPERATOR_ID=0.0.6651850
   HEDERA_OPERATOR_PRIVATE_KEY=3030020100300706052b8104000a042204206c2231a6152cca8e8cb0bb4316da2449ab5ad9e92da97e1118c851c35a6d4494
   ```

## Which Keys to Use?

From your Hedera Portal account page:

1. **HEDERA_OPERATOR_ID**
   - ✅ Use: Account ID
   - Example: `0.0.6651850`
   - Where to find: Top of account page

2. **HEDERA_OPERATOR_PRIVATE_KEY**
   - ✅ Use: DER Encoded Private Key
   - ❌ NOT: HEX Encoded Private Key
   - ❌ NOT: DER Encoded Public Key
   - Where to find: Under "More Details" section

## Important Notes

1. **Security**
   - Never commit .env file to git
   - Keep your private key secure
   - Don't share screenshots of keys

2. **Format**
   - Don't add quotes around values
   - No spaces around = sign
   - One key per line

3. **Verification**
   - Account ID should start with 0.0.
   - DER key should start with 3030
   - File should be in apps/backend/config/.env

## Testing Your Keys

After setting up, verify with:
```bash
npm run test:contract
```

If you see "Network connectivity" error:
1. Check VPN settings
2. Try direct internet connection
3. Keys are correct but network is blocked
