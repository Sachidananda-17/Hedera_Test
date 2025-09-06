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
import NotarizationDialog from "./components/NotarizationDialog";

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
          if (newAccs.length > 0) {
            const newAccountId = newAccs[0].split(":").pop() || "";
            setAccountId(newAccountId);
          }
        }
      });

      // ✅ Open WalletConnect modal
      const session = await dAppConn.openModal();
      console.log("Connected session:", session);

      if (session) {
        setConnected(true);
        const accs = session.namespaces?.hedera?.accounts || [];

        if (accs.length > 0) {
          // Extract account ID (format: hedera:testnet:0.0.xxxx)
          const extractedAccountId = accs[0].split(":").pop() || "";
          console.log("Connected accountId:", extractedAccountId);
          setAccountId(extractedAccountId);

          // ✅ Query balance using Hedera SDK
          const client = Client.forTestnet();
          client.setOperator(
            AccountId.fromString(extractedAccountId),
            // dummy private key (we're only querying, not signing)
            "302e020100300506032b657004220420ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
          );

          try {
            const balanceQuery = new AccountBalanceQuery().setAccountId(extractedAccountId);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header with wallet info */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3h4v1a1 1 0 102 0V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Hedera Notarization Platform
                </h1>
                <p className="text-sm text-gray-600">Decentralized Content Verification</p>
              </div>
            </div>
            
            {/* Network Badge */}
            <div className="hidden sm:flex items-center space-x-2 bg-orange-100 px-3 py-2 rounded-full">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-orange-700 text-sm font-medium">Testnet</span>
            </div>
          </div>
          
          {connected ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-bold">Wallet Connected</span>
                    </div>
                    <p className="text-green-100 text-sm font-mono">
                      {accountId || "Loading..."}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-bold">HBAR Balance</span>
                    </div>
                    <p className="text-blue-100 text-sm font-mono">
                      {balance ? `${balance}` : "Fetching..."}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div>
                  <p className="font-bold text-lg">Connecting to HashPack Wallet...</p>
                  <p className="text-yellow-100 text-sm mt-1">
                    Please approve the connection in your HashPack extension
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="py-12">
        {connected && accountId ? (
          <NotarizationDialog accountId={accountId} />
        ) : (
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Secure Wallet Connection Required
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Connect your HashPack wallet to start creating immutable proof of ownership 
                for your content on the Hedera blockchain.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">Secure & Trusted</h3>
                  <p className="text-sm text-gray-600">HashPack is the most trusted wallet for Hedera</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">Instant Connection</h3>
                  <p className="text-sm text-gray-600">Connect in seconds, start notarizing immediately</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v1a1 1 0 001 1h.01a1 1 0 100-2H3V6a1 1 0 00-1-1zm5.05 6.05a1 1 0 000 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 0zm2.83-2.83a1 1 0 000 1.414l.707.707a1 1 0 001.414-1.414L13.293 7.05a1 1 0 00-1.414 0zm0 2.83l.707.707A1 1 0 0014.414 9.5l-.707-.707a1 1 0 00-1.414 1.414zM17 11a1 1 0 100-2h-.01a1 1 0 100 2H17zm-7-4a1 1 0 011-1h.01a1 1 0 110 2H11a1 1 0 01-1-1zM5.05 6.05a1 1 0 000 1.414l.707.707a1 1 0 001.414-1.414L6.464 6.05a1 1 0 00-1.414 0zM17 17h-.01a1 1 0 001-1v-.01a1 1 0 00-1-1H17a1 1 0 00-1 1v.01a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">Testnet Ready</h3>
                  <p className="text-sm text-gray-600">Free testing with Hedera testnet tokens</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
