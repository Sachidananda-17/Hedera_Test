import SignClient from '@walletconnect/sign-client';

if (typeof window !== 'undefined') {
  window.WalletConnectSignClient = SignClient;
}

export default SignClient;


