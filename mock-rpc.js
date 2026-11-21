import http from "http";
import crypto from "crypto";
import { ethers } from "ethers";
import { ABIS } from "./src/contracts/abis.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(
  fs.readFileSync(path.join(__dirname, "deployments.json"), "utf8")
);

const ifaces = {
  registry: new ethers.Interface(ABIS.SubmissionRegistry),
  staking: new ethers.Interface(ABIS.TokenStaking),
  htlc: new ethers.Interface(ABIS.HTLC),
  voting: new ethers.Interface(ABIS.SchellingVoting),
  bounty: new ethers.Interface(ABIS.ArbitratedBounty)
};

// Parse transaction/call data across all protocol interfaces by selector (independent of target address)
function parseProtocolCall(data, value = 0n) {
  for (const [contractKey, iface] of Object.entries(ifaces)) {
    try {
      const parsed = iface.parseTransaction({ data, value });
      if (parsed) {
        return { contractKey, iface, parsed };
      }
    } catch (_) {}
  }
  return null;
}

const VOTE_TAG = ethers.keccak256(ethers.toUtf8Bytes("VERILEAKS_SCHELLING_VOTE_V1"));
const CHAIN_ID = 31337n;

export const DEMO_ACCOUNTS = {
  deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  whistleblower: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  funder: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  disputer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  juror1: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  juror2: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  juror3: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  juror4: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  juror5: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
};

const JUROR_LIST = [
  DEMO_ACCOUNTS.juror1,
  DEMO_ACCOUNTS.juror2,
  DEMO_ACCOUNTS.juror3,
  DEMO_ACCOUNTS.juror4,
  DEMO_ACCOUNTS.juror5
];

// Helper: Randomly sample `k` unique jurors from the 5-juror pool (simulating Chainlink VRF v2.5)
function selectRandomJurors(pool, k = 3) {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  // Sort selected jurors by their pool order (Juror 1..5) for clean UI display
  const chosenSet = new Set(copy.slice(0, k).map((a) => a.toLowerCase()));
  return pool.filter((a) => chosenSet.has(a.toLowerCase()));
}

const evidenceFiles = new Map(); // submissionIdLower -> { fileName, encryptedFileName, mimeType, isEncrypted, algorithm, ciphertextBase64, ciphertextPreviewHex, aesKeyHex, ivHex, ipfsCid, merkleRoot }

// Helper: Encrypt a Buffer with AES-256-GCM in WebCrypto-compatible format (ciphertext || 16-byte authTag)
function encryptBufferAesGcm(plainBuf) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, tag]);
  return {
    ciphertextBase64: combined.toString("base64"),
    ciphertextPreviewHex: "0x" + combined.subarray(0, 32).toString("hex") + "...",
    aesKeyHex: "0x" + key.toString("hex"),
    ivHex: "0x" + iv.toString("hex"),
    algorithm: "AES-256-GCM"
  };
}

let blockNumber = 100;
let timeOffsetSec = 0;
const logs = [];
const txReceipts = new Map();
const nonces = new Map();
const ethBalances = new Map();

for (const addr of Object.values(DEMO_ACCOUNTS)) {
  ethBalances.set(addr.toLowerCase(), ethers.parseEther("100.0"));
}

const submissions = new Map();
const submissionOrder = [];
const stakeBalances = new Map();
const lockedBalances = new Map();
const bounties = new Map();
const pendingPayouts = new Map();
const disputes = new Map();
const disputeVotes = new Map();

const DEFAULT_CFG = {
  jurySize: 3,
  minReveals: 2,
  commitDuration: 86400,
  revealDuration: 86400,
  selectionTimeout: 3600,
  minorityPenaltyBps: 2500, // 25% slashing penalty for voting against consensus
  nonRevealPenaltyBps: 5000, // 50% slashing penalty for not revealing
  stakePerJuror: ethers.parseEther("1.0")
};

function nowTimestamp() {
  return Math.floor(Date.now() / 1000) + timeOffsetSec;
}

function getStake(addr) {
  return stakeBalances.get(addr.toLowerCase()) || 0n;
}
function setStake(addr, val) {
  stakeBalances.set(addr.toLowerCase(), val);
}
function getLocked(addr) {
  return lockedBalances.get(addr.toLowerCase()) || 0n;
}
function setLocked(addr, val) {
  lockedBalances.set(addr.toLowerCase(), val);
}
function getFree(addr) {
  const tot = getStake(addr);
  const lock = getLocked(addr);
  return tot > lock ? tot - lock : 0n;
}
function getTotalStaked() {
  let sum = 0n;
  for (const v of stakeBalances.values()) sum += v;
  return sum;
}

function emitLog(contractAddress, iface, eventName, args, txHash) {
  const encoded = iface.encodeEventLog(eventName, args);
  const logObj = {
    address: contractAddress,
    topics: encoded.topics,
    data: encoded.data,
    blockNumber: "0x" + blockNumber.toString(16),
    transactionHash: txHash,
    transactionIndex: "0x0",
    blockHash: "0x" + crypto.createHash("sha256").update("block:" + blockNumber).digest("hex"),
    logIndex: "0x" + logs.filter((l) => l.transactionHash === txHash).length.toString(16),
    removed: false
  };
  logs.push(logObj);
  return logObj;
}

function resetAllState(includeSampleBounties = false) {
  blockNumber = 100;
  timeOffsetSec = 0;
  logs.length = 0;
  txReceipts.clear();
  nonces.clear();
  ethBalances.clear();
  submissions.clear();
  submissionOrder.length = 0;
  stakeBalances.clear();
  lockedBalances.clear();
  bounties.clear();
  pendingPayouts.clear();
  disputes.clear();
  disputeVotes.clear();

  for (const addr of Object.values(DEMO_ACCOUNTS)) {
    ethBalances.set(addr.toLowerCase(), ethers.parseEther("100.0"));
  }

  blockNumber = 101;
  const initStake = ethers.parseEther("2.0");
  for (const jAddr of JUROR_LIST) {
    setStake(jAddr, initStake);
    const txHash = "0x" + crypto.createHash("sha256").update("seed-stake:" + jAddr + ":" + Date.now()).digest("hex");
    emitLog(deployments.staking, ifaces.staking, "Staked", [jAddr, initStake, getTotalStaked()], txHash);
  }

  // Always seed 1 default Submission so Funder can fund Bounty #1 either before or after Whistleblower submits a file
  const defaultCid = "Qm0fc291d0196439aad50bf0a8d1563198c260943c897d";
  const defaultRoot = "0xa8a38eb1ab21709b844a9f160bd64b0baf6a887291659b7766f598dd5eac9e1f";
  const defaultSubId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "string", "bytes32"],
      [DEMO_ACCOUNTS.whistleblower, defaultCid, defaultRoot]
    )
  );
  const ts = nowTimestamp() - 600;
  submissions.set(defaultSubId.toLowerCase(), {
    submissionId: defaultSubId,
    submitter: DEMO_ACCOUNTS.whistleblower,
    ipfsCid: defaultCid,
    merkleRoot: defaultRoot,
    timestamp: BigInt(ts),
    exists: true
  });
  submissionOrder.push(defaultSubId);
  const defaultContent =
    "VERILEAKS CONFIDENTIAL EVIDENCE REPORT #2026-A\n" +
    "==============================================\n" +
    "Subject: Unauthorized Off-Ledger Fund Transfers & Compliance Violations\n" +
    "Submitter: Anonymous Whistleblower\n" +
    "Details: Internal audit logs demonstrating falsified quarterly reserve attestations.\n";
  const defaultEnc = encryptBufferAesGcm(Buffer.from(defaultContent, "utf8"));
  evidenceFiles.set(defaultSubId.toLowerCase(), {
    fileName: "confidential_audit_leak_2026.txt",
    encryptedFileName: "confidential_audit_leak_2026.txt.enc",
    mimeType: "text/plain",
    isEncrypted: true,
    ...defaultEnc,
    ipfsCid: defaultCid,
    merkleRoot: defaultRoot
  });
  const subTxHash = "0x" + crypto.createHash("sha256").update("seed-sub-1:" + Date.now()).digest("hex");
  emitLog(
    deployments.registry,
    ifaces.registry,
    "SubmissionRegistered",
    [defaultSubId, DEMO_ACCOUNTS.whistleblower, defaultCid, defaultRoot, BigInt(ts)],
    subTxHash
  );

  if (!includeSampleBounties) {
    return;
  }

  // Optional sample Bounty #1 & Dispute #1
  blockNumber = 102;
  const bounty1Amount = ethers.parseEther("1.5");
  const bounty1Timelock = BigInt(nowTimestamp() + 7 * 86400);
  const lockId1 = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "bytes32"], [1n, defaultSubId])
  );
  bounties.set(1, {
    bountyId: 1,
    submissionId: defaultSubId,
    funder: DEMO_ACCOUNTS.funder,
    whistleblower: DEMO_ACCOUNTS.whistleblower,
    amount: bounty1Amount,
    lockId: lockId1,
    timelock: bounty1Timelock,
    status: 2, // DISPUTED
    openCount: 1,
    activeDispute: 1
  });
  ethBalances.set(
    DEMO_ACCOUNTS.funder.toLowerCase(),
    ethBalances.get(DEMO_ACCOUNTS.funder.toLowerCase()) - bounty1Amount
  );
  const b1TxHash = "0x" + crypto.createHash("sha256").update("seed-bounty-1").digest("hex");
  emitLog(
    deployments.arbitratedBounty,
    ifaces.bounty,
    "BountyFunded",
    [1n, defaultSubId, DEMO_ACCOUNTS.funder, DEMO_ACCOUNTS.whistleblower, bounty1Amount, lockId1, bounty1Timelock],
    b1TxHash
  );

  blockNumber = 103;
  const commitDeadline = nowTimestamp() + DEFAULT_CFG.commitDuration;
  const revealDeadline = commitDeadline + DEFAULT_CFG.revealDuration;
  const d1TxHash = "0x" + crypto.createHash("sha256").update("seed-dispute-1").digest("hex");

  for (const jAddr of JUROR_LIST) {
    const newLock = getLocked(jAddr) + DEFAULT_CFG.stakePerJuror;
    setLocked(jAddr, newLock);
    emitLog(deployments.staking, ifaces.staking, "StakeLocked", [jAddr, DEFAULT_CFG.stakePerJuror, newLock], d1TxHash);
    disputeVotes.set(`1:${jAddr.toLowerCase()}`, {
      selected: true,
      committed: false,
      revealed: false,
      vote: 0,
      commitment: "0x" + "00".repeat(32),
      penalty: 0n,
      reward: 0n
    });
  }

  disputes.set(1, {
    disputeId: 1,
    creator: deployments.arbitratedBounty,
    status: 2, // ACTIVE
    outcome: 0,
    createdAt: nowTimestamp() - 300,
    commitDeadline,
    revealDeadline,
    committed: 0,
    revealedReal: 0,
    revealedFake: 0,
    submissionId: defaultSubId,
    externalRef: 1,
    cfg: { ...DEFAULT_CFG },
    jurors: [...JUROR_LIST],
    penaltyPool: 0n
  });

  emitLog(
    deployments.voting,
    ifaces.voting,
    "DisputeCreated",
    [1n, deployments.arbitratedBounty, defaultSubId, 1n, 1n],
    d1TxHash
  );
  emitLog(
    deployments.voting,
    ifaces.voting,
    "JurorsSelected",
    [1n, JUROR_LIST, BigInt(commitDeadline), BigInt(revealDeadline)],
    d1TxHash
  );
  emitLog(
    deployments.arbitratedBounty,
    ifaces.bounty,
    "DisputeOpened",
    [1n, 1n, 1n, 8889n],
    d1TxHash
  );
}

resetAllState(false);

function computeCommitment(disputeId, juror, vote, salt) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "address", "uint256", "address", "uint8", "bytes32"],
      [VOTE_TAG, CHAIN_ID, deployments.voting, BigInt(disputeId), juror, Number(vote), salt]
    )
  );
}

function executeTransaction({ from, to, data, value, hash }) {
  blockNumber++;
  const sender = ethers.getAddress(from);
  const senderLower = sender.toLowerCase();
  const msgValue = BigInt(value || 0);
  const txLogs = [];

  if (msgValue > 0n) {
    const curBal = ethBalances.get(senderLower) ?? ethers.parseEther("100.0");
    ethBalances.set(senderLower, curBal >= msgValue ? curBal - msgValue : 0n);
  }

  const match = parseProtocolCall(data, msgValue);

  // 1. SubmissionRegistry
  if (match?.contractKey === "registry") {
    const { parsed } = match;
    if (parsed.name === "registerSubmission") {
      const [ipfsCid, merkleRoot] = parsed.args;
      const ts = nowTimestamp();
      const submissionId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "string", "bytes32", "uint256"],
          [sender, ipfsCid, merkleRoot, BigInt(ts)]
        )
      );
      submissions.set(submissionId.toLowerCase(), {
        submissionId,
        submitter: sender,
        ipfsCid,
        merkleRoot,
        timestamp: BigInt(ts),
        exists: true
      });
      submissionOrder.push(submissionId);
      txLogs.push(
        emitLog(
          deployments.registry,
          ifaces.registry,
          "SubmissionRegistered",
          [submissionId, sender, ipfsCid, merkleRoot, BigInt(ts)],
          hash
        )
      );
    }
  }

  // 2. TokenStaking
  else if (match?.contractKey === "staking") {
    const { parsed } = match;
    if (parsed.name === "stake") {
      const next = getStake(sender) + msgValue;
      setStake(sender, next);
      txLogs.push(
        emitLog(deployments.staking, ifaces.staking, "Staked", [sender, msgValue, getTotalStaked()], hash)
      );
    } else if (parsed.name === "unstake") {
      const [amount] = parsed.args;
      const free = getFree(sender);
      const actual = amount <= free ? amount : free;
      setStake(sender, getStake(sender) - actual);
      const curEth = ethBalances.get(senderLower) ?? 0n;
      ethBalances.set(senderLower, curEth + actual);
      txLogs.push(
        emitLog(deployments.staking, ifaces.staking, "Unstaked", [sender, actual, getStake(sender)], hash)
      );
    }
  }

  // 3. ArbitratedBounty
  else if (match?.contractKey === "bounty") {
    const { parsed } = match;
    if (parsed.name === "fundBounty") {
      const [submissionId, whistleblower, timelock] = parsed.args;
      const bountyId = bounties.size + 1;
      const lockId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "bytes32"], [BigInt(bountyId), submissionId])
      );
      if (!submissions.has(submissionId.toLowerCase())) {
        submissions.set(submissionId.toLowerCase(), {
          submissionId,
          submitter: ethers.getAddress(whistleblower),
          ipfsCid: "QmDemoEvidenceCid" + bountyId,
          merkleRoot: submissionId,
          timestamp: BigInt(nowTimestamp()),
          exists: true
        });
      }
      bounties.set(bountyId, {
        bountyId,
        submissionId,
        funder: sender,
        whistleblower: ethers.getAddress(whistleblower),
        amount: msgValue,
        lockId,
        timelock: BigInt(timelock),
        status: 1, // FUNDED
        openCount: 0,
        activeDispute: 0
      });
      txLogs.push(
        emitLog(
          deployments.arbitratedBounty,
          ifaces.bounty,
          "BountyFunded",
          [BigInt(bountyId), submissionId, sender, ethers.getAddress(whistleblower), msgValue, lockId, BigInt(timelock)],
          hash
        )
      );
    } else if (parsed.name === "openDispute") {
      const [bountyIdArg] = parsed.args;
      const bId = Number(bountyIdArg);
      const b = bounties.get(bId);
      if (b && b.status === 1) {
        const disputeId = disputes.size + 1;
        b.status = 2; // DISPUTED
        b.openCount += 1;
        b.activeDispute = disputeId;

        const ts = nowTimestamp();
        const commitDeadline = ts + DEFAULT_CFG.commitDuration;
        const revealDeadline = commitDeadline + DEFAULT_CFG.revealDuration;

        // Randomly draw 3 out of the 5 staked jurors via VRF
        const selectedJurors = selectRandomJurors(JUROR_LIST, DEFAULT_CFG.jurySize);

        for (const jAddr of selectedJurors) {
          if (getFree(jAddr) < DEFAULT_CFG.stakePerJuror) {
            setStake(jAddr, getStake(jAddr) + DEFAULT_CFG.stakePerJuror);
          }
          const newLock = getLocked(jAddr) + DEFAULT_CFG.stakePerJuror;
          setLocked(jAddr, newLock);
          txLogs.push(
            emitLog(
              deployments.staking,
              ifaces.staking,
              "StakeLocked",
              [jAddr, DEFAULT_CFG.stakePerJuror, newLock],
              hash
            )
          );
          disputeVotes.set(`${disputeId}:${jAddr.toLowerCase()}`, {
            selected: true,
            committed: false,
            revealed: false,
            vote: 0,
            commitment: "0x" + "00".repeat(32),
            penalty: 0n,
            reward: 0n
          });
        }

        disputes.set(disputeId, {
          disputeId,
          creator: deployments.arbitratedBounty,
          status: 2, // ACTIVE
          outcome: 0,
          createdAt: ts,
          commitDeadline,
          revealDeadline,
          committed: 0,
          revealedReal: 0,
          revealedFake: 0,
          submissionId: b.submissionId,
          externalRef: bId,
          cfg: { ...DEFAULT_CFG },
          jurors: [...selectedJurors],
          penaltyPool: 0n
        });

        txLogs.push(
          emitLog(
            deployments.voting,
            ifaces.voting,
            "DisputeCreated",
            [BigInt(disputeId), deployments.arbitratedBounty, b.submissionId, BigInt(bId), BigInt(disputeId)],
            hash
          )
        );
        txLogs.push(
          emitLog(
            deployments.voting,
            ifaces.voting,
            "JurorsSelected",
            [BigInt(disputeId), selectedJurors, BigInt(commitDeadline), BigInt(revealDeadline)],
            hash
          )
        );
        txLogs.push(
          emitLog(
            deployments.arbitratedBounty,
            ifaces.bounty,
            "DisputeOpened",
            [BigInt(bId), BigInt(disputeId), BigInt(b.openCount), BigInt(8888 + disputeId)],
            hash
          )
        );
      }
    } else if (parsed.name === "settle") {
      const [bountyIdArg] = parsed.args;
      const bId = Number(bountyIdArg);
      const b = bounties.get(bId);
      if (b && b.status === 2) {
        const d = disputes.get(b.activeDispute);
        if (d && d.status === 3) {
          if (d.outcome === 1) {
            b.status = 3; // RELEASED
            const wLower = b.whistleblower.toLowerCase();
            pendingPayouts.set(wLower, (pendingPayouts.get(wLower) || 0n) + b.amount);
            txLogs.push(
              emitLog(
                deployments.arbitratedBounty,
                ifaces.bounty,
                "PayoutCredited",
                [b.whistleblower, b.amount],
                hash
              )
            );
          } else if (d.outcome === 2) {
            b.status = 4; // REJECTED
            const fLower = b.funder.toLowerCase();
            pendingPayouts.set(fLower, (pendingPayouts.get(fLower) || 0n) + b.amount);
            txLogs.push(
              emitLog(
                deployments.arbitratedBounty,
                ifaces.bounty,
                "PayoutCredited",
                [b.funder, b.amount],
                hash
              )
            );
          } else {
            b.status = 1;
          }
          txLogs.push(
            emitLog(
              deployments.arbitratedBounty,
              ifaces.bounty,
              "BountySettled",
              [BigInt(bId), BigInt(d.disputeId), d.outcome, b.status],
              hash
            )
          );
        }
      }
    } else if (parsed.name === "withdraw") {
      const pending = pendingPayouts.get(senderLower) || 0n;
      if (pending > 0n) {
        pendingPayouts.set(senderLower, 0n);
        ethBalances.set(senderLower, (ethBalances.get(senderLower) || 0n) + pending);
        txLogs.push(
          emitLog(deployments.arbitratedBounty, ifaces.bounty, "PayoutWithdrawn", [sender, pending], hash)
        );
      }
    } else if (parsed.name === "refund") {
      const [bountyIdArg] = parsed.args;
      const bId = Number(bountyIdArg);
      const b = bounties.get(bId);
      if (b && (b.status === 1 || b.status === 4)) {
        b.status = 5; // REFUNDED
        const fLower = b.funder.toLowerCase();
        pendingPayouts.set(fLower, (pendingPayouts.get(fLower) || 0n) + b.amount);
        txLogs.push(
          emitLog(deployments.arbitratedBounty, ifaces.bounty, "BountyRefunded", [BigInt(bId), b.funder, b.amount], hash)
        );
      }
    }
  }

  // 4. SchellingVoting
  else if (match?.contractKey === "voting") {
    const { parsed } = match;
    if (parsed.name === "commitVote") {
      const [disputeIdArg, commitment] = parsed.args;
      const dId = Number(disputeIdArg);
      const d = disputes.get(dId);
      const key = `${dId}:${senderLower}`;
      const jv = disputeVotes.get(key);
      if (d && jv && jv.selected && !jv.committed) {
        jv.committed = true;
        jv.commitment = commitment;
        d.committed += 1;
        txLogs.push(
          emitLog(deployments.voting, ifaces.voting, "VoteCommitted", [BigInt(dId), sender, commitment], hash)
        );
      }
    } else if (parsed.name === "revealVote") {
      const [disputeIdArg, voteArg] = parsed.args;
      const dId = Number(disputeIdArg);
      const voteNum = Number(voteArg);
      const d = disputes.get(dId);
      const key = `${dId}:${senderLower}`;
      const jv = disputeVotes.get(key);
      if (d && jv && jv.selected && jv.committed && !jv.revealed) {
        jv.revealed = true;
        jv.vote = voteNum;
        if (voteNum === 1) d.revealedReal += 1;
        else if (voteNum === 2) d.revealedFake += 1;
        txLogs.push(
          emitLog(deployments.voting, ifaces.voting, "VoteRevealed", [BigInt(dId), sender, voteNum], hash)
        );
      }
    } else if (parsed.name === "finalize") {
      const [disputeIdArg] = parsed.args;
      const dId = Number(disputeIdArg);
      const d = disputes.get(dId);
      if (d && d.status === 2) {
        const real = d.revealedReal;
        const fake = d.revealedFake;
        const revealed = real + fake;
        let outcome = 3; // INCONCLUSIVE
        if (revealed >= d.cfg.minReveals) {
          if (real > fake) outcome = 1; // REAL
          else if (fake > real) outcome = 2; // FAKE
        }
        const winning = outcome === 1 ? 1 : outcome === 2 ? 2 : 0;
        const decisive = winning !== 0;
        const recipients = decisive ? (winning === 1 ? real : fake) : revealed;

        const stake = d.cfg.stakePerJuror;
        const nonRevealPenalty = recipients === 0 ? 0n : (stake * BigInt(d.cfg.nonRevealPenaltyBps)) / 10000n;
        const minorityPenalty = decisive ? (stake * BigInt(d.cfg.minorityPenaltyBps)) / 10000n : 0n;

        d.status = 3; // FINALIZED
        d.outcome = outcome;

        let pool = 0n;
        for (const jAddr of d.jurors) {
          const jv = disputeVotes.get(`${dId}:${jAddr.toLowerCase()}`);
          let penalty = 0n;
          if (!jv.revealed) penalty = nonRevealPenalty;
          else if (decisive && jv.vote !== winning) penalty = minorityPenalty;

          jv.penalty = penalty;
          if (penalty > 0n) {
            pool += penalty;
            setLocked(jAddr, getLocked(jAddr) - penalty);
            setStake(jAddr, getStake(jAddr) - penalty);
            txLogs.push(
              emitLog(deployments.voting, ifaces.voting, "JurorSettled", [BigInt(dId), jAddr, penalty, 0n], hash)
            );
          }
          const remLock = stake - penalty;
          if (remLock > 0n) {
            const curL = getLocked(jAddr);
            setLocked(jAddr, curL >= remLock ? curL - remLock : 0n);
          }
        }

        d.penaltyPool = pool;
        if (pool > 0n && recipients > 0) {
          let paid = 0n;
          let seen = 0;
          const share = pool / BigInt(recipients);
          for (const jAddr of d.jurors) {
            const jv = disputeVotes.get(`${dId}:${jAddr.toLowerCase()}`);
            if (!jv.revealed || (decisive && jv.vote !== winning)) continue;
            seen += 1;
            const reward = seen === recipients ? pool - paid : share;
            paid += reward;
            jv.reward = reward;
            setStake(jAddr, getStake(jAddr) + reward);
            txLogs.push(
              emitLog(deployments.voting, ifaces.voting, "JurorSettled", [BigInt(dId), jAddr, 0n, reward], hash)
            );
          }
        }

        txLogs.push(
          emitLog(
            deployments.voting,
            ifaces.voting,
            "DisputeFinalized",
            [BigInt(dId), outcome, BigInt(real), BigInt(fake), pool, BigInt(recipients)],
            hash
          )
        );
      }
    }
  }

  const receipt = {
    transactionHash: hash,
    transactionIndex: "0x0",
    blockHash: "0x" + crypto.createHash("sha256").update("block:" + blockNumber).digest("hex"),
    blockNumber: "0x" + blockNumber.toString(16),
    from: sender,
    to: to,
    cumulativeGasUsed: "0x15f90",
    gasUsed: "0x15f90",
    effectiveGasPrice: "0x3b9aca00",
    contractAddress: null,
    logs: txLogs,
    logsBloom: "0x" + "00".repeat(256),
    status: "0x1",
    type: "0x2"
  };
  txReceipts.set(hash.toLowerCase(), receipt);
  return hash;
}

function handleCall(callObj) {
  const data = callObj.data || callObj.input || "0x";
  const match = parseProtocolCall(data);
  if (!match) return "0x" + "00".repeat(32);

  const { contractKey, parsed: decoded } = match;

  if (contractKey === "registry") {
    if (decoded.name === "submissionCount") {
      return ifaces.registry.encodeFunctionResult("submissionCount", [BigInt(submissions.size)]);
    }
    if (decoded.name === "submissionExists") {
      const [subId] = decoded.args;
      return ifaces.registry.encodeFunctionResult("submissionExists", [submissions.has(subId.toLowerCase())]);
    }
    if (decoded.name === "getSubmission") {
      const [subId] = decoded.args;
      const s = submissions.get(subId.toLowerCase());
      if (s) {
        return ifaces.registry.encodeFunctionResult("getSubmission", [[
          s.submissionId,
          s.submitter,
          s.ipfsCid,
          s.merkleRoot,
          s.timestamp,
          true
        ]]);
      }
    }
  }

  if (contractKey === "staking") {
    if (decoded.name === "totalStaked") {
      return ifaces.staking.encodeFunctionResult("totalStaked", [getTotalStaked()]);
    }
    if (decoded.name === "balanceOf") {
      return ifaces.staking.encodeFunctionResult("balanceOf", [getStake(decoded.args[0])]);
    }
    if (decoded.name === "freeBalanceOf") {
      return ifaces.staking.encodeFunctionResult("freeBalanceOf", [getFree(decoded.args[0])]);
    }
    if (decoded.name === "lockedOf") {
      return ifaces.staking.encodeFunctionResult("lockedOf", [getLocked(decoded.args[0])]);
    }
  }

  if (contractKey === "bounty") {
    if (decoded.name === "bountyCount") {
      return ifaces.bounty.encodeFunctionResult("bountyCount", [BigInt(bounties.size)]);
    }
    if (decoded.name === "pendingPayout") {
      const [addr] = decoded.args;
      return ifaces.bounty.encodeFunctionResult("pendingPayout", [pendingPayouts.get(addr.toLowerCase()) || 0n]);
    }
    if (decoded.name === "getBounty") {
      const bId = Number(decoded.args[0]);
      const b = bounties.get(bId);
      if (b) {
        return ifaces.bounty.encodeFunctionResult("getBounty", [[
          b.submissionId,
          b.funder,
          b.whistleblower,
          b.amount,
          b.lockId,
          b.timelock,
          BigInt(b.status),
          BigInt(b.openCount),
          BigInt(b.activeDispute)
        ]]);
      }
      return ifaces.bounty.encodeFunctionResult("getBounty", [[
        "0x" + "00".repeat(32),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0n,
        "0x" + "00".repeat(32),
        0n,
        0n,
        0n,
        0n
      ]]);
    }
  }

  if (contractKey === "voting") {
    if (decoded.name === "disputeCount") {
      return ifaces.voting.encodeFunctionResult("disputeCount", [BigInt(disputes.size)]);
    }
    if (decoded.name === "commitmentFor") {
      const [disputeId, juror, vote, salt] = decoded.args;
      return ifaces.voting.encodeFunctionResult("commitmentFor", [
        computeCommitment(disputeId, juror, vote, salt)
      ]);
    }
    if (decoded.name === "resultOf") {
      const dId = Number(decoded.args[0]);
      const d = disputes.get(dId);
      if (d) {
        return ifaces.voting.encodeFunctionResult("resultOf", [
          BigInt(d.status),
          BigInt(d.outcome),
          d.creator,
          BigInt(d.externalRef),
          d.submissionId
        ]);
      }
      return ifaces.voting.encodeFunctionResult("resultOf", [
        0n,
        0n,
        ethers.ZeroAddress,
        0n,
        "0x" + "00".repeat(32)
      ]);
    }
    if (decoded.name === "jurorsOf") {
      const dId = Number(decoded.args[0]);
      const d = disputes.get(dId);
      return ifaces.voting.encodeFunctionResult("jurorsOf", [d ? d.jurors : []]);
    }
    if (decoded.name === "voteOf") {
      const dId = Number(decoded.args[0]);
      const jAddr = decoded.args[1].toLowerCase();
      const jv = disputeVotes.get(`${dId}:${jAddr}`);
      if (jv) {
        return ifaces.voting.encodeFunctionResult("voteOf", [
          jv.selected,
          jv.committed,
          jv.revealed,
          BigInt(jv.vote)
        ]);
      }
      return ifaces.voting.encodeFunctionResult("voteOf", [false, false, false, 0n]);
    }
    if (decoded.name === "getDispute") {
      const dId = Number(decoded.args[0]);
      const d = disputes.get(dId);
      if (d) {
        return ifaces.voting.encodeFunctionResult("getDispute", [[
          d.creator,
          BigInt(d.status),
          BigInt(d.outcome),
          BigInt(d.createdAt),
          BigInt(d.commitDeadline),
          BigInt(d.revealDeadline),
          BigInt(d.committed),
          BigInt(d.revealedReal),
          BigInt(d.revealedFake),
          d.submissionId,
          BigInt(d.externalRef),
          [
            BigInt(d.cfg.jurySize),
            BigInt(d.cfg.minReveals),
            BigInt(d.cfg.commitDuration),
            BigInt(d.cfg.revealDuration),
            BigInt(d.cfg.selectionTimeout),
            BigInt(d.cfg.minorityPenaltyBps),
            BigInt(d.cfg.nonRevealPenaltyBps),
            d.cfg.stakePerJuror
          ],
          d.jurors
        ]]);
      }
    }
  }

  return "0x" + "00".repeat(32);
}

function handleRpcMethod(method, params = []) {
  switch (method) {
    case "eth_chainId":
      return "0x7a69"; // 31337
    case "net_version":
      return "31337";
    case "eth_blockNumber":
      return "0x" + blockNumber.toString(16);
    case "eth_gasPrice":
    case "eth_maxPriorityFeePerGas":
      return "0x3b9aca00";
    case "eth_estimateGas":
      return "0x493e0";
    case "eth_getBalance": {
      const addr = (params[0] || "").toLowerCase();
      const bal = ethBalances.get(addr) ?? ethers.parseEther("100.0");
      return "0x" + bal.toString(16);
    }
    case "eth_getTransactionCount": {
      const addr = (params[0] || "").toLowerCase();
      const n = nonces.get(addr) || 0;
      return "0x" + n.toString(16);
    }
    case "eth_getBlockByNumber": {
      const tsHex = "0x" + nowTimestamp().toString(16);
      const bHex = "0x" + blockNumber.toString(16);
      return {
        number: bHex,
        hash: "0x" + crypto.createHash("sha256").update("block:" + blockNumber).digest("hex"),
        parentHash: "0x" + crypto.createHash("sha256").update("block:" + (blockNumber - 1)).digest("hex"),
        nonce: "0x0000000000000000",
        sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
        logsBloom: "0x" + "00".repeat(256),
        transactionsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        stateRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        receiptsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
        miner: "0x0000000000000000000000000000000000000000",
        difficulty: "0x0",
        totalDifficulty: "0x0",
        extraData: "0x",
        size: "0x3e8",
        gasLimit: "0x1c9c380",
        gasUsed: "0x0",
        timestamp: tsHex,
        transactions: [],
        uncles: [],
        baseFeePerGas: "0x7"
      };
    }
    case "eth_sendRawTransaction": {
      const rawTx = params[0];
      const tx = ethers.Transaction.from(rawTx);
      const fromLower = tx.from.toLowerCase();
      nonces.set(fromLower, (nonces.get(fromLower) || 0) + 1);
      return executeTransaction({
        from: tx.from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        hash: tx.hash
      });
    }
    case "eth_sendTransaction": {
      const txObj = params[0] || {};
      const from = txObj.from || DEMO_ACCOUNTS.deployer;
      const fromLower = from.toLowerCase();
      const nonce = nonces.get(fromLower) || 0;
      nonces.set(fromLower, nonce + 1);
      const hash = "0x" + crypto.createHash("sha256").update(`${fromLower}:${nonce}:${Date.now()}`).digest("hex");
      return executeTransaction({
        from,
        to: txObj.to,
        data: txObj.data || txObj.input || "0x",
        value: txObj.value ? BigInt(txObj.value) : 0n,
        hash
      });
    }
    case "eth_getTransactionReceipt": {
      const hash = (params[0] || "").toLowerCase();
      return txReceipts.get(hash) || null;
    }
    case "eth_getTransactionByHash": {
      const hash = (params[0] || "").toLowerCase();
      const r = txReceipts.get(hash);
      if (!r) return null;
      return {
        hash: r.transactionHash,
        blockHash: r.blockHash,
        blockNumber: r.blockNumber,
        from: r.from,
        to: r.to,
        value: "0x0",
        gas: "0x493e0",
        gasPrice: "0x3b9aca00",
        input: "0x",
        nonce: "0x0",
        transactionIndex: "0x0",
        type: "0x2",
        chainId: "0x7a69"
      };
    }
    case "eth_getLogs": {
      const filter = params[0] || {};
      const addr = (filter.address || "").toLowerCase();
      const fromBlock = filter.fromBlock ? parseInt(filter.fromBlock, 16) : 0;
      const toBlock =
        filter.toBlock && filter.toBlock !== "latest" ? parseInt(filter.toBlock, 16) : blockNumber;
      return logs.filter((l) => {
        const bNum = parseInt(l.blockNumber, 16);
        const matchAddr = !addr || l.address.toLowerCase() === addr;
        return matchAddr && bNum >= fromBlock && bNum <= toBlock;
      });
    }
    case "eth_call":
      return handleCall(params[0] || {});
    case "evm_increaseTime": {
      timeOffsetSec += Number(params[0] || 0);
      return "0x" + timeOffsetSec.toString(16);
    }
    case "verileaks_resetState": {
      const includeSamples = Boolean(params[0]);
      resetAllState(includeSamples);
      blockNumber = 2; // Lower than any active watchtower checkpoint so watchtowers auto-reset their stores!
      return { ok: true, blockNumber };
    }
    case "verileaks_linkSubmissionToBounty": {
      const [bountyIdArg, submissionId, whistleblowerAddr, cid, merkleRoot, fileMeta] = params;
      const bId = Number(bountyIdArg);
      const b = bounties.get(bId);
      if (fileMeta && submissionId) {
        evidenceFiles.set(submissionId.toLowerCase(), {
          fileName: fileMeta.fileName || "whistleblower_evidence.bin",
          encryptedFileName: fileMeta.encryptedFileName || `${fileMeta.fileName || "evidence"}.enc`,
          mimeType: fileMeta.mimeType || "application/octet-stream",
          isEncrypted: true,
          algorithm: fileMeta.algorithm || "AES-256-GCM",
          ciphertextBase64: fileMeta.ciphertextBase64 || "",
          ciphertextPreviewHex: fileMeta.ciphertextPreviewHex || "",
          aesKeyHex: fileMeta.aesKeyHex || "",
          ivHex: fileMeta.ivHex || "",
          ipfsCid: cid || "",
          merkleRoot: merkleRoot || ""
        });
      }
      if (b) {
        b.submissionId = submissionId;
        b.whistleblower = ethers.getAddress(whistleblowerAddr);
        b.hasEvidence = true;
        b.ipfsCid = cid || "";
        b.merkleRoot = merkleRoot || "";

        // Automatically initiate Chainlink VRF 3-of-5 Jury Selection when evidence is uploaded for a FUNDED bounty!
        let createdDisputeId = b.activeDispute;
        let selectedJurors = [];
        if (b.status === 1) {
          blockNumber++;
          const autoTxHash =
            "0x" +
            crypto
              .createHash("sha256")
              .update(`auto-vrf-dispute:${bId}:${submissionId}:${Date.now()}`)
              .digest("hex");

          createdDisputeId = disputes.size + 1;
          b.status = 2; // DISPUTED (Under VRF Jury Arbitration)
          b.openCount += 1;
          b.activeDispute = createdDisputeId;

          const ts = nowTimestamp();
          const commitDeadline = ts + DEFAULT_CFG.commitDuration;
          const revealDeadline = commitDeadline + DEFAULT_CFG.revealDuration;

          selectedJurors = selectRandomJurors(JUROR_LIST, DEFAULT_CFG.jurySize);

          for (const jAddr of selectedJurors) {
            if (getFree(jAddr) < DEFAULT_CFG.stakePerJuror) {
              setStake(jAddr, getStake(jAddr) + DEFAULT_CFG.stakePerJuror);
            }
            const newLock = getLocked(jAddr) + DEFAULT_CFG.stakePerJuror;
            setLocked(jAddr, newLock);
            emitLog(
              deployments.staking,
              ifaces.staking,
              "StakeLocked",
              [jAddr, DEFAULT_CFG.stakePerJuror, newLock],
              autoTxHash
            );
            disputeVotes.set(`${createdDisputeId}:${jAddr.toLowerCase()}`, {
              selected: true,
              committed: false,
              revealed: false,
              vote: 0,
              commitment: "0x" + "00".repeat(32),
              penalty: 0n,
              reward: 0n
            });
          }

          disputes.set(createdDisputeId, {
            disputeId: createdDisputeId,
            creator: deployments.arbitratedBounty,
            status: 2, // ACTIVE
            outcome: 0,
            createdAt: ts,
            commitDeadline,
            revealDeadline,
            committed: 0,
            revealedReal: 0,
            revealedFake: 0,
            submissionId: b.submissionId,
            externalRef: bId,
            cfg: { ...DEFAULT_CFG },
            jurors: [...selectedJurors],
            penaltyPool: 0n
          });

          emitLog(
            deployments.voting,
            ifaces.voting,
            "DisputeCreated",
            [
              BigInt(createdDisputeId),
              deployments.arbitratedBounty,
              b.submissionId,
              BigInt(bId),
              BigInt(createdDisputeId)
            ],
            autoTxHash
          );
          emitLog(
            deployments.voting,
            ifaces.voting,
            "JurorsSelected",
            [BigInt(createdDisputeId), selectedJurors, BigInt(commitDeadline), BigInt(revealDeadline)],
            autoTxHash
          );
          emitLog(
            deployments.arbitratedBounty,
            ifaces.bounty,
            "DisputeOpened",
            [BigInt(bId), BigInt(createdDisputeId), BigInt(b.openCount), BigInt(8888 + createdDisputeId)],
            autoTxHash
          );
        }

        return {
          ok: true,
          bountyId: bId,
          submissionId,
          disputeId: createdDisputeId,
          selectedJurors
        };
      }
      return { ok: false };
    }
    case "verileaks_downloadEvidence": {
      const [disputeIdArg, callerAddr] = params;
      const dId = Number(disputeIdArg);
      const d = disputes.get(dId);
      if (!d) {
        return { authorized: false, error: `Dispute #${dId} does not exist.` };
      }
      const callerLower = (callerAddr || "").toLowerCase();
      const isSelectedJuror = d.jurors.some((j) => j.toLowerCase() === callerLower);
      if (!isSelectedJuror) {
        return {
          authorized: false,
          error: `Access Denied: Wallet ${callerAddr} was NOT selected by Chainlink VRF for Dispute #${dId}. Only the 3 VRF-selected jurors for this case can download the encrypted .enc file or unseal the AES-256-GCM decryption key.`
        };
      }
      const subLower = (d.submissionId || "").toLowerCase();
      const subObj = submissions.get(subLower);
      let fileObj = evidenceFiles.get(subLower);
      if (!fileObj) {
        const fallbackText =
          "VERILEAKS CONFIDENTIAL EVIDENCE REPORT #2026-A\n" +
          "==============================================\n" +
          "Subject: Unauthorized Off-Ledger Fund Transfers & Compliance Violations\n" +
          "Details: Internal audit logs demonstrating falsified quarterly reserve attestations.\n";
        const fallbackEnc = encryptBufferAesGcm(Buffer.from(fallbackText, "utf8"));
        fileObj = {
          fileName: "confidential_audit_leak_2026.txt",
          encryptedFileName: "confidential_audit_leak_2026.txt.enc",
          mimeType: "text/plain",
          isEncrypted: true,
          ...fallbackEnc,
          ipfsCid: subObj?.ipfsCid || "Qm0fc291d0196439aad50bf0a8d1563198c260943c897d",
          merkleRoot: subObj?.merkleRoot || "0xa8a38eb1ab21709b844a9f160bd64b0baf6a887291659b7766f598dd5eac9e1f"
        };
      }
      return {
        authorized: true,
        disputeId: dId,
        submissionId: d.submissionId,
        ...fileObj
      };
    }
    case "verileaks_setBountyTitle": {
      const [bountyIdArg, title] = params;
      const b = bounties.get(Number(bountyIdArg));
      if (b) {
        b.caseTitle = title;
      }
      return { ok: true };
    }
    case "verileaks_getStateSummary": {
      const allSubmissions = submissionOrder.map((id) => {
        const s = submissions.get(id.toLowerCase());
        return {
          submissionId: s.submissionId,
          submitter: s.submitter,
          ipfsCid: s.ipfsCid,
          merkleRoot: s.merkleRoot,
          timestamp: Number(s.timestamp)
        };
      });
      const allBounties = Array.from(bounties.values()).map((b) => ({
        bountyId: b.bountyId,
        caseTitle: b.caseTitle || `Case #${b.bountyId}: Corporate Misconduct Inquiry`,
        amountEth: ethers.formatEther(b.amount),
        status: b.status,
        activeDispute: b.activeDispute,
        submissionId: b.submissionId,
        whistleblower: b.whistleblower,
        hasEvidence: Boolean(b.hasEvidence)
      }));
      const allDisputes = Array.from(disputes.values()).map((d) => ({
        disputeId: d.disputeId,
        bountyId: d.externalRef,
        status: d.status,
        outcome: d.outcome
      }));
      const jurorSummary = JUROR_LIST.map((addr, idx) => ({
        id: idx + 1,
        address: addr,
        totalStaked: ethers.formatEther(getStake(addr)),
        freeStake: ethers.formatEther(getFree(addr)),
        lockedStake: ethers.formatEther(getLocked(addr)),
        netDiffEth: ethers.formatEther(getStake(addr) - ethers.parseEther("2.0"))
      }));
      const disputeVotesSummary = {};
      for (const [k, v] of disputeVotes.entries()) {
        disputeVotesSummary[k] = {
          selected: Boolean(v.selected),
          committed: Boolean(v.committed),
          revealed: Boolean(v.revealed),
          vote: Number(v.vote || 0),
          commitment: v.commitment,
          penaltyEth: ethers.formatEther(v.penalty || 0n),
          rewardEth: ethers.formatEther(v.reward || 0n)
        };
      }
      return {
        blockNumber,
        submissions: allSubmissions,
        bounties: allBounties,
        disputes: allDisputes,
        bountyCount: bounties.size,
        disputeCount: disputes.size,
        jurors: jurorSummary,
        disputeVotes: disputeVotesSummary
      };
    }
    default:
      return null;
  }
}

function safeJsonStringify(obj) {
  return JSON.stringify(obj, (_, val) => (typeof val === "bigint" ? val.toString() : val));
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in RPC server:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection in RPC server:", err);
});

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const parsed = JSON.parse(body);
      let payload;
      if (Array.isArray(parsed)) {
        const responses = parsed.map((item) => ({
          jsonrpc: "2.0",
          id: item.id,
          result: handleRpcMethod(item.method, item.params)
        }));
        payload = safeJsonStringify(responses);
      } else {
        const result = handleRpcMethod(parsed.method, parsed.params);
        payload = safeJsonStringify({ jsonrpc: "2.0", id: parsed.id, result });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(payload);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "application/json" });
      }
      res.end(safeJsonStringify({ error: e.message }));
    }
  });
});

server.listen(8545, "127.0.0.1", () => {
  console.log("Stateful VeriLeaks EVM RPC listening on http://127.0.0.1:8545 (Chain ID: 31337)");
});
