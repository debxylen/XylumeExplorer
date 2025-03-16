const rpcUrl = 'https://xyl-testnet.glitch.me/rpc/';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const web3 = new Web3(rpcUrl);
var latestBlock = 0;
let shownTill = 0;
var lastBlock;
const params = new URLSearchParams(window.location.search);

async function connectWallet(el) {
    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner()
            const address = await signer.getAddress();
            el.innerText = address.substring(0, 10) + '...';
        } catch (error) {
            alert("Connection failed:", error);
        }
    } else {
        alert("Please install an EVM-compatible wallet!");
    }
}

async function addLoadBtn() {
    var loaddiv = document.createElement('div');
    loaddiv.classList.add('mt-8', 'flex', 'justify-center');
    loaddiv.id = 'loadmore';
    loaddiv.innerHTML = `
        <button onclick="getLatestTransactions()" class="bg-blue-600/20 hover:bg-blue-600/30 px-6 py-3 rounded-lg transition">
            Load More Transactions
        </button>`;
    document.getElementById('tx-list').appendChild(loaddiv);
}

async function refresh() {
    shownTill = 0;
    document.getElementById('tx-list').innerHTML = '';
    await getLatestBlock();
    await getLatestTransactions();
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

async function getLatestTransactions() {
    document.getElementById("loadmore").remove();
    await getLatestBlock();
    const numTransactions = 10;
    if (shownTill > 0) { var target = shownTill - 1; } else { var target = latestBlock; } // count down from latest tx or from how much is shown
    for (let i = target; i >= 0 && i > target - numTransactions; i--) {
        const blockResponse = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionByNumber",
                params: [ `0x${i.toString(16)}`, true ],
                id: 1
            })
        });
        
        const blockData = await blockResponse.json();
        const block = blockData.result;
        if (block) {
            await addTxToList(block, i);
            shownTill = i;
        }
    }
    await addLoadBtn();
}


async function addTxToList(tx, i) {
    const txListElement = document.getElementById('tx-list');

    const txItem = document.createElement('div');
    txItem.classList.add('bg-gray-800/30', 'rounded-xl', 'p-6', 'border', 'border-gray-700/50', 'hover:border-blue-500/50', 'transition', 'cursor-pointer');
    txItem.onclick = function () { window.location.href = `/tx/${tx.hash}`; }
    txItem.innerHTML = `
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
                <div class="text-blue-500 truncate">${tx.sender}</div>
            </div>
            <div>
                <div class="text-sm text-gray-400">To</div>
                <div class="text-blue-500 truncate">${tx.recipient}</div>
            </div>
        </div>
        <div class="mt-4 flex justify-between items-center">
            <div class="text-xl font-bold">${web3.utils.fromWei(tx.amount, 'ether')} XYL</div>
            <div class="text-gray-400 text-sm truncate">Hash: ${tx.hash}</div>
        </div>
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
async function fetchTransaction() {
    const txHash = params.get("hash");
    if (!txHash) {
        showToast("Invalid transaction ID.", "error");
        return;
    }

    try {
        const txResponse = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionByHash",
                params: [ txHash ],
                id: 1
            })
        });

        const txData = await txResponse.json();
        const tx = txData.result;
        if (!tx) throw new Error("Transaction not found");

        document.getElementById('stat-sender').querySelector('div.text-blue-500').innerText = tx.sender;
        document.getElementById('stat-recipient').querySelector('div.text-blue-500').innerText = tx.recipient;
        document.getElementById('stat-amount').querySelector('div.text-green-500').innerText = `${web3.utils.fromWei(tx.amount, "ether")} XYL`;
        document.getElementById('stat-gas').querySelector('div.text-purple-500').innerText = tx.gas/(10**18)+' XYL';

        document.getElementById('tx-details').querySelector('.grid.gap-4').innerHTML = `
            ${generateTxDetail("Hash", tx.hash)}
            ${generateTxDetail("From", tx.sender)}
            ${generateTxDetail("To", tx.recipient)}
            ${generateTxDetail("Amount", web3.utils.fromWei(tx.amount, "ether") + " XYL")}
            ${generateTxDetail("Gas", tx.gas/(10**18)+' XYL')}
            ${generateTxDetail("Remaining Juice", tx.juice/(10**18)+' XYL')}
            ${generateTxDetail("Nonce", tx.nonce)}
            ${generateTxDetail("Data", tx.input || '0x')}
            ${generateTxDetail("Timestamp", `${new Date(Number(tx.timestamp) * 1000).toLocaleString()} (Raw: ${tx.timestamp})`)}
            ${generateTxDetail("Parents", tx.parents.join(", "))}
        `;

    } catch (error) {
        showToast("An error occurred while fetching transaction details.", "error");
    }
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

async function fetchAddressData() {
    const address = params.get("address");
    if (!address) {
        showToast("Invalid address.", "error");
        return;
    }

    try {
        // Fetch balance for the address
        const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBalance",
                params: [address, "latest"],
                id: 1
            })
        });

        const balanceData = await response.json();
        const balance = balanceData.result;
        document.getElementById('stat-address').querySelector('div.text-blue-500').innerText = address;
        document.getElementById('stat-balance').querySelector('div.text-blue-500').innerText = `${web3.utils.fromWei(balance, "ether")} XYL`;

        fetchTransactions(address);
    } catch (error) {
        showToast("Error fetching address details.", "error");
    }
}

async function fetchTransactions(address) {
    const requestData = {
        jsonrpc: "2.0",
        method: "xyl_transactionsInvolving",
        params: [address],
        id: 1
    };

    try {
        const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        if (data.result) {
            document.getElementById('stat-txs').querySelector('div.text-blue-500').innerText = `${data.result.length}`;
            document.getElementById("transactions").style.display = "block";
            displayTransactions(data.result);
        } else {
            document.getElementById("transactions").style.display = "none";
        }
    } catch (error) {
        document.getElementById("transactions").style.display = "none";
        showToast("Error fetching transactions.", "error");
    }
}

function displayTransactions(transactions) {
    const txList = document.getElementById("tx-list");
    txList.innerHTML = "";

    transactions.forEach(tx => {
        const txItem = document.createElement("div");
        txItem.classList.add("bg-gray-800/30", "rounded-xl", "p-6", "border", "border-gray-700/50", "hover:border-blue-500/50", "transition", "cursor-pointer");
        txItem.onclick = function () { window.location.href = `/tx/${tx.hash}`; };
        txItem.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-arrow-right-arrow-left text-green-500"></i>
                    <span class="text-green-500 font-medium">Transfer</span>
                </div>
                <span class="text-gray-400 text-sm">${new Date(Number(tx.timestamp) * 1000).toLocaleTimeString()}</span>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
                <div>
                    <div class="text-sm text-gray-400">From</div>
                    <div class="text-blue-500 truncate cursor-pointer" onclick="copyToClipboard('${tx.sender}', this)">${tx.from}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-400">To</div>
                    <div class="text-blue-500 truncate cursor-pointer" onclick="copyToClipboard('${tx.recipient}', this)">${tx.to}</div>
                </div>
            </div>
            <div class="mt-4 flex justify-between items-center">
                <div class="text-xl font-bold">${web3.utils.fromWei(tx.value, "ether")} XYL</div>
                <div class="text-gray-400 text-sm truncate cursor-pointer" onclick="copyToClipboard('${tx.hash}', this)">Hash: ${tx.hash}</div>
            </div>
        `;
        txList.appendChild(txItem);
    });
}