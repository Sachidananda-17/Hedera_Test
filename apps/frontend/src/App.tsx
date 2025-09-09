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
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  Avatar,
} from "@mui/material";
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
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)", width: "100%" }}>
      {/* Header - Full Width */}
      <AppBar position="static" sx={{ 
        background: "rgba(255, 255, 255, 0.1)", 
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.2)"
      }} elevation={0}>
        <Toolbar sx={{ maxWidth: "none", px: { xs: 2, md: 4 } }}>
          <Avatar
            src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Hedera-logo.png"
            sx={{ mr: 2, width: 40, height: 40 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ color: "rgba(255, 255, 255, 0.95)", fontWeight: "bold" }}>
              Hedera AI Notarization Platform
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
              Decentralized Content Verification with AI Analysis
            </Typography>
          </Box>
          <Chip 
            label="Testnet" 
            sx={{ 
              backgroundColor: "rgba(251, 191, 36, 0.2)", 
              color: "#fbbf24",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              fontWeight: "bold"
            }} 
            size="small" 
            variant="outlined" 
          />
        </Toolbar>
      </AppBar>

      {/* Main content - Full Width */}
      <Box sx={{ width: "100%", px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
        {connected ? (
          <>
            <Grid container spacing={3} sx={{ maxWidth: "6xl", mx: "auto", mb: 4 }}>
              {/* Wallet Connected - ChatGPT Style */}
              <Grid item xs={12} md={6} {...({} as any)}>
                <Card sx={{ 
                  background: "rgba(34, 197, 94, 0.1)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "16px",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      flexDirection={{ xs: "column", sm: "row" }}
                    >
                      <Box mb={{ xs: 2, sm: 0 }}>
                        <Box display="flex" alignItems="center" mb={2}>
                          <CheckCircleIcon sx={{ mr: 1.5, color: "#22c55e" }} />
                          <Typography variant="subtitle1" sx={{ color: "rgba(255, 255, 255, 0.95)", fontWeight: "bold" }}>
                            Wallet Connected
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2" 
                          sx={{ 
                            fontFamily: "monospace", 
                            wordBreak: "break-word",
                            color: "#22c55e",
                            fontSize: "0.875rem"
                          }}
                        >
                          {accountId}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{ 
                          bgcolor: "rgba(34, 197, 94, 0.2)", 
                          color: "#22c55e", 
                          alignSelf: "center",
                          border: "1px solid rgba(34, 197, 94, 0.3)"
                        }}
                      >
                        <AccountBalanceWalletIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Balance - ChatGPT Style */}
              <Grid item xs={12} md={6} {...({} as any)}>
                <Card sx={{ 
                  background: "rgba(99, 102, 241, 0.1)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: "16px",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      flexDirection={{ xs: "column", sm: "row" }}
                    >
                      <Box mb={{ xs: 2, sm: 0 }}>
                        <Box display="flex" alignItems="center" mb={2}>
                          <CurrencyBitcoinIcon sx={{ mr: 1.5, color: "#6366f1" }} />
                          <Typography variant="subtitle1" sx={{ color: "rgba(255, 255, 255, 0.95)", fontWeight: "bold" }}>
                            HBAR Balance
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ 
                            fontFamily: "monospace", 
                            wordBreak: "break-word",
                            color: "#6366f1",
                            fontSize: "0.875rem"
                          }}
                        >
                          {balance ? balance : "Fetching..."}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={{ 
                          bgcolor: "rgba(99, 102, 241, 0.2)", 
                          color: "#6366f1", 
                          alignSelf: "center",
                          border: "1px solid rgba(99, 102, 241, 0.3)"
                        }}
                      >
                        <CurrencyBitcoinIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Notarization dialog - No extra wrapper needed */}
            {(window as any).connectedAccountId = accountId}
            <NotarizationForm />
          </>
        ) : (
          /* Loading State - ChatGPT Style */
          <Box sx={{ 
            maxWidth: "4xl", 
            mx: "auto", 
            textAlign: "center",
            mt: { xs: 4, md: 8 }
          }}>
            <Card sx={{ 
              background: "rgba(255, 255, 255, 0.1)", 
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "24px",
              p: { xs: 4, md: 6 }
            }}>
              <CardContent>
                <CircularProgress 
                  size={60} 
                  sx={{ 
                    color: "#fbbf24",
                    mb: 3,
                    "& .MuiCircularProgress-circle": {
                      strokeLinecap: "round"
                    }
                  }} 
                />
                <Typography variant="h4" sx={{ 
                  color: "rgba(255, 255, 255, 0.95)", 
                  fontWeight: "bold",
                  mb: 2,
                  background: "linear-gradient(135deg, #60a5fa 0%, #a855f7 50%, #ec4899 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  Connecting to HashPack Wallet...
                </Typography>
                <Typography variant="body1" sx={{ 
                  color: "rgba(255, 255, 255, 0.7)",
                  mb: 6,
                  fontSize: "1.1rem"
                }}>
                  Please approve the connection in your HashPack extension
                </Typography>

                <Grid container spacing={4} mt={2}>
                  <Grid item xs={12} sm={4} sx={{ textAlign: "center" }} {...({} as any)}>
                    <Box sx={{
                      background: "rgba(34, 197, 94, 0.1)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      borderRadius: "16px",
                      p: 3,
                      height: "100%"
                    }}>
                      <SecurityIcon sx={{ fontSize: 48, color: "#22c55e", mb: 2 }} />
                      <Typography variant="h6" sx={{ 
                        fontWeight: "bold", 
                        color: "rgba(255, 255, 255, 0.95)",
                        mb: 1
                      }}>
                        Secure & Trusted
                      </Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                        HashPack is the most trusted wallet for Hedera
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4} sx={{ textAlign: "center" }} {...({} as any)}>
                    <Box sx={{
                      background: "rgba(99, 102, 241, 0.1)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      borderRadius: "16px",
                      p: 3,
                      height: "100%"
                    }}>
                      <FlashOnIcon sx={{ fontSize: 48, color: "#6366f1", mb: 2 }} />
                      <Typography variant="h6" sx={{ 
                        fontWeight: "bold", 
                        color: "rgba(255, 255, 255, 0.95)",
                        mb: 1
                      }}>
                        Instant Connection
                      </Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                        Connect in seconds, start notarizing immediately
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4} sx={{ textAlign: "center" }} {...({} as any)}>
                    <Box sx={{
                      background: "rgba(168, 85, 247, 0.1)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      borderRadius: "16px",
                      p: 3,
                      height: "100%"
                    }}>
                      <ScienceIcon sx={{ fontSize: 48, color: "#a855f7", mb: 2 }} />
                      <Typography variant="h6" sx={{ 
                        fontWeight: "bold", 
                        color: "rgba(255, 255, 255, 0.95)",
                        mb: 1
                      }}>
                        Testnet Ready
                      </Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
                        Free testing with Hedera testnet tokens
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>
    </Box>
  );
}
