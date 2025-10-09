const rpcUrl = 'https://xylume-testnet.sparked.network/rpc/';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const web3 = new Web3(rpcUrl);
var latestBlock = 0;
var lastBlock;
let hideZeroGas = true;
let userAddress = null;
let walletModal = null;
const params = new URLSearchParams(window.location.search);

const XYLUME_CHAIN = {
  chainId: '0x1b16',
  chainName: 'Xylume TestNet',
  rpcUrls: ['https://xylume-testnet.sparked.network/rpc/'],
  blockExplorerUrls: ['https://debxylen.github.io/XylumeExplorer'],
  nativeCurrency: {
    name: 'Xylume',
    symbol: 'XYL',
    decimals: 18,
  },
};

async function connectWallet(el) {
    if (userAddress) { clickWallet(); return; }
    if (!window.ethereum) { showToast("An EVM-compatible wallet is required to connect."); return; }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner()
        userAddress = await signer.getAddress();

        try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: XYLUME_CHAIN.chainId }] });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [XYLUME_CHAIN],
                });
            }
        }

        el.innerText = userAddress.substring(0, 10) + '...';

    } catch (error) {
        showToast("Connection failed:", error);
        return;
    }

}

async function clickWallet() {
    const el = document.querySelector('#header').getElementsByTagName('button')[0];
    if (userAddress) {
        walletModal = document.createElement('div');
        walletModal.id = 'wallet-modal';
        walletModal.classList.add('fixed', 'inset-0', 'bg-black/60', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center');
        walletModal.innerHTML = `
            <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[90%] max-w-md shadow-xl text-center space-y-6">
                <div class="flex items-center justify-between">
                <div 
                    onclick="document.body.removeChild(walletModal); walletModal = null;" 
                    class="cursor-pointer text-gray-700 p-2">
                    <i class="fa-solid fa-x"></i>
                </div>
                <div class="text-xl text-white font-semibold text-center flex-1">
                    Wallet Connected
                </div>
                <div class="w-6"></div> <!-- placeholder to balance icon -->
                </div>
                <div class="text-sm text-gray-400">${userAddress}</div>
                <div class="flex justify-center space-x-4">
                <button onclick="disconnectWalletFromModal()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
                    Disconnect
                </button>
                <button onclick="window.open('./address.html?address=' + userAddress, '_blank')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                    View Address
                </button>
                </div>
            </div>
        `;
        document.body.appendChild(walletModal);
    } else {
        await connectWallet(el);
    }
}

async function disconnectWallet(el) {
    if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts', params: [] });
    }
    userAddress = null;
    el.innerText = "Connect Wallet";
    el.onclick = connectWallet;
}

function disconnectWalletFromModal() {
  if (!userAddress) return;
  const el = document.querySelector('#header').getElementsByTagName('button')[0];
  disconnectWallet(el);
  document.getElementById('wallet-modal').classList.add('hidden');
}

function viewWalletAddress() {
  window.location.href = `/address.html?address=${userAddress}`;
}

function formatBigInt(amount, decimals) {
    const s = amount.toString().padStart(decimals + 1, "0");
    const intPart = s.slice(0, -decimals);
    const fracPart = s.slice(-decimals).replace(/0+$/, "");
    return fracPart.length ? `${intPart}.${fracPart}` : intPart;
}

async function refresh() {
    document.getElementById('tx-list').innerHTML = '';
    await getLatestBlock();
    await getLatestTransactions();
}

async function refreshTxs() {
    document.getElementById('tx-list').innerHTML = '';
    const address = document.getElementById('stat-address').querySelector('div.text-blue-500').innerText;
    await getLatestTransactions(address, address);
}

async function getLastConfirmationSpeed() {
    const requestData = {
        jsonrpc: "2.0",
        method: "xyl_lastConfirmationSpeed",
        params: ["s"], // in seconds
        id: 1
    };

    try {
        const response = await fetch(rpcUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
        });

        const data = await response.json();
        let confirmationSpeed = data.result;
        confirmationSpeed = confirmationSpeed.toFixed(2);
        document.getElementById('stat-speed').querySelector('.text-purple-500').innerText = `${confirmationSpeed}s`;

    } catch (error) {
        // might not be supported (if rpc isnt a XYL rpc)
        console.error(error);
    }
}

async function getLatestBlock() {
    const requestData = {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1
    };
    const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
    });

    const data = await response.json();
    latestBlock = parseInt(data.result, 16);
    document.getElementById('stat-block').querySelector('.text-blue-500').innerText = latestBlock;

    const blockResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionByNumber",
            params: [ `0x${latestBlock.toString(16)}`, true ],
            id: 1
        })
    });

    const blockData = await blockResponse.json();
    lastBlock = blockData.result;
    document.getElementById('stat-time').querySelector('.text-blue-500').innerText = `${new Date(Number(lastBlock.timestamp) * 1000).toLocaleTimeString()}`;

    const gasResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_estimateGas",
            params: [{gasPrice: "0x1"}],
            id: 1
        })
    });

    const gasData = await gasResponse.json();
    estimatedGasUnits = gasData.result;
    estimatedGas = estimatedGasUnits / (10**18); // in xyl
    document.getElementById('stat-gas').querySelector('.text-green-500').innerText = `${estimatedGas} XYL`;
}

function toggleZeroGasFilter(button) {
  hideZeroGas = !hideZeroGas;

  const thumb = button.querySelector("span");
  thumb.classList.toggle("translate-x-5", hideZeroGas);

  button.classList.toggle("bg-blue-500", hideZeroGas);
  button.classList.toggle("bg-gray-600", !hideZeroGas);

  document.getElementById("tx-list").innerHTML = "";
  if (document.getElementById("address-info")) {
    const address = document.getElementById('stat-address').querySelector('div.text-blue-500').innerText;
    getLatestTransactions(address, address);
  } else {
    getLatestTransactions();
  }
}

async function getLatestTransactions(senderAddr = null, receipientAddr = null) { 
  try {
    const requestData = {
      jsonrpc: "2.0",
      method: "xyl_getCompactSnapshot",
      params: [["hash", "from", "to", "timestamp", "value", "gas"]],
      id: 1
    };

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });

    var { result } = await response.json();
    if (!result || !Array.isArray(result)) throw new Error("Invalid snapshot from RPC");
    
    result = result.reverse();

    result.forEach((tx, i) => {
      const senderMatch = senderAddr ? tx.from.toLowerCase() === senderAddr.toLowerCase() : true;
      const recipientMatch = receipientAddr ? tx.to.toLowerCase() === receipientAddr.toLowerCase() : true;

      if (senderMatch || recipientMatch) {
        addTxToList(tx, result.length - i - 1);
      }
    });

    try { document.getElementById("stat-txs").querySelector(".text-green-500").innerText = result.length.toString(); } catch (error) {}

  } catch (error) {
    console.error("Failed to fetch snapshot:", error);
    showToast("Error loading transactions", "error");
  }
}

async function addTxToList(tx, i) {
    if (hideZeroGas && Number(tx.gas) === 0) return;
    const txListElement = document.getElementById('tx-list');

    const txItem = document.createElement('div');
    txItem.classList.add('bg-gray-800/30', 'rounded-xl', 'p-6', 'border', 'border-gray-700/50', 'hover:border-blue-500/50', 'transition', 'cursor-pointer');
    txItem.innerHTML = `
        <a href="tx/${tx.hash}">
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-2">
                <i class="fa-solid fa-arrow-right-arrow-left text-green-500"></i>
                <span class="text-green-500 font-medium">Transfer <i class="fa-solid fa-hashtag"></i>${i}</span>
            </div>
            <span class="text-gray-400 text-sm">${new Date(Number(tx.timestamp) * 1000).toLocaleTimeString()}</span>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
            <div>
                <div class="text-sm text-gray-400">From</div>
                <div class="text-blue-500 overflow-hidden whitespace-nowrap text-ellipsis max-w-[75%]">${tx.from}</div>
            </div>
            <div>
                <div class="text-sm text-gray-400">To</div>
                <div class="text-blue-500 overflow-hidden whitespace-nowrap text-ellipsis max-w-[75%]">${tx.to}</div>
            </div>
        </div>
        <div class="mt-4 flex justify-between items-center flex-col md:flex-row">
            <div class="text-xl font-bold">${web3.utils.fromWei(tx.value, 'ether')} XYL</div>
            <div class="text-gray-400 text-sm overflow-hidden whitespace-nowrap text-ellipsis max-w-[75%]">Hash: ${tx.hash}</div>
        </div>
        </a>
    `;
    txListElement.appendChild(txItem);
}

function handleSearch(event) {
    if (event.key === "Enter") {
        search(event.target.value.trim());
    }
}
function search(query) {
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
        window.location.href = `address/${query}`;
    } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        window.location.href = `tx/${query}`;
    } else {
        showToast('Not a valid TX hash or address.', 'error');
    }
}

function showToast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md border transition-all duration-300 transform`;
    toast.style.opacity = "0";
    toast.style.translate = "0 10px";

    if (type === "success") {
        toast.classList.add("bg-green-500/15", "border-green-400/40", "text-green-400");
    } else if (type === "error") {
        toast.classList.add("bg-red-500/15", "border-red-400/40", "text-red-400");
    } else {
        toast.classList.add("bg-blue-500/15", "border-blue-400/40", "text-blue-400");
    }

    toast.innerHTML = `
        <i class="fa-solid ${getIcon(type)}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.translate = "0 0";
    }, 10);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.translate = "0 10px";
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getIcon(type) {
    return type === "success" ? "fa-circle-check"
        : type === "error" ? "fa-circle-xmark"
            : "fa-circle-info";
}

// tx
function hexToString(hex) {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function stringToHexWithPrefix(inputString) {
  return "0x" + new TextEncoder().encode(inputString).reduce((acc, b) => acc + b.toString(16).padStart(2, "0"), "");
}

function generateTxDetail(label, value) {
  return `
    <div class="flex items-center space-x-3">
      <div class="text-base text-gray-400">${label}:</div>
      <div class="flex-1 flex items-center space-x-2 cursor-pointer" onclick="copyToClipboard('${value}', this)">
        <div class="text-blue-500 overflow-hidden text-ellipsis max-w-[70vw]">${value}</div> 
        <i class="fa-solid fa-copy text-gray-400 text-sm"></i>
      </div>
    </div>
  `;
}

async function fetchTransaction() {
  const txHash = params.get("hash");
  if (!txHash) return showToast("Invalid transaction ID.", "error");

  try {
    const txResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionByHash",
        params: [txHash],
        id: 1
      })
    });

    const { result: tx } = await txResponse.json();
    if (!tx) throw new Error("Transaction not found");

    // Stat Cards
    document.getElementById('stat-sender').querySelector('div.text-blue-500').innerText = tx.from;
    document.getElementById('stat-recipient').querySelector('div.text-blue-500').innerText = tx.to;
    document.getElementById('stat-amount').querySelector('div.text-green-500').innerText = `${web3.utils.fromWei(tx.value, "ether")} XYL`;
    document.getElementById('stat-gas').querySelector('div.text-purple-500').innerText = tx.gas / 1e18 + ' XYL';

    // Meta Box
    document.getElementById('tx-meta-content').innerHTML = `
      ${generateTxDetail("Hash", tx.hash)}
      ${generateTxDetail("Nonce", tx.nonce)}
      ${generateTxDetail("Gas", tx.gas / 1e18 + ' XYL')}
      ${generateTxDetail("Timestamp", new Date(Number(tx.timestamp) * 1000).toLocaleString() + ` (Raw: ${Number(tx.timestamp)})`)}
      ${generateTxDetail("Parents", tx.parents.join(", "))}
    `;

    // Transfer Box
    document.getElementById('tx-transfer-content').innerHTML = `
      ${generateTxDetail("From", tx.from)}
      ${generateTxDetail("To", tx.to)}
      ${generateTxDetail("Amount", web3.utils.fromWei(tx.value, "ether") + " XYL")}
      ${generateTxDetail("Remaining Juice", `${tx.juice / 1e18} XYL <i class='fa-solid fa-circle-info text-xs text-gray-500 cursor-pointer' title='Juice remaining in this transaction (usable by the recipient)'></i>`)}
    `;

    // Smart Contract Actions
    const input = tx.input || '0x';
    let actionsHtml = '';
    actionsHtml += generateTxDetail("Data", input);
    if (input !== '0x') {
      document.getElementById('tx-actions').classList.remove('hidden');

      const decoded = hexToString(input);
      const data = decoded.split(" ");

      if (input.startsWith("0xa9059cbb")) { // token transfer
        const tokenRecipient = '0x' + input.slice(10, 74).slice(-40);
        const tokenAmount = BigInt('0x' + input.slice(74));
        const info = await getTokenInfo(tx.to); 
        const symbol = info.symbol;

        actionsHtml += `
          <div class="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4 space-y-3">
            <div class="text-sm text-gray-400 font-semibold mb-1">Token Transfer</div>
            <div class="bg-gray-700/40 border border-gray-600/50 rounded-lg p-3">
                Transfer <span class="text-pink-400">${formatBigInt(tokenAmount, 18)}</span> <a href="address.html?address=${tx.to}" class="text-blue-400 bg-white/10 p-1 rounded hover:underline">\$${symbol}</a> 
                to <a href="address.html?address=${tokenRecipient}" class="text-yellow-400 hover:underline">${tokenRecipient}</a>
            </div>
          </div>
        `;
    } else if (data[0] === "createToken") {
        const authority = data[1];
        const initialMintAddress = data[2];
        const initialSupply = BigInt(data[3]);
        const symbol = data[4];
        const tokenName = data.slice(5).join(" ");
        const tokenAddr = stringToHexWithPrefix(`${tx.nonce}token${tx.from.toLowerCase()}`).slice(0, 42);
        const formattedAmount = formatBigInt(initialSupply, 18);

        actionsHtml += `
            <div class="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4 space-y-3">
            <div class="text-sm text-gray-400 font-semibold mb-1">Token Creation</div>

            <!-- Subcard 1: Create -->
            <div class="bg-gray-700/40 border border-gray-600/50 rounded-lg p-3">
                Create <a href="address.html?address=${tokenAddr}" class="text-blue-400 bg-white/10 p-1 rounded hover:underline">\$${symbol}</a> 
                with authority <a href="address.html?address=${authority}" class="text-yellow-400 hover:underline">${authority}</a>
            </div>

            <!-- Subcard 2: Mint -->
            <div class="bg-gray-700/40 border border-gray-600/50 rounded-lg p-3">
                Mint <span class="text-pink-400">${formattedAmount}</span> 
                <a href="address.html?address=${tokenAddr}" class="text-blue-400 bg-white/10 p-1 rounded hover:underline">\$${symbol}</a> 
                to <a href="address.html?address=${initialMintAddress}" class="text-yellow-400 hover:underline">${initialMintAddress}</a>
            </div>
            </div>
        `;
    } else if (data[0] === "mintToken") {
        const info = await getTokenInfo(data[1]);
        const symbol = info.symbol;
        actionsHtml += `
          <div class="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4 space-y-3">
            <div class="text-sm text-gray-400 font-semibold mb-1">Token Mint</div>
            <div class="bg-gray-700/40 border border-gray-600/50 rounded-lg p-3">
                Mint <span class="text-pink-400">${formatBigInt(data[3], 18)}</span> 
                <a href="address.html?address=${data[1]}" class="text-blue-400 bg-white/10 p-1 rounded hover:underline">\$${symbol}</a> 
                to <a href="address.html?address=${data[2]}" class="text-yellow-400 hover:underline">${data[2]}</a>
            </div>
          </div>
        `;
      }

      document.getElementById('tx-action-content').innerHTML = actionsHtml;
    }

  } catch (error) {
    console.error(error);
    showToast("An error occurred while fetching transaction details.", "error");
  }
}

function copyToClipboard(text, el) {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(tempInput.value).then(() => {
        showToast("Copied to clipboard!", "success");
        const icon = el.querySelector("i.fa-copy");
        if (icon) icon.classList.replace("text-gray-400", "text-green-400");
    }).catch(error => {
        showToast("Failed to copy!", "error");
        console.error(error);
    });

    document.body.removeChild(tempInput);
}

// address

async function fetchAddressData() {
  const address = params.get("address");
  if (!address) {
    showToast("Invalid address.", "error");
    return;
  }

  try {
    document.getElementById('stat-address').querySelector('div.text-blue-500').innerText = address;

    // Fetch balance
    const balanceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1
      })
    });
    const balanceData = await balanceResponse.json();
    const balance = balanceData.result;
    document.getElementById('stat-balance').querySelector('div.text-blue-500').innerText = `${web3.utils.fromWei(balance, "ether")} XYL`;

    // Reserved check
    if (address.toLowerCase() === '0x1111111111111111111111111111111111111111') {
      document.getElementById('stat-type').querySelector('div.text-purple-500').innerText = "System Address";
      showInfoBox("Protocol Token Handler", // born to say 'Token Daddy', forced to use 'Protocol Token Handler'
        `This is a core system address embedded in the Xylume protocol. <br>Users can launch tokens and mint supply by sending hex-encoded instructions to this address &mdash; no contracts required.`);
    } else {
      const tokenInfo = await getTokenInfo(address);
      if (tokenInfo) {
        document.getElementById('stat-type').querySelector('div.text-purple-500').innerText = "Token Contract";
        showInfoBox("Token Information", `
          <div class="">
            <div><span class="text-gray-400">Name:</span> <span class="text-blue-400 font-medium">${tokenInfo.name}</span></div>
            <div><span class="text-gray-400">Symbol:</span> <span class="text-yellow-400 font-medium">${tokenInfo.symbol}</span></div>
            <div><span class="text-gray-400">Decimals:</span> <span class="text-green-400 font-medium">${tokenInfo.decimals}</span></div>
            <div class="mt-2 text-white/70">This token was launched via Xylume's protocol-native token system using the <a class="text-blue-400 hover:underline" href="address.html?address=0x1111111111111111111111111111111111111111">Protocol Token Handler</a>.</div>
          </div>
        `);
      } else {
        document.getElementById('stat-type').querySelector('div.text-purple-500').innerText = "Account";
      }
    }
  } catch (error) {
    showToast("Error fetching address details.", "error");
    console.error(error);
  }
}

function showInfoBox(title, htmlContent) {
  const container = document.getElementById("address-info").querySelector(".container");

  const infoBox = document.createElement("div");
  infoBox.className = "bg-gray-800/40 rounded-xl p-6 border border-gray-700/50 mt-6";
  infoBox.innerHTML = `
    <div class="text-lg font-semibold text-purple-400 mb-2">${title}</div>
    <div class="leading-relaxed">${htmlContent}</div>
  `;

  container.appendChild(infoBox);
}

// tokens 

const ERC20_ABI = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" }
];

async function getTokenInfo(tokenAddress) {
  const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
  try {
    const name = await tokenContract.methods.name().call();
    const symbol = await tokenContract.methods.symbol().call();
    const decimals = 18;
    return { name, symbol, decimals };
  } catch {
    return null;
  }
}
