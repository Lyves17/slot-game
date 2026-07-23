import { ethers } from "https://cdn.ethers.io/lib/ethers-5.7.2.esm.min.js";

const CASINO_WALLET = "0xYOUR_CASINO_WALLET_ADDRESS_HERE";
const POLYGON_CHAIN_ID = 137;
const POLYGON_RPC = "https://polygon-rpc.com";

const POLYGON_NETWORK = {
    chainId: "0x89",
    chainName: "Polygon Mainnet",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: [POLYGON_RPC],
    blockExplorerUrls: ["https://polygonscan.com/"],
};

let provider = null;
let signer = null;
let userAddress = null;

function isWalletConnected() {
    return userAddress !== null;
}

function getShortAddress(addr) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function connectWallet() {
    if (!window.ethereum) {
        throw new Error("No wallet detected. Install MetaMask, Trust Wallet, or any Web3 wallet.");
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

    const network = await provider.getNetwork();
    if (network.chainId !== POLYGON_CHAIN_ID) {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x89" }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [POLYGON_NETWORK],
                });
            } else {
                throw new Error("Please switch to Polygon network manually.");
            }
        }
        provider = new ethers.providers.Web3Provider(window.ethereum);
    }

    signer = provider.getSigner();
    userAddress = accounts[0];

    window.ethereum.on("accountsChanged", (newAccounts) => {
        if (newAccounts.length === 0) {
            disconnectWallet();
        } else {
            userAddress = newAccounts[0];
            if (typeof window.onWalletUpdate === "function") {
                window.onWalletUpdate();
            }
        }
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });

    if (typeof window.onWalletUpdate === "function") {
        window.onWalletUpdate();
    }

    return userAddress;
}

function disconnectWallet() {
    provider = null;
    signer = null;
    userAddress = null;
    if (typeof window.onWalletUpdate === "function") {
        window.onWalletUpdate();
    }
}

async function getBalance() {
    if (!provider || !userAddress) return "0";
    const bal = await provider.getBalance(userAddress);
    return ethers.utils.formatEther(bal);
}

async function sendBet(amountMatic) {
    if (!signer || !userAddress) throw new Error("Wallet not connected");
    if (!CASINO_WALLET || CASINO_WALLET === "0xYOUR_CASINO_WALLET_ADDRESS_HERE") {
        throw new Error("Casino wallet not configured");
    }

    const tx = await signer.sendTransaction({
        to: CASINO_WALLET,
        value: ethers.utils.parseEther(amountMatic.toString()),
    });

    const receipt = await tx.wait();
    return receipt.transactionHash;
}

async function withdrawWin(amountMatic, casinoSignerPrivKey) {
    if (!userAddress) throw new Error("No wallet connected");

    const casinoWallet = new ethers.Wallet(casinoSignerPrivKey, provider);
    const tx = await casinoWallet.sendTransaction({
        to: userAddress,
        value: ethers.utils.parseEther(amountMatic.toString()),
    });

    const receipt = await tx.wait();
    return receipt.transactionHash;
}

function setupWalletListeners() {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            userAddress = null;
            provider = null;
            signer = null;
        } else {
            userAddress = accounts[0];
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
        }
        if (typeof window.onWalletUpdate === "function") {
            window.onWalletUpdate();
        }
    });
}

window.WalletManager = {
    connectWallet,
    disconnectWallet,
    getBalance,
    sendBet,
    withdrawWin,
    isWalletConnected,
    getShortAddress,
    setupWalletListeners,
    get address() { return userAddress; },
    get provider() { return provider; },
    get signer() { return signer; },
};
