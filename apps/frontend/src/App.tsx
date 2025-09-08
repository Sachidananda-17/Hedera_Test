import { useEffect, useState } from "react";
import {
  HederaSessionEvent,
  HederaJsonRpcMethod,
  DAppConnector,
  HederaChainId,
} from "@hashgraph/hedera-wallet-connect";
import {
  LedgerId,
  Client,
  AccountBalanceQuery,
  AccountId,
} from "@hashgraph/sdk";
import NotarizationForm from "./components/NotarizationForm";

// MUI components
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  Avatar,
  Paper,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import SecurityIcon from "@mui/icons-material/Security";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ScienceIcon from "@mui/icons-material/Science";

// 👇 replace with your WalletConnect Project ID
const projectId = "00a80c9d1c9b960c3d5dfdb56cd90d90";

const metadata = {
  name: "Hedera Testnet DApp",
  description: "Connect HashPack Wallet (Testnet)",
  url: "http://localhost:5173",
  icons: ["https://upload.wikimedia.org/wikipedia/commons/5/5a/Hedera-logo.png"],
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const dAppConn = new DAppConnector(
        metadata,
        LedgerId.TESTNET,
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Testnet]
      );

      await dAppConn.init({ logger: "debug" });

      dAppConn.walletConnectClient?.on("session_event", (event) => {
        if (event.params?.event.name === HederaSessionEvent.AccountsChanged) {
          const newAccs = event.params.event.data as string[];
          if (newAccs.length > 0) {
            const newAccountId = newAccs[0].split(":").pop() || "";
            setAccountId(newAccountId);
          }
        }
      });

      const session = await dAppConn.openModal();
      if (session) {
        setConnected(true);
        const accs = session.namespaces?.hedera?.accounts || [];
        if (accs.length > 0) {
          const extractedAccountId = accs[0].split(":").pop() || "";
          setAccountId(extractedAccountId);

          const client = Client.forTestnet();
          client.setOperator(
            AccountId.fromString(extractedAccountId),
            "302e020100300506032b657004220420ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
          );

          try {
            const balanceQuery = new AccountBalanceQuery().setAccountId(
              extractedAccountId
            );
            const result = await balanceQuery.execute(client);
            setBalance(result.hbars.toString());
          } catch (err) {
            console.error("Balance query failed:", err);
          }
        }
      }
    };

    init();
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "black", width: "100%" }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={1}>
        <Toolbar>
          <Avatar
            src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Hedera-logo.png"
            sx={{ mr: 2 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" color="primary">
              Hedera Notarization Platform
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Decentralized Content Verification
            </Typography>
          </Box>
          <Chip label="Testnet" color="warning" size="small" variant="outlined" />
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {connected ? (
          <>
            <Grid container spacing={3}>
              {/* Wallet Connected */}
              <Grid item xs={12} md={6}>
                <Card sx={{ bgcolor: "success.main", color: "white", height: "100%" }}>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      flexDirection={{ xs: "column", sm: "row" }}
                    >
                      <Box mb={{ xs: 2, sm: 0 }}>
                        <Box display="flex" alignItems="center" mb={1}>
                          <CheckCircleIcon sx={{ mr: 1 }} />
                          <Typography variant="subtitle1" color="primary">
                            Wallet Connected
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2" color="primary"
                          sx={{ fontFamily: "monospace", wordBreak: "break-word" }}
                        >
                          {accountId}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{ bgcolor: "white", color: "success.main", alignSelf: "center" }}
                      >
                        <AccountBalanceWalletIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Balance */}
              <Grid item xs={12} md={6}>
                <Card sx={{ bgcolor: "primary.main", color: "white", height: "100%" }}>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      flexDirection={{ xs: "column", sm: "row" }}
                    >
                      <Box mb={{ xs: 2, sm: 0 }}>
                        <Box display="flex" alignItems="center" mb={1}>
                          <CurrencyBitcoinIcon sx={{ mr: 1 }} />
                          <Typography variant="subtitle1" color="primary">HBAR Balance</Typography>
                        </Box>
                        <Typography
                          variant="body2" color="primary"
                          sx={{ fontFamily: "monospace", wordBreak: "break-word" }}
                        >
                          {balance ? balance : "Fetching..."}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{ bgcolor: "white", color: "primary.main", alignSelf: "center" }}
                      >
                        <CurrencyBitcoinIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Notarization dialog */}
            <Box mt={6}>
              {(window as any).connectedAccountId = accountId}
              <NotarizationForm />
            </Box>
          </>
        ) : (
          <Paper elevation={3} sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
            <CircularProgress color="warning" />
            <Typography variant="h6" mt={2} color="primary">
              Connecting to HashPack Wallet...
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1} >
              Please approve the connection in your HashPack extension
            </Typography>

            <Grid container spacing={4} mt={4}>
              <Grid item xs={12} sm={4} textAlign="center">
                <SecurityIcon color="primary" sx={{ fontSize: { xs: 30, md: 40 } }} />
                <Typography variant="subtitle1" fontWeight="bold" mt={1} >
                  Secure & Trusted
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  HashPack is the most trusted wallet for Hedera
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4} textAlign="center">
                <FlashOnIcon color="secondary" sx={{ fontSize: { xs: 30, md: 40 } }} />
                <Typography variant="subtitle1" fontWeight="bold" mt={1}>
                  Instant Connection
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connect in seconds, start notarizing immediately
                </Typography>
              </Grid>

              <Grid item xs={12} sm={4} textAlign="center">
                <ScienceIcon color="success" sx={{ fontSize: { xs: 30, md: 40 } }} />
                <Typography variant="subtitle1" fontWeight="bold" mt={1}>
                  Testnet Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Free testing with Hedera testnet tokens
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
