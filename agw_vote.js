const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://api.mainnet.abs.xyz";
const CHAIN_ID = 2741n;
const CHAIN_ID_NUMBER = Number(CHAIN_ID);
const VOTE_CONTRACT = "0x3b50de27506f0a8c1f4122a1e6f470009a76ce2a";
const VOTE_ABI = [
  "function voteCost() view returns (uint96)",
  "function currentEpoch() view returns (uint256)",
  "function userVotesRemaining(address user) view returns (uint256)",
  "function getUserVotes(address user, uint256 epoch) view returns (uint256[])",
];
const VOTE_WRITE_ABI = [
  {
    type: "function",
    name: "voteForApp",
    stateMutability: "payable",
    inputs: [{ name: "appId", type: "uint256" }],
    outputs: [],
  },
];

function isBareCommand(command) {
  return !command.includes("\\") && !command.includes("/") && !command.includes(":");
}

function commandExists(command) {
  if (!isBareCommand(command)) return true;
  const checker = process.platform === "win32" ? "where.exe" : "command";
  const checkerArgs = process.platform === "win32" ? [command] : ["-v", command];
  const result = spawnSync(checker, checkerArgs, {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function parseArgs(argv) {
  const args = {
    appId: process.env.APP_ID || "15",
    execute: false,
    listVotes: false,
    listApps: false,
    randomVote: false,
    appPageSize: Number(process.env.APP_PAGE_SIZE || "100"),
    epoch: process.env.EPOCH || "",
    rpc: process.env.RPC_URL || RPC_URL,
    cli: process.env.AGW_CLI || "",
    useNpx: process.env.AGW_USE_NPX === "1",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--app-id") {
      args.appId = argv[++i];
    } else if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--dry-run") {
      args.execute = false;
    } else if (arg === "--list-votes") {
      args.listVotes = true;
    } else if (arg === "--list-apps") {
      args.listApps = true;
    } else if (arg === "--random-vote") {
      args.randomVote = true;
    } else if (arg === "--epoch") {
      args.epoch = argv[++i];
    } else if (arg === "--app-page-size") {
      args.appPageSize = Number(argv[++i]);
    } else if (arg === "--rpc") {
      args.rpc = argv[++i];
    } else if (arg === "--cli") {
      args.cli = argv[++i];
    } else if (arg === "--use-npx") {
      args.useNpx = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.listVotes && !args.listApps && !args.randomVote && !/^\d+$/.test(String(args.appId))) {
    throw new Error("APP_ID / --app-id must be a positive integer");
  }
  if (args.epoch && !/^\d+$/.test(String(args.epoch))) {
    throw new Error("EPOCH / --epoch must be a positive integer");
  }
  if (!Number.isInteger(args.appPageSize) || args.appPageSize <= 0) {
    throw new Error("APP_PAGE_SIZE / --app-page-size must be a positive integer");
  }
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node agw_vote.js --app-id 15 --dry-run
  node agw_vote.js --app-id 15 --execute
  node agw_vote.js --list-votes
  node agw_vote.js --list-votes --epoch 329
  node agw_vote.js --list-apps
  node agw_vote.js --random-vote --dry-run
  node agw_vote.js --random-vote --execute

Setup first:
  npm install -g @abstract-foundation/agw-cli
  agw-cli auth init --json "{\\"chainId\\":2741}" --execute
  agw-cli session status --json "{\\"fields\\":[\\"status\\",\\"readiness\\",\\"accountAddress\\",\\"policyPreset\\"]}"

Options:
  --app-id <id>   Abstract Portal app id. Default: 15
  --list-votes    Only list app ids already voted by the linked AGW.
  --list-apps     List Portal app ids returned by AGW CLI.
  --random-vote   Pick one random app id that this AGW has not voted for this epoch.
  --app-page-size <n> Portal app list page size. Default: 100.
  --epoch <id>    Epoch to inspect. Default: current epoch.
  --rpc <url>     Abstract RPC URL. Default: ${RPC_URL}
  --execute       Broadcast the vote. Without this flag the AGW CLI only previews.
  --cli <cmd>     AGW CLI command path/name. Default: auto-detect agw/agw-cli
  --use-npx       Run through npx -y @abstract-foundation/agw-cli
`);
}

async function createProvider(rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID_NUMBER, {
    staticNetwork: ethers.Network.from(CHAIN_ID_NUMBER),
  });

  let chainId;
  try {
    chainId = await provider.send("eth_chainId", []);
  } catch (error) {
    throw new Error(
      `RPC request failed for ${rpcUrl}. Try again later or pass another endpoint with --rpc. ${error.shortMessage || error.message}`,
    );
  }

  if (BigInt(chainId) !== CHAIN_ID) {
    throw new Error(`Wrong RPC chain id: expected ${CHAIN_ID}, got ${BigInt(chainId)} from ${rpcUrl}`);
  }

  return provider;
}

function resolveCliCommand(args) {
  if (args.useNpx) return "npx";
  if (args.cli) return args.cli;
  if (commandExists("agw-cli")) return "agw-cli";
  if (commandExists("agw")) return "agw";
  return "agw-cli";
}

function createJsonPayloadFile(payload) {
  const dir = path.join(process.cwd(), ".agw-payloads");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `payload-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(payload), "utf8");
  return file;
}

function buildCommand(args, subcommand, jsonPayloadFile, modeFlag) {
  const relativePayloadFile = path.relative(process.cwd(), jsonPayloadFile);
  const parts = [...subcommand, "--json", `@${relativePayloadFile}`];
  if (modeFlag) parts.push(modeFlag);

  if (args.useNpx) {
    return {
      command: "npx",
      args: ["-y", "@abstract-foundation/agw-cli", ...parts],
    };
  }
  return { command: resolveCliCommand(args), args: parts };
}

function runAgw(args, subcommand, payload, modeFlag) {
  const jsonPayloadFile = createJsonPayloadFile(payload);
  const command = buildCommand(args, subcommand, jsonPayloadFile, modeFlag);

  try {
    if (!commandExists(command.command)) {
      const installHint =
        command.command === "agw" || command.command === "agw-cli"
          ? "Install it with `npm install -g @abstract-foundation/agw-cli`, or pass `--cli C:\\path\\to\\agw-cli.cmd`."
          : "Make sure it is installed and available in PATH.";
      throw new Error(`Cannot find ${command.command}. ${installHint}`);
    }

    const result = spawnSync(command.command, command.args, {
      encoding: "utf8",
      shell: process.platform === "win32",
    });

    if (result.error) {
      throw new Error(
        `Failed to run ${command.command}. Install AGW CLI first or pass --cli. ${result.error.message}`,
      );
    }

    if (result.status !== 0) {
      const stderr = result.stderr.trim();
      const stdout = result.stdout.trim();
      throw new Error(stderr || stdout || `${command.command} exited with ${result.status}`);
    }

    return parseJsonOutput(result.stdout);
  } finally {
    try {
      fs.unlinkSync(jsonPayloadFile);
    } catch {
      // Best effort cleanup only.
    }
  }
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}\s*$/);
    if (match) return JSON.parse(match[0]);
    return { raw: trimmed };
  }
}

function normalizeAppItem(item) {
  const rawId = item && (item.id ?? item.appId);
  const id = String(rawId ?? "").trim();
  if (!/^\d+$/.test(id)) return null;
  return {
    id,
    name: item.name || item.title || "",
  };
}

function extractAppPage(result) {
  const page = result.rawResult || result.data || result;
  const items = Array.isArray(page.items) ? page.items.map(normalizeAppItem).filter(Boolean) : [];
  return {
    items,
    nextCursor: page.nextCursor ?? null,
    totalItems: page.totalItems ?? items.length,
  };
}

async function listPortalApps(args) {
  const apps = [];
  let cursor;
  let totalItems;
  const seenCursors = new Set();

  do {
    const payload = {
      pageSize: args.appPageSize,
      fields: ["items.id", "items.name", "nextCursor", "totalItems"],
    };
    if (cursor) payload.cursor = cursor;

    const page = extractAppPage(runAgw(args, ["app", "list"], payload));
    apps.push(...page.items);
    totalItems = page.totalItems;

    if (!page.nextCursor || seenCursors.has(page.nextCursor)) break;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);

  const byId = new Map();
  for (const app of apps) byId.set(app.id, app);

  return {
    apps: [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)),
    totalItems: totalItems ?? byId.size,
  };
}

function extractAddress(result) {
  const candidates = [
    result.accountAddress,
    result.address,
    result.walletAddress,
    result.account,
    result.data && result.data.accountAddress,
    result.data && result.data.address,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (ethers.isAddress(candidate)) return ethers.getAddress(candidate);
  }

  const text = JSON.stringify(result);
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  if (match) return ethers.getAddress(match[0]);
  throw new Error(`Could not find AGW address in CLI output: ${text}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const provider = await createProvider(args.rpc);
  const voting = new ethers.Contract(VOTE_CONTRACT, VOTE_ABI, provider);

  console.log(`RPC: ${args.rpc}`);
  console.log("Checking linked AGW wallet...");
  const walletInfo = runAgw(args, ["wallet", "address"], {});
  const agwAddress = extractAddress(walletInfo);

  const [voteCost, currentEpoch, remaining, balance] = await Promise.all([
    voting.voteCost(),
    voting.currentEpoch(),
    voting.userVotesRemaining(agwAddress),
    provider.getBalance(agwAddress),
  ]);
  const epoch = args.epoch ? BigInt(args.epoch) : currentEpoch;
  const votedAppIds = await voting.getUserVotes(agwAddress, epoch);

  console.log(`AGW: ${agwAddress}`);
  console.log(`Contract: ${VOTE_CONTRACT}`);
  if (!args.listVotes && !args.listApps && !args.randomVote) console.log(`App ID: ${args.appId}`);
  console.log(`Current epoch: ${currentEpoch}`);
  if (epoch !== currentEpoch) console.log(`Inspecting epoch: ${epoch}`);
  console.log(`Vote cost: ${voteCost.toString()} wei (${ethers.formatEther(voteCost)} ETH)`);
  console.log(`Remaining votes: ${remaining}`);
  console.log(
    `Voted app IDs in epoch ${epoch}: ${
      votedAppIds.length > 0 ? votedAppIds.map((v) => v.toString()).join(", ") : "(none)"
    }`,
  );
  console.log(`AGW ETH balance: ${ethers.formatEther(balance)} ETH`);

  let portalApps;
  if (args.listApps || args.randomVote) {
    console.log("Loading Portal app list from AGW CLI...");
    portalApps = await listPortalApps(args);
    console.log(`Portal apps returned: ${portalApps.apps.length}/${portalApps.totalItems}`);
  }

  if (args.listApps) {
    for (const app of portalApps.apps) {
      console.log(`${app.id}${app.name ? ` - ${app.name}` : ""}`);
    }
    return;
  }

  if (args.listVotes) return;

  if (remaining === 0n) {
    throw new Error("This AGW has no remaining votes in the current epoch.");
  }
  if (balance < voteCost) {
    throw new Error("AGW balance is lower than the current vote cost.");
  }

  if (args.randomVote) {
    const voted = new Set(votedAppIds.map((v) => v.toString()));
    const candidates = portalApps.apps.filter((app) => !voted.has(app.id));
    if (candidates.length === 0) {
      throw new Error("No unvoted Portal app ids were found for this epoch.");
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    args.appId = selected.id;
    console.log(`Randomly selected unvoted app: ${selected.id}${selected.name ? ` - ${selected.name}` : ""}`);
  }

  const payload = {
    address: VOTE_CONTRACT,
    abi: VOTE_WRITE_ABI,
    functionName: "voteForApp",
    args: [String(args.appId)],
    value: voteCost.toString(),
  };
  const modeFlag = args.execute ? "--execute" : "--dry-run";

  console.log(args.execute ? "Executing vote through AGW CLI..." : "Previewing vote through AGW CLI...");
  const result = runAgw(args, ["contract", "write"], payload, modeFlag);
  console.log(JSON.stringify(result, null, 2));

  if (args.execute) {
    const updatedVotes = await voting.getUserVotes(agwAddress, currentEpoch);
    console.log(`Votes recorded this epoch: ${updatedVotes.map((v) => v.toString()).join(", ")}`);
  } else {
    console.log("Preview only. Re-run with --execute to broadcast.");
  }
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exitCode = 1;
});
