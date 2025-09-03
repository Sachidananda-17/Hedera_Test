# Hedera HashPack Wallet Integration Test

A React-based demo application that showcases integration with the Hedera blockchain network using HashPack wallet connectivity. This project demonstrates wallet connection, account management, and balance queries on Hedera Testnet.

## 🚀 Features

- **Wallet Integration**: Connect to HashPack wallet using WalletConnect protocol
- **Account Management**: View connected wallet accounts and handle account changes
- **Balance Queries**: Retrieve and display HBAR balances from Hedera Testnet
- **Real-time Updates**: Live updates when wallet accounts change
- **Modern UI**: Clean, responsive React interface

## 📋 Prerequisites

Before running this application, ensure you have:

1. **Node.js** (version 18 or higher)
2. **npm** or **yarn** package manager
3. **HashPack Wallet** browser extension installed
4. **Hedera Testnet account** with some test HBAR tokens

### Installing HashPack Wallet

1. Visit [HashPack.app](https://hashpack.app/)
2. Install the browser extension for Chrome, Firefox, or Edge
3. Create a new wallet or import an existing one
4. Switch to **Testnet** mode in HashPack settings
5. Get test HBAR from the [Hedera Testnet Faucet](https://portal.hedera.com/faucet)

## 🛠️ Installation & Setup

### 1. Clone and Navigate to Project
```bash
cd hedera_test
```

### 2. Install Root Dependencies
```bash
npm install
```

### 3. Navigate to React App and Install Dependencies
```bash
cd hash-pack-test
npm install
```

### 4. Configure WalletConnect Project ID

The app currently uses a demo WalletConnect Project ID. For production use:

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy your Project ID
4. Replace the `projectId` in `hash-pack-test/src/App.tsx`:

```typescript
// Replace this line:
const projectId = "00a80c9d1c9b960c3d5dfdb56cd90d90";
// With your project ID:
const projectId = "your-wallet-connect-project-id";
```

## 🚀 Running the Application

### Development Mode
```bash
cd hash-pack-test
npm run dev
```

The application will start on `http://localhost:5173`

### Other Available Scripts
```bash
# Build for production
npm run build

# Run linting
npm run lint

# Preview production build
npm run preview
```

## 📱 How to Use

1. **Start the Application**: Run `npm run dev` and open `http://localhost:5173`

2. **Connect HashPack Wallet**:
   - Ensure HashPack extension is installed and set to Testnet
   - The WalletConnect modal will appear automatically
   - Click "HashPack" to connect your wallet
   - Approve the connection in the HashPack extension

3. **View Account Information**:
   - Once connected, you'll see your Hedera account ID
   - Your HBAR balance will be displayed
   - Account changes will be reflected in real-time

## 🏗️ Project Structure

```
hedera_test/
├── package.json                 # Root dependencies
├── hash-pack-test/             # Main React application
│   ├── src/
│   │   ├── App.tsx             # Main application component
│   │   ├── App.css             # Application styles
│   │   ├── main.tsx            # React entry point
│   │   └── index.css           # Global styles
│   ├── public/                 # Static assets
│   ├── package.json            # React app dependencies
│   ├── vite.config.ts          # Vite configuration
│   └── tsconfig.json           # TypeScript configuration
└── README.md                   # This file
```

## 🛡️ Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS3** - Styling

### Blockchain & Wallet
- **@hashgraph/sdk** - Hedera blockchain SDK
- **@hashgraph/hedera-wallet-connect** - Hedera WalletConnect integration
- **@walletconnect/modal** - WalletConnect modal UI
- **HashPack Wallet** - Hedera wallet provider

### Build Tools
- **Vite** - Fast build tool
- **TypeScript** - Static type checking
- **ESLint** - Code linting
- **Node.js polyfills** - Browser compatibility

## 🌐 Network Configuration

This application is configured for **Hedera Testnet**:
- **Chain ID**: `296` (Hedera Testnet)
- **Network**: `testnet`
- **RPC**: Uses Hedera SDK's built-in testnet configuration

## 🔧 Troubleshooting

### Common Issues

**1. "Failed to connect to wallet"**
- Ensure HashPack extension is installed and unlocked
- Check that HashPack is set to Testnet mode
- Try refreshing the page and reconnecting

**2. "Balance query failed"**
- Verify your account has test HBAR tokens
- Check that you're connected to Testnet
- Ensure your account exists on Hedera Testnet

**3. "Module not found" errors**
- Run `npm install` in both root and `hash-pack-test` directories
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`

**4. Build errors**
- Ensure Node.js version 18 or higher
- Check TypeScript configuration is correct
- Run `npm run lint` to check for code issues

### Development Tips

- Keep HashPack extension open during development
- Use browser developer tools to monitor console logs
- Check Network tab for WalletConnect connection issues
- Testnet HBAR can be obtained from the Hedera faucet

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is open source and available under the [ISC License](LICENSE).

## 📚 Additional Resources

- [Hedera Documentation](https://docs.hedera.com/)
- [HashPack Wallet](https://hashpack.app/)
- [WalletConnect Documentation](https://docs.walletconnect.com/)
- [Hedera SDK Documentation](https://github.com/hashgraph/hedera-sdk-js)
- [Vite Documentation](https://vitejs.dev/)

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure all prerequisites are met
4. Check that HashPack is properly configured for Testnet

---

**Happy coding with Hedera! 🚀**
