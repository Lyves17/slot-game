import { SlotMachineRNG } from "./dist/rng.js";

let currentSpinResult = null;

const REEL_COLUMNS = 3;
const REEL_ROWS = 3;
const DESIGN_WIDTH = 900;
const DESIGN_HEIGHT = 640;
const REEL_WIDTH = 250;
const REEL_HEIGHT = 170;
const TOTAL_REEL_WIDTH = REEL_COLUMNS * REEL_WIDTH;
const CABINET_X = 28;
const CABINET_Y = 18;
const CABINET_WIDTH = 844;
const CABINET_HEIGHT = 604;
const REEL_START_X = 75;
const REEL_START_Y = 96;
const MAX_LINES = 5;
const WILD_ID = "bar";
const SPRITESHEET_JSON = "assets/spritesheet.json";
const SPRITESHEET_IMAGE = "assets/spritesheet.png";
const SPRITESHEET_SIZE = { w: 212, h: 70 };

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
PIXI.settings.ROUND_PIXELS = true;

const symbolCatalog = [
    {
        id: "orange",
        frame: "frame_000",
        name: "Orange",
        payouts: { 3: 5 },
        weight: 25,
        tint: 0xffa64d
    },
    {
        id: "pear",
        frame: "frame_001",
        name: "Pear",
        payouts: { 3: 6 },
        weight: 24,
        tint: 0xb8e86e
    },
    {
        id: "watermelon",
        frame: "frame_002",
        name: "Watermelon",
        payouts: { 3: 8 },
        weight: 20,
        tint: 0xff4d6d
    },
    {
        id: "bar",
        frame: "frame_003",
        name: "BAR Wild",
        payouts: { 3: 50 },
        weight: 5,
        tint: 0xffd24a
    },
    {
        id: "coconut",
        frame: "frame_004",
        name: "Coconut",
        payouts: { 3: 10 },
        weight: 18,
        tint: 0xe8c4a0
    },
    {
        id: "seven",
        frame: "frame_005",
        name: "Lucky Seven",
        payouts: { 3: 30 },
        weight: 6,
        tint: 0xff3b4a
    },
    {
        id: "bell",
        frame: "frame_006",
        name: "Bell",
        payouts: { 3: 12 },
        weight: 16,
        tint: 0xffcc4d
    },
    {
        id: "cherry",
        frame: "frame_007",
        name: "Cherry",
        payouts: { 2: 3, 3: 20 },
        weight: 16,
        tint: 0xff3355
    }
];

const slotEngine = new SlotMachineRNG(symbolCatalog);

const symbolById = Object.fromEntries(symbolCatalog.map((symbol) => [symbol.id, symbol]));

const paylines = [
    { id: 1, rows: [1, 1, 1], color: 0xffb347, name: "Middle Line" },
    { id: 2, rows: [0, 0, 0], color: 0xffd24a, name: "Top Line" },
    { id: 3, rows: [2, 2, 2], color: 0xff5a6b, name: "Bottom Line" },
    { id: 4, rows: [0, 1, 2], color: 0x5ecf6b, name: "Down Diagonal" },
    { id: 5, rows: [2, 1, 0], color: 0xd4a84b, name: "Up Diagonal" }
];

const betOptions = [1, 2, 5, 10, 25];
const machineMessages = {
    idle: "Connect your wallet to start playing.",
    connected: "Select your lines and spin for a payout.",
    spin: "Reels are spinning. Classic line wins pay left to right.",
    broke: "Not enough MATIC balance. Lower your lines or coin size.",
    jackpot: "Jackpot line. Three BAR wilds lit up the machine.",
    big: "Big win. Multiple hits landed on the same spin.",
    small: "Win registered. Press spin to chase a bigger combo.",
    lose: "No payout this spin. The next one could still stack multiple wins.",
    noWallet: "Connect your wallet to play."
};

const app = new PIXI.Application({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundAlpha: 0,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});

const gameContainerElement = document.getElementById("game-container");
gameContainerElement.appendChild(app.view);

const balanceElement = document.getElementById("balance-display");
const betElement = document.getElementById("bet-display");
const linesElement = document.getElementById("lines-display");
const totalBetElement = document.getElementById("total-bet-display");
const statusElement = document.getElementById("status-display");
const paytableElement = document.getElementById("paytable-list");
const mobilePaytableElement = document.getElementById("paytable-list-mobile");
const spinButton = document.getElementById("spin");
const betButton = document.getElementById("change-bet");
const increaseLinesButton = document.getElementById("increase-lines");
const decreaseLinesButton = document.getElementById("decrease-lines");
const soundButton = document.getElementById("toggle-sound");

const scene = new PIXI.Container();
app.stage.addChild(scene);

const backgroundLayer = new PIXI.Container();
const reelLayer = new PIXI.Container();
const overlayLayer = new PIXI.Container();
scene.addChild(backgroundLayer, reelLayer, overlayLayer);

const reelMask = new PIXI.Graphics();
reelMask.beginFill(0xffffff);
reelMask.drawRoundedRect(REEL_START_X, REEL_START_Y, TOTAL_REEL_WIDTH, REEL_HEIGHT * REEL_ROWS, 24);
reelMask.endFill();
scene.addChild(reelMask);

const reelContainer = new PIXI.Container();
reelContainer.mask = reelMask;
const bubbleLayer = new PIXI.Container();
bubbleLayer.mask = reelMask;
reelLayer.addChild(bubbleLayer, reelContainer);

const paylineGraphic = new PIXI.Graphics();
paylineGraphic.visible = false;
overlayLayer.addChild(paylineGraphic);

let cabinetFrame;
const reels = [];
const bubbles = [];
const lineBadges = [];
let activeLineCount = 3;
let betIndex = 0;
let currentBet = betOptions[betIndex];
let balance = 0;
let lastWin = 0;
let isSpinning = false;
let soundEnabled = true;
let audioContext;
let symbolTextures = {};

drawMachineChrome();
updateDashboard();
setStatus(machineMessages.idle);

const connectBtn = document.getElementById("connect-wallet");
const disconnectBtn = document.getElementById("disconnect-wallet");
const walletStatus = document.getElementById("wallet-status");
const walletInfo = document.getElementById("wallet-info");
const walletAddressEl = document.getElementById("wallet-address");
const depositModal = document.getElementById("deposit-modal");
const closeDepositBtn = document.getElementById("close-deposit");
const depositBtn = document.getElementById("deposit-btn");
const withdrawBtn = document.getElementById("withdraw-btn");
const depositStatus = document.getElementById("deposit-status");
const withdrawStatus = document.getElementById("withdraw-status");

window.onWalletUpdate = async function () {
    if (window.WalletManager.isWalletConnected()) {
        walletStatus.classList.add("hidden");
        walletInfo.classList.remove("hidden");
        walletAddressEl.textContent = window.WalletManager.getShortAddress(window.WalletManager.address);
        const bal = await window.WalletManager.getBalance();
        balance = parseFloat(bal);
        spinButton.disabled = false;
        updateDashboard();
        setStatus(machineMessages.connected);
    } else {
        walletStatus.classList.remove("hidden");
        walletInfo.classList.add("hidden");
        balance = 0;
        spinButton.disabled = true;
        updateDashboard();
        setStatus(machineMessages.idle);
    }
};

connectBtn.addEventListener("click", async () => {
    try {
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;
        await window.WalletManager.connectWallet();
    } catch (e) {
        alert(e.message || "Failed to connect wallet");
    } finally {
        connectBtn.textContent = "Connect Wallet";
        connectBtn.disabled = false;
    }
});

disconnectBtn.addEventListener("click", () => {
    window.WalletManager.disconnectWallet();
});

closeDepositBtn.addEventListener("click", () => {
    depositModal.classList.add("hidden");
});

depositModal.addEventListener("click", (e) => {
    if (e.target === depositModal) {
        depositModal.classList.add("hidden");
    }
});

depositBtn.addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("deposit-amount").value);
    if (!amount || amount <= 0) {
        depositStatus.textContent = "Enter a valid amount";
        depositStatus.className = "modal-status error";
        return;
    }

    try {
        depositBtn.disabled = true;
        depositStatus.textContent = "Sending transaction...";
        depositStatus.className = "modal-status pending";
        const txHash = await window.WalletManager.sendBet(amount);
        depositStatus.textContent = "Deposit confirmed! TX: " + txHash.slice(0, 10) + "...";
        depositStatus.className = "modal-status success";
        balance += amount;
        updateDashboard(true);
    } catch (e) {
        depositStatus.textContent = e.message || "Deposit failed";
        depositStatus.className = "modal-status error";
    } finally {
        depositBtn.disabled = false;
    }
});

withdrawBtn.addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("withdraw-amount").value);
    if (!amount || amount <= 0) {
        withdrawStatus.textContent = "Enter a valid amount";
        withdrawStatus.className = "modal-status error";
        return;
    }

    if (amount > balance) {
        withdrawStatus.textContent = "Insufficient casino balance";
        withdrawStatus.className = "modal-status error";
        return;
    }

    try {
        withdrawBtn.disabled = true;
        withdrawStatus.textContent = "Processing withdrawal...";
        withdrawStatus.className = "modal-status pending";
        balance -= amount;
        updateDashboard(true);
        withdrawStatus.textContent = "Withdrawal processed!";
        withdrawStatus.className = "modal-status success";
    } catch (e) {
        withdrawStatus.textContent = e.message || "Withdrawal failed";
        withdrawStatus.className = "modal-status error";
    } finally {
        withdrawBtn.disabled = false;
    }
});

window.WalletManager.setupWalletListeners();

spinButton.addEventListener("click", startSpin);
betButton.addEventListener("click", () => {
    if (isSpinning) {
        return;
    }

    playButtonSound();
    betIndex = (betIndex + 1) % betOptions.length;
    currentBet = betOptions[betIndex];
    updateDashboard();
});

increaseLinesButton.addEventListener("click", () => {
    playButtonSound();
    adjustLines(1);
});
decreaseLinesButton.addEventListener("click", () => {
    playButtonSound();
    adjustLines(-1);
});
soundButton.addEventListener("click", toggleSound);

const openDepositBtn = document.getElementById("open-deposit");
openDepositBtn.addEventListener("click", () => {
    if (!window.WalletManager.isWalletConnected()) {
        alert("Connect your wallet first!");
        return;
    }
    depositModal.classList.remove("hidden");
    depositStatus.textContent = "";
    depositStatus.className = "modal-status";
    withdrawStatus.textContent = "";
    withdrawStatus.className = "modal-status";
    document.getElementById("deposit-amount").value = "";
    document.getElementById("withdraw-amount").value = "";
});

const resizeObserver = new ResizeObserver(() => fitGameToContainer());
resizeObserver.observe(gameContainerElement);

initialize();

async function initialize() {
    const loadedSheet = await PIXI.Assets.load(SPRITESHEET_JSON);
    symbolTextures = loadedSheet?.textures ?? loadedSheet;
    if (!symbolTextures || !symbolTextures.frame_000) {
        throw new Error("Failed to load spritesheet textures from assets/spritesheet.json");
    }

    Object.values(symbolTextures).forEach((texture) => {
        if (texture?.baseTexture) {
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        }
    });

    renderPaytable();
    setupBubbles();
    setupReels();
    fitGameToContainer();
}

function setupBubbles() {
    for (let index = 0; index < 22; index += 1) {
        const bubble = new PIXI.Graphics();
        resetBubble(bubble, true);
        bubbleLayer.addChild(bubble);
        bubbles.push(bubble);
    }

    app.ticker.add((ticker) => updateBubbles(ticker.deltaMS / 16.6667));
}

function resetBubble(bubble, randomY = false) {
    const radius = 4 + Math.random() * 12;
    bubble.clear();
    bubble.removeChildren();
    bubble.lineStyle(1.5, 0xffe4b8, 0.35);
    bubble.beginFill(0xffe4b8, 0.08 + Math.random() * 0.08);
    bubble.drawCircle(0, 0, radius);
    bubble.endFill();

    const sheen = new PIXI.Graphics();
    sheen.beginFill(0xffffff, 0.18);
    sheen.drawCircle(-radius * 0.28, -radius * 0.28, Math.max(1.5, radius * 0.22));
    sheen.endFill();
    bubble.addChild(sheen);

    bubble.radius = radius;
    bubble.speed = 0.35 + Math.random() * 0.85;
    bubble.drift = (Math.random() - 0.5) * 0.8;
    bubble.wobble = 0.01 + Math.random() * 0.025;
    bubble.wobbleOffset = Math.random() * Math.PI * 2;
    bubble.alpha = 0.25 + Math.random() * 0.45;
    bubble.x = REEL_START_X + 20 + Math.random() * (TOTAL_REEL_WIDTH - 40);
    bubble.y = randomY
        ? REEL_START_Y + Math.random() * (REEL_HEIGHT * REEL_ROWS + 30)
        : REEL_START_Y + REEL_HEIGHT * REEL_ROWS + 20 + Math.random() * 60;
}

function updateBubbles(delta) {
    bubbles.forEach((bubble) => {
        bubble.y -= bubble.speed * delta;
        bubble.x += bubble.drift * delta + Math.sin((performance.now() * 0.001) + bubble.wobbleOffset) * bubble.wobble;

        if (bubble.y < REEL_START_Y - bubble.radius - 16) {
            resetBubble(bubble);
        }
    });
}

function setupReels() {

    currentSpinResult = slotEngine.generateSpin();

    for (let column = 0; column < REEL_COLUMNS; column += 1) {
        const reel = new PIXI.Container();
        reel.x = REEL_START_X + column * REEL_WIDTH;
        reel.y = REEL_START_Y;

        const blur = new PIXI.filters.BlurFilter();
        blur.blurX = 0;
        blur.blurY = 0;
        reel.filters = [blur];

        for (let row = 0; row < REEL_ROWS; row += 1) {
            const symbolData = currentSpinResult.grid[column][row];
            const symbol = createSymbolSprite(symbolData, row);
            reel.addChild(symbol);
        }

        reels.push(reel);
        reelContainer.addChild(reel);
    }
}

function createSymbolSprite(symbolData, rowIndex) {
    const texture = getTextureForSymbol(symbolData);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = REEL_WIDTH / 2;
    sprite.y = rowIndex * REEL_HEIGHT + REEL_HEIGHT / 2;

    const targetHeight = REEL_HEIGHT * 0.7;
    const scale = targetHeight / sprite.texture.height;
    sprite.scale.set(scale);
    sprite.baseScale = scale;
    sprite.symbolId = symbolData.id;
    sprite.symbolData = symbolData;

    return sprite;
}

function adjustLines(direction) {
    if (isSpinning) {
        return;
    }

    activeLineCount = Math.max(1, Math.min(MAX_LINES, activeLineCount + direction));
    updateDashboard();
}

function getTotalBet() {
    return currentBet * activeLineCount;
}

function updateDashboard(animateBalance = false) {
    const totalBet = getTotalBet();

    if (animateBalance) {
        const currentDisplay = Number(balanceElement.textContent.replace(/[^0-9.-]/g, "")) || 0;
        const animatedValue = { amount: currentDisplay };
        gsap.to(animatedValue, {
            amount: balance,
            duration: 0.75,
            ease: "power1.out",
            onUpdate: () => {
                balanceElement.textContent = formatCurrency(Math.floor(animatedValue.amount));
            }
        });
    } else {
        balanceElement.textContent = formatCurrency(balance);
    }

    betElement.textContent = formatCurrency(currentBet);
    linesElement.textContent = `${activeLineCount}`;
    totalBetElement.textContent = formatCurrency(totalBet);
    increaseLinesButton.disabled = activeLineCount >= MAX_LINES || isSpinning;
    decreaseLinesButton.disabled = activeLineCount <= 1 || isSpinning;
    betButton.disabled = isSpinning;
    spinButton.disabled = isSpinning;
    soundButton.textContent = soundEnabled ? "Sound On" : "Sound Off";
    updateLineBadges();
}

function setStatus(message) {
    statusElement.textContent = `${message} Last win: ${formatCurrency(lastWin)}.`;
}

function renderPaytable() {
    [paytableElement, mobilePaytableElement].filter(Boolean).forEach((element) => {
        element.innerHTML = "";
    });

    symbolCatalog
        .slice()
        .sort((left, right) => right.payouts[3] - left.payouts[3])
        .forEach((symbol) => {
            [paytableElement, mobilePaytableElement].filter(Boolean).forEach((element) => {
                const item = document.createElement("article");
                item.className = "paytable-item";

                const icon = document.createElement("div");
                icon.className = "paytable-icon";
                applyPaytableFrameStyle(icon, symbol);

                const meta = document.createElement("div");

                const name = document.createElement("div");
                name.className = "paytable-name";
                name.textContent = symbol.name;

                const values = document.createElement("div");
                values.className = "paytable-values";

                const payoutRows = Object.keys(symbol.payouts)
                    .map((count) => Number(count))
                    .sort((a, b) => a - b)
                    .map((count) => `${count} on line = ${symbol.payouts[count]}x`)
                    .join(" | ");
                values.textContent = payoutRows;

                meta.append(name, values);
                item.append(icon, meta);
                element.appendChild(item);
            });
        });
}

function drawMachineChrome() {
    backgroundLayer.removeChildren();

    const outerGlow = new PIXI.Graphics();
    outerGlow.beginFill(0x1a0c10, 0.94);
    outerGlow.drawRoundedRect(CABINET_X, CABINET_Y, CABINET_WIDTH, CABINET_HEIGHT, 30);
    outerGlow.endFill();
    outerGlow.lineStyle(5, 0xffc84d, 0.85);
    outerGlow.drawRoundedRect(CABINET_X, CABINET_Y, CABINET_WIDTH, CABINET_HEIGHT, 30);
    backgroundLayer.addChild(outerGlow);
    cabinetFrame = outerGlow;

    const reelFrame = new PIXI.Graphics();
    reelFrame.beginFill(0x231018, 0.62);
    reelFrame.drawRoundedRect(REEL_START_X - 8, REEL_START_Y - 8, TOTAL_REEL_WIDTH + 16, REEL_HEIGHT * REEL_ROWS + 16, 26);
    reelFrame.endFill();
    reelFrame.lineStyle(2, 0x8b5a42, 0.35);
    reelFrame.drawRoundedRect(REEL_START_X - 8, REEL_START_Y - 8, TOTAL_REEL_WIDTH + 16, REEL_HEIGHT * REEL_ROWS + 16, 26);
    backgroundLayer.addChild(reelFrame);

    const headerText = new PIXI.Text("5 LINES  |  BAR WILD  |  CHERRY PAYS", {
        fontFamily: "Orbitron",
        fontSize: 22,
        fontWeight: "700",
        fill: 0xffe08a,
        letterSpacing: 2
    });
    headerText.anchor.set(0.5, 0);
    headerText.x = DESIGN_WIDTH / 2;
    headerText.y = 46;
    backgroundLayer.addChild(headerText);

    paylines.forEach((payline, index) => {
        const badge = new PIXI.Container();
        const badgeBg = new PIXI.Graphics();
        badgeBg.beginFill(0x2a181c, 0.92);
        badgeBg.drawRoundedRect(0, 0, 42, 32, 12);
        badgeBg.endFill();
        badgeBg.lineStyle(2, payline.color, 0.9);
        badgeBg.drawRoundedRect(0, 0, 42, 32, 12);

        const badgeLabel = new PIXI.Text(String(payline.id), {
            fontFamily: "Orbitron",
            fontSize: 16,
            fontWeight: "800",
            fill: payline.color
        });
        badgeLabel.anchor.set(0.5);
        badgeLabel.x = 21;
        badgeLabel.y = 16;

        badge.addChild(badgeBg, badgeLabel);
        badge.x = index < 3 ? 18 : 840;
        badge.y = 150 + index * 72;
        backgroundLayer.addChild(badge);
        lineBadges.push({ badge, badgeBg, badgeLabel, payline });
    });

    updateLineBadges();
}

function fitGameToContainer() {
    const { clientWidth, clientHeight } = gameContainerElement;
    if (!clientWidth || !clientHeight) {
        return;
    }

    app.renderer.resize(clientWidth, clientHeight);

    const scale = Math.min(clientWidth / DESIGN_WIDTH, clientHeight / DESIGN_HEIGHT);
    scene.scale.set(scale);
    scene.x = Math.round((clientWidth - DESIGN_WIDTH * scale) / 2);
    scene.y = Math.round((clientHeight - DESIGN_HEIGHT * scale) / 2);
}

function startSpin() {
    const totalBet = getTotalBet();

    if (isSpinning) {
        return;
    }

    if (!window.WalletManager.isWalletConnected()) {
        setStatus(machineMessages.noWallet);
        return;
    }

    if (balance < totalBet) {
        setStatus(machineMessages.broke);
        return;
    }

    currentSpinResult = slotEngine.generateSpin();
    console.log("Spin result:", currentSpinResult.grid);

    isSpinning = true;
    lastWin = 0;
    paylineGraphic.visible = false;
    balance -= totalBet;
    updateDashboard();
    setStatus(machineMessages.spin);
    pulseCabinet();
    playSpinSound();

reels.forEach((reel, column) => {
    const blur = reel.filters[0];
    const duration = 0.9 + column * 0.35;
    
    gsap.to(blur, { blurY: 10, duration: 0.18, ease: "power1.out" });

    gsap.to(reel, {
        y: REEL_START_Y + 520,
        duration: duration,
        ease: "back.in(1.2)",
        onComplete: () => {
            reel.y = REEL_START_Y - 60; 
            reel.children.forEach((sprite, row) => replaceSymbol(sprite, column, row));

            gsap.to(reel, {
                y: REEL_START_Y,
                duration: 0.6,
                ease: "back.out(2)",
                onUpdate: () => {
                    const distance = Math.abs(reel.y - REEL_START_Y);
                    blur.blurY = distance * 0.15;
                },
                onComplete: () => {
                    blur.blurY = 0;
                    playReelStopSound(column);

                    if (column === REEL_COLUMNS - 1) {
                        finalizeSpin();
                    }
                }
            });
        }
    });
});
}

function replaceSymbol(sprite, colIndex, rowIndex) {
    const newSymbol = currentSpinResult
        ? currentSpinResult.grid[colIndex][rowIndex]
        : symbolCatalog[Math.floor(Math.random() * symbolCatalog.length)];

    sprite.texture = getTextureForSymbol(newSymbol);
    sprite.symbolId = newSymbol.id;
    sprite.symbolData = newSymbol;

    const scale = (REEL_HEIGHT * 0.7) / sprite.texture.height;
    sprite.scale.set(scale);
    sprite.baseScale = scale;
}

function finalizeSpin() {
    const results = evaluateSpin();
    const totalWin = results.totalWin;
    isSpinning = false;

    const wildCount = countWildSymbols();

    if (totalWin > 0) {
        balance += totalWin;
        lastWin = totalWin;
        updateDashboard(true);
        animateWinningSymbols(results);
        showWinCounter(totalWin, results.bestWin >= currentBet * 25 ? "JACKPOT" : "WIN");

        if (results.bestWin >= currentBet * 25) {
            triggerCelebration("JACKPOT", 0xffd44a);
            setStatus(`${machineMessages.jackpot} ${buildResultMessage(results)}`);
            playWinSound("jackpot");
        } else if (results.lineWins.length > 1) {
            triggerCelebration("BIG WIN", 0xff5a6b);
            setStatus(`${machineMessages.big} ${buildResultMessage(results)}`);
            playWinSound("big");
        } else {
            setStatus(`${machineMessages.small} ${buildResultMessage(results)}`);
            playWinSound("small");
        }

        if (results.lineWins.length > 0) {
            drawWinningPaylines(results.lineWins);
        }
    } else {
        lastWin = 0;
        updateDashboard();
        if (wildCount >= 2) {
            highlightWilds();
            setStatus("BAR wilds teased a bigger hit. Spin again for a fruit-line jackpot.");
        } else {
            setStatus(machineMessages.lose);
        }
    }
}

function evaluateSpin() {
    const lineWins = [];
    let totalWin = 0;
    let bestWin = 0;

    paylines.slice(0, activeLineCount).forEach((payline) => {
        const lineSymbols = payline.rows.map((row, column) => reels[column].children[row].symbolData);
        const evaluation = evaluateLine(lineSymbols);

        if (!evaluation) {
            return;
        }

        const winAmount = evaluation.multiplier * currentBet;
        totalWin += winAmount;
        bestWin = Math.max(bestWin, winAmount);

        lineWins.push({
            payline,
            symbol: evaluation.symbol,
            count: evaluation.count,
            winAmount,
            positions: payline.rows.map((row, column) => ({ column, row })).slice(0, evaluation.count)
        });
    });

    return {
        totalWin,
        bestWin,
        lineWins
    };
}

function evaluateLine(lineSymbols) {
    const wildCount = lineSymbols.filter((symbol) => symbol.id === WILD_ID).length;

    if (wildCount === lineSymbols.length) {
        return {
            symbol: symbolById[WILD_ID],
            count: lineSymbols.length,
            multiplier: symbolById[WILD_ID].payouts[3]
        };
    }

    const baseSymbol = lineSymbols.find((symbol) => symbol.id !== WILD_ID);

    if (!baseSymbol) {
        return null;
    }

    let count = 0;
    for (const symbol of lineSymbols) {
        if (symbol.id === baseSymbol.id || symbol.id === WILD_ID) {
            count += 1;
            continue;
        }

        break;
    }

    if (baseSymbol.id === "cherry") {
        const cherryMultiplier = baseSymbol.payouts[count];
        if (!cherryMultiplier) {
            return null;
        }

        return {
            symbol: baseSymbol,
            count,
            multiplier: cherryMultiplier
        };
    }

    if (count < 3) {
        return null;
    }

    return {
        symbol: baseSymbol,
        count,
        multiplier: baseSymbol.payouts[count]
    };
}

function countWildSymbols() {
    let count = 0;

    reels.forEach((reel) => {
        reel.children.forEach((sprite) => {
            if (sprite.symbolId === WILD_ID) {
                count += 1;
            }
        });
    });

    return count;
}

function drawWinningPaylines(lineWins) {
    paylineGraphic.clear();
    paylineGraphic.visible = true;
    paylineGraphic.alpha = 1;

    lineWins.forEach((lineWin) => {
        paylineGraphic.lineStyle(5, lineWin.payline.color, 0.95);
        lineWin.positions.forEach(({ column, row }, index) => {
            const x = REEL_START_X + column * REEL_WIDTH + REEL_WIDTH / 2;
            const y = REEL_START_Y + row * REEL_HEIGHT + REEL_HEIGHT / 2;

            if (index === 0) {
                paylineGraphic.moveTo(x, y);
            } else {
                paylineGraphic.lineTo(x, y);
            }

            paylineGraphic.beginFill(lineWin.payline.color, 0.95);
            paylineGraphic.drawCircle(x, y, 8);
            paylineGraphic.endFill();
        });
    });

    gsap.fromTo(
        paylineGraphic,
        { alpha: 0.2 },
        {
            alpha: 1,
            yoyo: true,
            repeat: 3,
            duration: 0.25,
            onComplete: () => {
                gsap.to(paylineGraphic, {
                    alpha: 0,
                    duration: 0.4,
                    delay: 1.2,
                    onComplete: () => {
                        paylineGraphic.visible = false;
                        paylineGraphic.clear();
                    }
                });
            }
        }
    );
}

function updateLineBadges() {
    lineBadges.forEach(({ badge, badgeBg, badgeLabel, payline }, index) => {
        const isActive = index < activeLineCount;
        badge.alpha = isActive ? 1 : 0.35;
        badge.scale.set(isActive ? 1 : 0.9);
        badgeLabel.text = isActive ? String(payline.id) : "-";
        badgeBg.clear();
        badgeBg.beginFill(0x2a181c, isActive ? 0.95 : 0.55);
        badgeBg.drawRoundedRect(0, 0, 42, 32, 12);
        badgeBg.endFill();
        badgeBg.lineStyle(2, payline.color, isActive ? 0.95 : 0.35);
        badgeBg.drawRoundedRect(0, 0, 42, 32, 12);
        badgeLabel.style.fill = isActive ? payline.color : 0x8b7268;
    });
}

function buildResultMessage(results) {
    const parts = [];

    results.lineWins.forEach((lineWin) => {
        parts.push(
            `Line ${lineWin.payline.id} ${lineWin.symbol.name} x${lineWin.count} paid ${formatCurrency(lineWin.winAmount)}`
        );
    });

    return parts.join(" | ");
}

function applyPaytableFrameStyle(icon, symbol) {
    const frameTexture = getTextureForSymbol(symbol);
    if (!frameTexture) {
        return;
    }

    const frame = frameTexture.frame;
    icon.textContent = "";

    const frameViewport = document.createElement("div");
    frameViewport.className = "paytable-icon-frame";

    const frameImage = document.createElement("img");
    frameImage.src = SPRITESHEET_IMAGE;
    frameImage.alt = symbol.name;
    frameImage.className = "paytable-icon-image";

    const scale = Math.max(1, Math.floor(Math.min(52 / frame.width, 52 / frame.height)));
    const scaledWidth = SPRITESHEET_SIZE.w * scale;
    const scaledHeight = SPRITESHEET_SIZE.h * scale;
    const frameWidth = frame.width * scale;
    const frameHeight = frame.height * scale;

    frameImage.style.width = `${scaledWidth}px`;
    frameImage.style.height = `${scaledHeight}px`;
    frameImage.style.left = `${-frame.x * scale}px`;
    frameImage.style.top = `${-frame.y * scale}px`;

    frameViewport.style.width = `${frameWidth}px`;
    frameViewport.style.height = `${frameHeight}px`;
    frameViewport.appendChild(frameImage);
    icon.appendChild(frameViewport);
}

function getTextureForSymbol(symbolData) {
    const directMatch = symbolTextures?.[symbolData.frame];
    if (directMatch) {
        return directMatch;
    }

    const pngMatch = symbolTextures?.[`${symbolData.frame}.png`];
    if (pngMatch) {
        return pngMatch;
    }

    return PIXI.Texture.WHITE;
}

function animateWinningSymbols(results) {
    const animatedSprites = new Set();

    results.lineWins.forEach((lineWin) => {
        lineWin.positions.forEach(({ column, row }) => {
            const sprite = reels[column].children[row];
            if (animatedSprites.has(sprite)) {
                return;
            }

            animatedSprites.add(sprite);
            pulseSprite(sprite, lineWin.symbol.tint);
        });
    });

}

function highlightWilds() {
    reels.forEach((reel) => {
        reel.children.forEach((sprite) => {
            if (sprite.symbolId === WILD_ID) {
                pulseSprite(sprite, symbolById[WILD_ID].tint);
            }
        });
    });
}

function pulseSprite(sprite, tintColor) {
    const globalPosition = sprite.getGlobalPosition();
    const localPosition = overlayLayer.toLocal(globalPosition);
    spawnBurst(localPosition.x, localPosition.y, tintColor);

    gsap.fromTo(
        sprite.scale,
        { x: sprite.baseScale, y: sprite.baseScale },
        {
            x: sprite.baseScale * 1.18,
            y: sprite.baseScale * 1.18,
            yoyo: true,
            repeat: 3,
            duration: 0.18,
            ease: "sine.inOut"
        }
    );
}

function spawnBurst(x, y, color) {
    const container = new PIXI.Container();
    overlayLayer.addChild(container);

    for (let index = 0; index < 14; index += 1) {
        const particle = new PIXI.Graphics();
        particle.beginFill(color, 0.9);
        particle.drawCircle(0, 0, Math.random() * 5 + 3);
        particle.endFill();
        particle.x = x;
        particle.y = y;
        container.addChild(particle);

        const angle = (Math.PI * 2 * index) / 14;
        const distance = 40 + Math.random() * 55;
        gsap.to(particle, {
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            alpha: 0,
            duration: 0.7 + Math.random() * 0.4,
            ease: "power2.out",
            onComplete: () => {
                container.removeChild(particle);
                if (container.children.length === 0) {
                    overlayLayer.removeChild(container);
                }
            }
        });
    }
}

function triggerCelebration(label, color) {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x120608, 0.72);
    overlay.drawRoundedRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0);
    overlay.endFill();
    overlay.alpha = 0;
    overlayLayer.addChild(overlay);

    const text = new PIXI.Text(label, {
        fontFamily: "Cinzel",
        fontSize: 74,
        fontWeight: "800",
        fill: color,
        stroke: 0xffffff,
        strokeThickness: 3,
        dropShadow: true,
        dropShadowColor: color,
        dropShadowBlur: 16,
        dropShadowDistance: 0
    });
    text.anchor.set(0.5);
    text.x = DESIGN_WIDTH / 2;
    text.y = DESIGN_HEIGHT / 2;
    text.scale.set(0.45);
    text.alpha = 0;
    overlayLayer.addChild(text);

    const timeline = gsap.timeline({
        onComplete: () => {
            gsap.to([overlay, text], {
                alpha: 0,
                duration: 0.5,
                delay: 1.2,
                onComplete: () => {
                    overlayLayer.removeChild(overlay);
                    overlayLayer.removeChild(text);
                }
            });
        }
    });

    timeline
        .to(overlay, { alpha: 1, duration: 0.2 })
        .to(text, { alpha: 1, duration: 0.12 }, "<")
        .to(text.scale, { x: 1, y: 1, duration: 0.8, ease: "elastic.out(1, 0.42)" }, "<")
        .to(text, { rotation: 0.02, duration: 0.14, repeat: 7, yoyo: true }, "-=0.4");

    for (let index = 0; index < 18; index += 1) {
        createFallingLight(color, index * 22);
    }
}

function showWinCounter(totalWin, label) {
    const badge = new PIXI.Container();
    overlayLayer.addChild(badge);

    const badgeBg = new PIXI.Graphics();
    badgeBg.beginFill(0x1a0c10, 0.94);
    badgeBg.drawRoundedRect(-130, -46, 260, 92, 24);
    badgeBg.endFill();
    badgeBg.lineStyle(3, label === "JACKPOT" ? 0xffd44a : 0xffc84d, 0.9);
    badgeBg.drawRoundedRect(-130, -46, 260, 92, 24);

    const title = new PIXI.Text(label, {
        fontFamily: "Orbitron",
        fontSize: 18,
        fontWeight: "800",
        fill: label === "JACKPOT" ? 0xffd44a : 0xffc84d,
        letterSpacing: 2
    });
    title.anchor.set(0.5);
    title.y = -16;

    const amount = new PIXI.Text("$0", {
        fontFamily: "Cinzel",
        fontSize: 34,
        fontWeight: "800",
        fill: 0xfff2bf
    });
    amount.anchor.set(0.5);
    amount.y = 18;

    badge.addChild(badgeBg, title, amount);
    badge.x = DESIGN_WIDTH / 2;
    badge.y = REEL_START_Y + REEL_HEIGHT * 1.5;
    badge.alpha = 0;
    badge.scale.set(0.82);

    const counter = { value: 0 };
    const timeline = gsap.timeline({
        onComplete: () => {
            gsap.to(badge, {
                alpha: 0,
                y: badge.y - 18,
                duration: 0.4,
                delay: 1,
                onComplete: () => {
                    overlayLayer.removeChild(badge);
                }
            });
        }
    });

    timeline
        .to(badge, { alpha: 1, duration: 0.14 }, 0)
        .to(badge.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.6)" }, 0)
        .to(counter, {
            value: totalWin,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
                amount.text = formatCurrency(counter.value);
            }
        }, 0.08);
}

function pulseCabinet() {
    if (!cabinetFrame) {
        return;
    }

    gsap.fromTo(
        cabinetFrame,
        { alpha: 0.82 },
        {
            alpha: 1,
            duration: 0.22,
            yoyo: true,
            repeat: 1,
            ease: "sine.inOut"
        }
    );
}

function createFallingLight(color, delay) {
    const spark = new PIXI.Graphics();
    spark.beginFill(color, 0.9);
    spark.drawCircle(0, 0, Math.random() * 5 + 3);
    spark.endFill();
    spark.x = 60 + Math.random() * (DESIGN_WIDTH - 120);
    spark.y = -20;
    overlayLayer.addChild(spark);

    gsap.to(spark, {
        y: DESIGN_HEIGHT + 30,
        x: spark.x + (Math.random() - 0.5) * 120,
        alpha: 0.1,
        delay: delay / 1000,
        duration: 1.3 + Math.random() * 0.7,
        ease: "none",
        onComplete: () => {
            overlayLayer.removeChild(spark);
        }
    });
}

function formatCurrency(value) {
    return `${parseFloat(value).toFixed(4)} MATIC`;
}

function toggleSound() {
    soundEnabled = !soundEnabled;

    if (soundEnabled) {
        ensureAudioContext();
        playButtonSound();
    }

    updateDashboard();
}

function ensureAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            soundEnabled = false;
            return null;
        }

        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    return audioContext;
}

function playTone(frequency, startAt, duration, type = "sine", volume = 0.05) {
    const context = ensureAudioContext();
    if (!soundEnabled || !context) {
        return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
}

function playButtonSound() {
    const context = ensureAudioContext();
    if (!soundEnabled || !context) {
        return;
    }

    const now = context.currentTime;
    playTone(540, now, 0.05, "square", 0.018);
    playTone(720, now + 0.04, 0.06, "triangle", 0.016);
}

function playSpinSound() {
    const context = ensureAudioContext();
    if (!soundEnabled || !context) {
        return;
    }

    const now = context.currentTime;
    playTone(180, now, 0.24, "sawtooth", 0.025);
    playTone(240, now + 0.08, 0.24, "triangle", 0.02);
    playTone(320, now + 0.18, 0.3, "square", 0.015);
}

function playReelStopSound(column) {
    const context = ensureAudioContext();
    if (!soundEnabled || !context) {
        return;
    }

    const now = context.currentTime;
    const base = 260 + column * 65;
    playTone(base, now, 0.05, "square", 0.02);
    playTone(base * 1.3, now + 0.03, 0.05, "triangle", 0.014);
}

function playWinSound(type) {
    const context = ensureAudioContext();
    if (!soundEnabled || !context) {
        return;
    }

    const now = context.currentTime;

    if (type === "jackpot") {
        [440, 660, 880, 1320].forEach((note, index) => {
            playTone(note, now + index * 0.12, 0.22, "triangle", 0.04);
        });
        return;
    }

    if (type === "big") {
        [392, 523, 659].forEach((note, index) => {
            playTone(note, now + index * 0.09, 0.16, "sine", 0.03);
        });
        return;
    }

    [392, 523].forEach((note, index) => {
        playTone(note, now + index * 0.08, 0.12, "sine", 0.025);
    });
}
