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

// 👇 replace with your WalletConnect Project ID
const projectId = "00a80c9d1c9b960c3d5dfdb56cd90d90";

const metadata = {
  name: "Hedera Testnet DApp",
  description: "Connect HashPack Wallet (Testnet)",
  url: "http://localhost:5173",
  icons: ["https://upload.wikimedia.org/wikipedia/commons/5/5a/Hedera-logo.png"],
};

export default function App() {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const dAppConn = new DAppConnector(
        metadata,
        LedgerId.TESTNET, // 👈 only Testnet
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Testnet]
      );

      await dAppConn.init({ logger: "debug" });

      // ✅ Handle session events
      dAppConn.walletConnectClient?.on("session_event", (event) => {
        console.log("Session event:", event);

        if (event.params?.event.name === HederaSessionEvent.AccountsChanged) {
          const newAccs = event.params.event.data as string[];
          console.log("Accounts changed:", newAccs);
          setAccounts(newAccs);
        }
      });

      // ✅ Open WalletConnect modal
      const session = await dAppConn.openModal();
      console.log("Connected session:", session);

      if (session) {
        setConnected(true);
        const accs = session.namespaces?.hedera?.accounts || [];
        setAccounts(accs);

        if (accs.length > 0) {
          // Extract account ID (format: hedera:testnet:0.0.xxxx)
          const accountId = accs[0].split(":").pop() || "";
          console.log("Connected accountId:", accountId);

          // ✅ Query balance using Hedera SDK
          const client = Client.forTestnet();
          client.setOperator(
            AccountId.fromString(accountId),
            // dummy private key (we're only querying, not signing)
            "302e020100300506032b657004220420ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
          );

          try {
            const balanceQuery = new AccountBalanceQuery().setAccountId(accountId);
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
    <div style={{ padding: "20px" }}>
      <h1>🚀 Hedera + HashPack (Testnet)</h1>
      {connected ? (
        <>
          <p>✅ Wallet connected!</p>
          <p>
            <strong>Accounts:</strong>{" "}
            {accounts.length > 0 ? accounts[0] : "None"}
          </p>
          <p>
            <strong>Balance:</strong>{" "}
            {balance ? balance : "Fetching..."}
          </p>
        </>
      ) : (
        <p>🔗 Waiting for wallet connection...</p>
      )}
    </div>
  );
}
